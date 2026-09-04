from rest_framework import permissions, viewsets, views
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.organizations.models import OrganizationMember
from .abuse import extract_slug, process_report
from .models import AbuseReport, ShortLink
from .serializers import ShortLinkSerializer
from .sync import publish_link, unpublish_link, scan_and_flag
from rest_framework.permissions import IsAuthenticated
from apps.billing.permissions import HasWorkspaceAccess


class ShortLinkViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasWorkspaceAccess]
    serializer_class = ShortLinkSerializer

    def _member_org_ids(self):
        return OrganizationMember.objects.filter(user=self.request.user).values_list("organization_id", flat=True)

    def get_queryset(self):
        qs = ShortLink.objects.filter(organization_id__in=self._member_org_ids()).select_related("website")
        org = self.request.query_params.get("organization")
        return qs.filter(organization_id=org) if org else qs

    def _require_manager(self, org_id):
        m = OrganizationMember.objects.filter(organization_id=org_id, user=self.request.user).first()
        if not m or not m.can_manage:
            raise PermissionDenied("Only Owners and Admins can manage links.")

    def perform_create(self, serializer):
        org = serializer.validated_data["organization"]
        from apps.billing.models import link_shortener_enabled, redirect_limit
        if not link_shortener_enabled(org.id):
            raise PermissionDenied(
                "Redirects are a paid feature. Start a plan on the Billing page to create them.")
        limit = redirect_limit(org.id)
        if limit and ShortLink.objects.filter(organization_id=org.id).count() >= limit:
            raise PermissionDenied(
                f"You've reached your plan's redirect limit ({limit}). "
                "Upgrade your plan on the Billing page for more redirects.")
        link = serializer.save()
        scan_and_flag(link)   # threat scan; auto-disables if the destination is unsafe
        publish_link(link)

    def perform_update(self, serializer):
        self._require_manager(serializer.instance.organization_id)
        link = serializer.save()
        scan_and_flag(link)
        publish_link(link)

    def perform_destroy(self, instance):
        self._require_manager(instance.organization_id)
        slug = instance.slug
        instance.delete()
        unpublish_link(slug)


# --- Public abuse reporting (no account required) -------------------------
# Anyone who receives a malicious short link must be able to tell us in a few
# seconds. If they can't, they report the domain to our registrar instead and
# every customer's links die with it.

RL_LIMIT = 10      # reports per IP
RL_WINDOW = 3600   # per hour


def _client_ip(request):
    xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "") or ""


def _rate_limited(ip) -> bool:
    try:
        from apps.rules.sync import _r
        r = _r()
        key = f"abuse:rl:{ip}"
        n = r.incr(key)
        if n == 1:
            r.expire(key, RL_WINDOW)
        return n > RL_LIMIT
    except Exception:
        return False  # never turn away a report over a Redis hiccup


class AbuseReportView(views.APIView):
    """POST {url, reason, details?, email?} — file a report on a short link."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        ip = _client_ip(request)
        if _rate_limited(ip):
            return Response(
                {"detail": "You've filed a lot of reports — please wait a while, "
                           "or email us directly so nothing gets lost."},
                status=429,
            )

        reported_url = (request.data.get("url") or "").strip()[:2000]
        if not reported_url:
            return Response({"detail": "Paste the redirect link you're reporting."}, status=400)

        reason = (request.data.get("reason") or "").strip()
        if reason not in AbuseReport.Reason.values:
            reason = AbuseReport.Reason.OTHER

        slug = extract_slug(reported_url)
        report = AbuseReport.objects.create(
            reported_url=reported_url,
            slug=slug,
            link=ShortLink.objects.filter(slug=slug).first() if slug else None,
            reason=reason,
            details=(request.data.get("details") or "").strip()[:5000],
            reporter_email=(request.data.get("email") or "").strip()[:254],
            reporter_ip=ip or None,
        )
        try:
            result = process_report(report)
        except Exception:
            # A failure here must never lose the report — it's already saved and
            # will be picked up by triage.
            result = {"matched": bool(report.link), "disabled": False}

        return Response({
            "id": report.id,
            "status": "received",
            "matched": result["matched"],
            "disabled": result["disabled"],
        }, status=201)
