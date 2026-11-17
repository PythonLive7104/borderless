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
        # Start protected rather than start permissive. Without this a new site
        # allows everything until the customer writes a rule, while the
        # dashboard already says "Protected".
        from apps.rules.defaults import create_default_rule
        create_default_rule(website)
        from apps.rules.sync import publish_org
        publish_org(website.organization_id)   # publishes the new rule too

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

        Either signal is proof on its own:

          1. An event has arrived — a browser ran the script.
          2. Our tag is in the HTML the site serves right now.

        (2) used to be reported as *not* installed: the customer was told
        "now open it in a browser to send the first event, then verify again",
        so a correct install still needed a visitor before we would admit it
        worked. On a site with no traffic yet that is a loop with no exit, and
        it is why verification felt like it took many attempts to pass. Reading
        our own tag out of the served page is the stronger of the two signals —
        a pageview says the script ran once, the tag says it is on the page
        now — so it verifies the install by itself, and is recorded so the
        answer sticks instead of being re-derived on every visit to the page.

        The active fetch is best-effort: any failure falls back to the passive
        signal rather than erroring the button.
        """
        from apps.websites import snippet_check

        w = self.get_object()
        by_event = w.last_event_at is not None
        if by_event and not w.strict_mode:
            return Response({
                "status": w.status,
                "live_state": w.live_state(),
                "installed": True,
                "snippet_state": snippet_check.FOUND,
                "strict_state": snippet_check.STRICT_NA,
                "last_event_at": w.last_event_at,
                "message": "Installation detected — you're receiving traffic.",
            })

        try:
            probe = snippet_check.check(w)
        except Exception:
            probe = {"state": snippet_check.UNREACHABLE, "url": w.url or w.domain}

        state = probe.get("state", snippet_check.UNREACHABLE)
        on_page = state == snippet_check.FOUND
        if on_page:
            # Persist it. This is what stops the customer being asked to verify
            # the same working install over and over.
            w.mark_snippet_seen()

        if not (by_event or on_page):
            messages = {
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
                "strict_state": probe.get("strict_state", snippet_check.STRICT_UNKNOWN),
                "found_tag": probe.get("tag", ""),
                "checked_url": probe.get("checked_url") or probe.get("url", ""),
                "last_event_at": None,
                "message": messages.get(state, "No events received yet. "
                                               "Make sure the snippet is on your site."),
            })

        # Installed. The only question left is whether the tag on the page can
        # deliver what strict mode promises — strict mode lives in OUR database
        # but is enforced by an attribute in THEIR HTML, so the two drift apart
        # silently. Traffic arriving proves nothing here: an async tag collects
        # traffic perfectly well while hiding nothing.
        if not w.strict_mode:
            st = snippet_check.STRICT_NA
        else:
            st = probe.get("strict_state", snippet_check.STRICT_UNKNOWN)

        # Said once, so each branch below can append its own next step.
        confirmed = ("Verified — the snippet is live on your page."
                     if on_page else "Installation detected — you're receiving traffic.")
        traffic_note = "" if by_event else (
            " Your first visitor will show up on the dashboard automatically; "
            "there's nothing else for you to do.")

        if st in (snippet_check.STRICT_NA, snippet_check.STRICT_OK):
            ok, message = True, confirmed + traffic_note
        elif st == snippet_check.STRICT_ASYNC:
            ok, message = False, (
                confirmed + " But the tag on your page still has `async`. An async "
                "script can't hide the page before the browser draws it, so blocked "
                "visitors see your content flash first. Copy the snippet above again "
                "and replace the old tag.")
        elif st == snippet_check.STRICT_MISSING:
            ok, message = False, (
                confirmed + ' But the tag on your page is missing `data-strict="1"`, '
                "so the loader never runs and blocked visitors see your page. Copy "
                "the snippet above again and replace the old tag.")
        else:   # STRICT_UNKNOWN — we couldn't read the page back
            ok, message = True, (
                confirmed + " We couldn't re-read your page to confirm the loader is "
                "set up — check that the tag is the one shown above.")

        return Response({
            "status": w.status,
            "live_state": w.live_state(),
            # Not "ok" when the tag can't deliver what strict mode promises:
            # the dashboard shows this amber rather than green.
            "installed": ok,
            "snippet_state": snippet_check.FOUND if on_page else state,
            "strict_state": st,
            "found_tag": probe.get("tag", ""),
            "checked_url": probe.get("checked_url") or probe.get("url", ""),
            "last_event_at": w.last_event_at,
            "message": message,
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
