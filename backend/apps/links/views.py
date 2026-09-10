from django.conf import settings
from rest_framework import permissions, viewsets, views
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.organizations.models import OrganizationMember
from .abuse import extract_slug, process_report
from .models import AbuseReport, ShortDomain, ShortLink
from .serializers import ShortDomainSerializer, ShortLinkSerializer
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

    def list(self, request, *args, **kwargs):
        """List, plus the base every short link is built on.

        The dashboard needs this to preview a link BEFORE one exists — deriving
        it from an existing row leaves a brand-new workspace previewing the wrong
        domain (the old /l/ form on the main site instead of the short domain).
        """
        response = super().list(request, *args, **kwargs)
        if not isinstance(response.data, dict):
            return response
        org = request.query_params.get("organization")
        domains = ShortDomain.for_org(org) if org else ShortDomain.objects.none()
        response.data["domains"] = ShortDomainSerializer(domains, many=True).data
        # What this workspace owns privately, and how many are left to buy.
        response.data["private"] = {
            "owned": ShortDomainSerializer(
                ShortDomain.private_for(org), many=True).data if org else [],
            "available": ShortDomain.private_stock().count(),
        }
        # Kept for the create-form preview: the default domain, or "" when the
        # service has no usable domain at all.
        default = ShortDomain.default_for(org) if org else None
        response.data["base"] = default.base if default else ""
        return response

    def create(self, request, *args, **kwargs):
        # Checked before validation: with no usable domain there is nothing to
        # validate against, and "unavailable" is a clearer answer than a field error.
        from apps.billing.models import redirects_available
        if not redirects_available():
            raise PermissionDenied(
                "Redirects are temporarily unavailable. No new links can be created right now.")
        return super().create(request, *args, **kwargs)

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
        old_slug, old_host = serializer.instance.slug, serializer.instance.host()
        link = serializer.save()
        # A renamed redirect must stop answering on its old slug. publish_link
        # only writes the new key, so without this the old URL keeps redirecting
        # out of Redis forever — including one renamed to disown an abused link.
        if link.slug != old_slug or link.host() != old_host:
            unpublish_link(old_slug, old_host)
        scan_and_flag(link)
        publish_link(link)

    def perform_destroy(self, instance):
        self._require_manager(instance.organization_id)
        slug, host = instance.slug, instance.host()
        instance.delete()
        unpublish_link(slug, host)


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


class PrivateDomainCheckoutView(views.APIView):
    """POST {organization} — start a one-off purchase of a private domain."""
    permission_classes = [IsAuthenticated, HasWorkspaceAccess]

    def post(self, request):
        from apps.billing import bachs
        from apps.billing.models import link_shortener_enabled
        from apps.organizations.models import OrganizationMember
        from .models import PrivateDomainPurchase
        from .purchases import mark_paid

        org_id = request.data.get("organization")
        m = OrganizationMember.objects.filter(organization_id=org_id, user=request.user).first()
        if not m or not m.can_manage:
            return Response({"detail": "Only Owners and Admins can buy a domain."}, status=403)
        if not link_shortener_enabled(org_id):
            return Response({"detail": "A private domain is an add-on to a paid plan. "
                                       "Start a plan first."}, status=403)
        # Owning one is fine — that payment is a renewal, handled in mark_paid().

        price = int(getattr(settings, "PRIVATE_DOMAIN_PRICE", 25))
        purchase = PrivateDomainPurchase.objects.create(
            organization_id=org_id, user=request.user, amount=price)

        product_id = getattr(settings, "BACHS_PRODUCT_PRIVATE_DOMAIN", "")
        if not bachs.is_enabled() or not product_id:
            if settings.DEBUG:
                mark_paid(purchase)     # local development only
                return Response({"activated": True})
            # Never hand over a domain unpaid.
            import logging
            logging.getLogger("bachs").error(
                "private domain checkout blocked: bachs_enabled=%s product_id=%r",
                bachs.is_enabled(), product_id)
            return Response({"detail": "Private domains aren't available to buy just yet. "
                                       "Contact support and we'll set one up."}, status=503)

        front = settings.FRONTEND_URL.rstrip("/")
        data, err = bachs.create_checkout_session(
            product_id=product_id,
            email=request.user.email,
            return_url=f"{front}/dashboard/links?purchase=success",
            cancel_url=f"{front}/dashboard/links?purchase=cancelled",
            metadata={"organization_id": str(org_id), "kind": "private_domain",
                      "purchase_id": str(purchase.id)},
        )
        if err:
            return Response({"detail": err}, status=502)

        from apps.billing.views import _find_session_id
        purchase.bachs_session_id = _find_session_id(data)
        purchase.save(update_fields=["bachs_session_id"])
        url = (data.get("checkout_url") or data.get("url") or data.get("redirect_url")
               or (data.get("data") or {}).get("checkout_url"))
        if not url:
            return Response({"detail": "Bachs did not return a checkout URL."}, status=502)
        return Response({"checkout_url": url})


class PrivateDomainVerifyView(views.APIView):
    """POST {organization} — confirm the purchase with Bachs on return.

    Same reasoning as plan checkout: the webhook can't be the only path, or a
    paid customer waits on a delivery that may never arrive.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from apps.billing import bachs
        from apps.organizations.models import OrganizationMember
        from .models import PrivateDomainPurchase
        from .purchases import mark_paid

        org_id = request.data.get("organization")
        if not OrganizationMember.objects.filter(organization_id=org_id, user=request.user).exists():
            return Response({"detail": "Not a member of this workspace."}, status=403)

        pending = (PrivateDomainPurchase.objects
                   .filter(organization_id=org_id,
                           status=PrivateDomainPurchase.Status.PENDING)
                   .exclude(bachs_session_id="").first())
        if not pending:
            return Response({"paid": False})

        data, err = bachs.get_checkout_session(pending.bachs_session_id)
        if err or not bachs.session_is_paid(data):
            return Response({"paid": False})

        domain = mark_paid(pending)
        return Response({"paid": True, "host": domain.host if domain else "",
                         "awaiting_stock": domain is None})
