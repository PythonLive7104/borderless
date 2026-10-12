from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.organizations.models import OrganizationMember, Role
from .models import Website
from .serializers import WebsiteSerializer
from rest_framework.permissions import IsAuthenticated
from apps.billing.permissions import HasWorkspaceAccess


class WebsiteViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasWorkspaceAccess]
    serializer_class = WebsiteSerializer

    def _member_org_ids(self):
        return OrganizationMember.objects.filter(user=self.request.user).values_list("organization_id", flat=True)

    def get_queryset(self):
        # The internal redirect holder isn't a site the user added.
        qs = Website.objects.filter(organization_id__in=self._member_org_ids(), is_system=False)
        org = self.request.query_params.get("organization")
        if org:
            qs = qs.filter(organization_id=org)
        return qs

    def _require_manager(self, org_id):
        m = OrganizationMember.objects.filter(organization_id=org_id, user=self.request.user).first()
        if not m or not m.can_manage:
            raise PermissionDenied("Only Owners and Admins can modify websites.")

    def perform_create(self, serializer):
        org = serializer.validated_data["organization"]
        self._require_manager(org.id)
        from apps.billing.models import website_limit, is_on_trial
        from rest_framework.exceptions import ValidationError
        limit = website_limit(org.id)  # 0 = unlimited
        if limit and Website.objects.filter(organization=org, is_system=False).count() >= limit:
            where = "free trial" if is_on_trial(org.id) else "current plan"
            raise ValidationError(
                f"Your {where} can protect {limit} website{'s' if limit != 1 else ''}. "
                "Upgrade to a higher plan on the Billing page to add more.")
        website = serializer.save()
        from apps.rules.sync import publish_org
        publish_org(website.organization_id)

    def perform_update(self, serializer):
        self._require_manager(serializer.instance.organization_id)
        serializer.save()

    def perform_destroy(self, instance):
        self._require_manager(instance.organization_id)
        instance.delete()

    @action(detail=True, methods=["get"])
    def snippet(self, request, pk=None):
        w = self.get_object()
        return Response({"tracking_id": w.tracking_id,
                         "snippet": WebsiteSerializer(w, context={"request": request}).data["snippet"]})

    @action(detail=True, methods=["post"])
    def verify(self, request, pk=None):
        """Report installation status.

        Two signals, in order of certainty:
          1. If any event has ever arrived, it's installed and working — done.
          2. Otherwise actively fetch the customer's live page and look for the
             snippet, so we can say WHY nothing has arrived: the tag isn't on
             the served page (the usual cause — edited the wrong file), it's
             there but no one has visited, or the page can't be reached.
        The active fetch is best-effort: any failure falls back to the old
        passive message rather than erroring the button.
        """
        from apps.websites import snippet_check

        w = self.get_object()
        installed = w.last_event_at is not None
        if installed:
            return Response({
                "status": w.status,
                "live_state": w.live_state(),
                "installed": True,
                "snippet_state": snippet_check.FOUND,
                "last_event_at": w.last_event_at,
                "message": "Installation detected — you're receiving traffic.",
            })

        try:
            probe = snippet_check.check(w)
        except Exception:
            probe = {"state": "unreachable", "url": w.url or w.domain}

        state = probe["state"]
        messages = {
            snippet_check.FOUND:
                "Snippet found on your page — now open it in a browser to send "
                "the first event, then verify again.",
            snippet_check.MISSING:
                f"We loaded {probe.get('checked_url') or probe.get('url')} but the "
                "snippet isn't in the page. Make sure you pasted it before </head> "
                "on the page that's actually served — not a backup or a different file.",
            snippet_check.UNREACHABLE:
                f"We couldn't load {probe.get('url') or 'your site'}. Check the "
                "website URL in settings, then try again.",
            snippet_check.NO_URL:
                "Add your site's URL in settings so we can check the snippet for you.",
        }
        return Response({
            "status": w.status,
            "live_state": w.live_state(),
            "installed": False,
            "snippet_state": state,
            "checked_url": probe.get("checked_url") or probe.get("url", ""),
            "last_event_at": None,
            "message": messages.get(state, "No events received yet. "
                                            "Make sure the snippet is on your site."),
        })

    @action(detail=True, methods=["post"], url_path="check-safebrowsing")
    def check_safebrowsing(self, request, pk=None):
        """Run a Safe Browsing check for this site now, instead of waiting for
        the scheduled job. A short cooldown stops the button burning API quota."""
        from django.utils import timezone
        from datetime import timedelta
        from apps.websites import safebrowsing

        w = self.get_object()
        if not safebrowsing.is_enabled():
            return Response(
                {"enabled": False,
                 "message": "Safe Browsing checks aren't configured on this server yet."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE)

        # Manual checks hit Google's API, so rate-limit to once a minute per site.
        if w.safe_browsing_checked_at and \
                timezone.now() - w.safe_browsing_checked_at < timedelta(seconds=60):
            return Response({
                "enabled": True, "flagged": w.safe_browsing_flagged,
                "threats": w.safe_browsing_threats,
                "checked_at": w.safe_browsing_checked_at,
                "message": "Checked moments ago — showing the latest result.",
            })

        r = safebrowsing.check_site(w)
        r["message"] = ("Flagged by Google Safe Browsing." if r["flagged"]
                        else "Clear — Google Safe Browsing found no problems.")
        return Response(r)

    @action(detail=True, methods=["post"], url_path="verify-shield")
    def verify_shield(self, request, pk=None):
        """Report how this site is protected: server-side, in the browser, or not yet.

        There are two legitimate installs and they look nothing alike here. The
        server-side Shield calls /v1/decide or /v1/guard and emits
        type='server_check'. The browser install — the only option for a plain
        .html file on a host that runs no code — is the tracker, which emits
        pageviews through /v1/collect and never produces a server_check.

        Reporting only the first meant anyone following the "Single HTML file"
        instructions was told their install had failed when it was working, with
        the fix being something they cannot do on a static host. So both are
        reported, and the caller says which one it was aiming for.
        """
        w = self.get_object()
        from apps.traffic.models import TrafficEvent
        events = TrafficEvent.objects.filter(website=w)
        server_ev = events.filter(type="server_check").order_by("-created_at").first()
        browser_ev = events.exclude(type="server_check").order_by("-created_at").first()

        # What the caller installed, so the message answers the right question.
        # Defaults to "server" — the stricter reading, and what every tab other
        # than the single-HTML one is aiming for.
        expecting = request.data.get("expecting") or "server"

        if server_ev:
            mode, message = "server", (
                "Shield is working — we're receiving server-side checks from your site.")
        elif browser_ev and expecting == "browser":
            mode, message = "browser", (
                "Working — we're checking visitors in the browser. Bots that run a real "
                "browser are stopped; a scraper that ignores JavaScript still receives your "
                "HTML. That's the limit of a static host, not a problem with your install.")
        elif browser_ev:
            mode, message = "browser", (
                "Your tracking snippet is working, but no server-side checks have arrived "
                "yet. If you meant to install the Shield on your server, it isn't running "
                "— open a page on your site and check again. If your host can't run code, "
                "use the Single HTML file tab instead; that's the strongest option there.")
        else:
            mode, message = "none", (
                "Nothing has reached us from this site yet. Install a snippet above, then "
                "open a page on your site and check again.")

        latest = server_ev or browser_ev
        return Response({
            # `active` stays "is this install doing what the caller wanted", so the
            # UI's success/pending styling keeps working unchanged.
            "active": mode == "server" or (mode == "browser" and expecting == "browser"),
            "mode": mode,
            "server_active": server_ev is not None,
            "browser_active": browser_ev is not None,
            "last_check_at": latest.created_at if latest else None,
            "message": message,
        })
