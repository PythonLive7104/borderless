from datetime import timedelta
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.links.abuse import extract_slug
from apps.links.models import AbuseReport, ShortLink
from django.contrib.auth import get_user_model

from apps.organizations.models import create_workspace

SHORT = "https://trynb.cc"


def _workspace(email: str):
    user = get_user_model().objects.create_user(
        username=email, email=email, password="testpass123")
    return create_workspace(user, "Acme")


@override_settings(SHORTLINK_BASE=SHORT, FRONTEND_URL="https://www.trynobot.com")
class ExtractSlugTest(TestCase):
    def test_accepts_the_shapes_reporters_actually_paste(self):
        for value in (f"{SHORT}/aB3xK9", "trynb.cc/aB3xK9", f"{SHORT}/l/aB3xK9",
                      "/aB3xK9", "aB3xK9", f"{SHORT}/aB3xK9?utm=x", f"{SHORT}/aB3xK9#frag",
                      "HTTPS://TRYNB.CC/aB3xK9", "https://www.trynobot.com/l/aB3xK9"):
            self.assertEqual(extract_slug(value), "aB3xK9", value)

    def test_foreign_host_never_yields_a_slug(self):
        # Otherwise reporting evil.example/<victim-slug> would disable an
        # innocent customer's link — the form becomes the abuse vector.
        self.assertEqual(extract_slug("https://evil.example/aB3xK9"), "")
        self.assertEqual(extract_slug("https://example.com/some/deep/path"), "")

    def test_junk_is_ignored(self):
        for value in ("", "   ", "not a url at all", SHORT + "/", "https://trynb.cc"):
            self.assertEqual(extract_slug(value), "", repr(value))


class AbuseReportBase(TestCase):
    def setUp(self):
        # The limiter counts in Redis, which outlives the test database, so the
        # functional tests turn it off and test_rate_limit covers it on its own.
        limiter = patch("apps.links.views._rate_limited", return_value=False)
        limiter.start()
        self.addCleanup(limiter.stop)

        self.c = APIClient()
        self.org = _workspace("owner@acme.example")
        self.link = ShortLink.objects.create(
            organization=self.org, slug="aB3xK9",
            destination_url="https://phish.example/login", active=True)

    def report(self, **kw):
        payload = {"url": f"{SHORT}/aB3xK9", "reason": "phishing"}
        payload.update(kw)
        return self.c.post("/api/v1/abuse/", payload, format="json")


@override_settings(SHORTLINK_BASE=SHORT, ABUSE_EMAIL="abuse@trynobot.com")
class AbuseReportEndpointTest(AbuseReportBase):
    def test_report_needs_no_account(self):
        r = self.report()
        self.assertEqual(r.status_code, 201)
        self.assertTrue(r.json()["matched"])
        self.assertEqual(AbuseReport.objects.count(), 1)

    def test_url_is_required(self):
        r = self.c.post("/api/v1/abuse/", {"reason": "phishing"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_unknown_reason_falls_back_instead_of_rejecting(self):
        # Never turn away a report over a bad enum — we want the signal.
        r = self.report(reason="something-invented")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(AbuseReport.objects.get().reason, "other")

    def test_flagged_scan_disables_the_link_immediately(self):
        with patch("apps.intelligence.threatscan.is_enabled", return_value=True), \
             patch("apps.intelligence.threatscan.scan_url",
                   return_value={"safe": False, "threats": ["SOCIAL_ENGINEERING"],
                                 "flagged_by": ["google_safe_browsing"], "checked": True}):
            r = self.report()
        self.assertTrue(r.json()["disabled"])
        self.link.refresh_from_db()
        self.assertFalse(self.link.active)
        self.assertEqual(AbuseReport.objects.get().status, AbuseReport.Status.ACTIONED)

    def test_clean_scan_leaves_the_link_live_for_triage(self):
        with patch("apps.intelligence.threatscan.is_enabled", return_value=True), \
             patch("apps.intelligence.threatscan.scan_url",
                   return_value={"safe": True, "threats": [], "flagged_by": [], "checked": True}):
            r = self.report()
        self.assertFalse(r.json()["disabled"])
        self.link.refresh_from_db()
        self.assertTrue(self.link.active)

    def test_reports_alone_never_disable_a_link(self):
        # Reports are unverified. Only a confirmed threat scan pulls a link, so
        # nobody can take down a rival's link by filing complaints.
        clean = {"safe": True, "threats": [], "flagged_by": [], "checked": True}
        with patch("apps.intelligence.threatscan.is_enabled", return_value=True), \
             patch("apps.intelligence.threatscan.scan_url", return_value=clean):
            for ip in ("203.0.113.1", "203.0.113.2", "203.0.113.3", "203.0.113.4"):
                self.c.credentials(HTTP_X_FORWARDED_FOR=ip)
                r = self.report()
                self.assertFalse(r.json()["disabled"])
        self.link.refresh_from_db()
        self.assertTrue(self.link.active)
        self.assertEqual(AbuseReport.objects.count(), 4)
        # They stay open so a human sees the pile-up in the triage queue.
        self.assertEqual(
            AbuseReport.objects.filter(status=AbuseReport.Status.NEW).count(), 4)

    def test_unmatched_url_is_still_recorded(self):
        r = self.report(url="https://evil.example/whatever")
        self.assertEqual(r.status_code, 201)
        self.assertFalse(r.json()["matched"])
        self.assertEqual(AbuseReport.objects.count(), 1)

    def test_rate_limited_reporter_is_told_to_email_instead(self):
        with patch("apps.links.views._rate_limited", return_value=True):
            r = self.report()
        self.assertEqual(r.status_code, 429)
        self.assertIn("email us", r.json()["detail"])
        self.assertEqual(AbuseReport.objects.count(), 0)

    def test_limiter_fails_open_when_redis_is_down(self):
        # A Redis outage must never swallow an abuse report.
        from apps.links.views import _rate_limited
        with patch("apps.rules.sync._r", side_effect=RuntimeError("redis down")):
            self.assertFalse(_rate_limited("203.0.113.50"))

    def test_disabled_link_stops_redirecting(self):
        with patch("apps.intelligence.threatscan.is_enabled", return_value=True), \
             patch("apps.intelligence.threatscan.scan_url",
                   return_value={"safe": False, "threats": ["MALWARE"],
                                 "flagged_by": ["virustotal"], "checked": True}), \
             patch("apps.links.abuse.publish_link") as published:
            self.report()
        # Redis must be rewritten or the engine keeps serving the old payload.
        self.assertTrue(published.called)


@override_settings(SHORTLINK_BASE=SHORT)
class RescanCommandTest(TestCase):
    def setUp(self):
        self.org = _workspace("owner@rescan.example")
        self.stale = ShortLink.objects.create(
            organization=self.org, slug="stale1", destination_url="https://went-bad.example",
            active=True, url_safe=True, url_scanned_at=timezone.now() - timedelta(days=5))
        self.fresh = ShortLink.objects.create(
            organization=self.org, slug="fresh1", destination_url="https://fine.example",
            active=True, url_safe=True, url_scanned_at=timezone.now())

    def test_disables_a_destination_that_turned_malicious(self):
        bad = {"safe": False, "threats": ["SOCIAL_ENGINEERING"],
               "flagged_by": ["google_safe_browsing"], "checked": True}
        with patch("apps.intelligence.threatscan.is_enabled", return_value=True), \
             patch("apps.intelligence.threatscan.scan_url", return_value=bad):
            call_command("rescan_links", "--sleep", "0", verbosity=0)
        self.stale.refresh_from_db()
        self.assertFalse(self.stale.active)

    def test_skips_links_scanned_recently(self):
        clean = {"safe": True, "threats": [], "flagged_by": [], "checked": True}
        with patch("apps.intelligence.threatscan.is_enabled", return_value=True), \
             patch("apps.intelligence.threatscan.scan_url", return_value=clean) as scan:
            call_command("rescan_links", "--sleep", "0", verbosity=0)
        scanned = {c.args[0] for c in scan.call_args_list}
        self.assertIn(self.stale.destination_url, scanned)
        self.assertNotIn(self.fresh.destination_url, scanned)

    def test_never_re_enables_a_link_we_already_disabled(self):
        self.stale.active = False
        self.stale.save()
        clean = {"safe": True, "threats": [], "flagged_by": [], "checked": True}
        with patch("apps.intelligence.threatscan.is_enabled", return_value=True), \
             patch("apps.intelligence.threatscan.scan_url", return_value=clean):
            call_command("rescan_links", "--sleep", "0", verbosity=0)
        self.stale.refresh_from_db()
        self.assertFalse(self.stale.active)

    def test_dry_run_calls_no_scanner(self):
        with patch("apps.intelligence.threatscan.is_enabled", return_value=True), \
             patch("apps.intelligence.threatscan.scan_url") as scan:
            call_command("rescan_links", "--dry-run", verbosity=0)
        scan.assert_not_called()

    def test_no_keys_configured_is_a_clean_no_op(self):
        with patch("apps.intelligence.threatscan.is_enabled", return_value=False), \
             patch("apps.intelligence.threatscan.scan_url") as scan:
            call_command("rescan_links", verbosity=0)
        scan.assert_not_called()


class ReservedSlugTest(TestCase):
    def test_report_slug_cannot_be_claimed(self):
        from apps.links.serializers import ShortLinkSerializer
        for slug in ("report", "abuse", "Report"):
            s = ShortLinkSerializer()
            with self.assertRaises(Exception, msg=slug):
                s.validate_slug(slug)


@override_settings(SHORTLINK_BASE=SHORT)
class EditRedirectTest(TestCase):
    """Editing a redirect must keep Redis in step with the database."""

    def setUp(self):
        self.c = APIClient()
        self.c.post("/api/auth/register/", {"email": "ed@example.com", "password": "testpass123",
                                            "first_name": "E"}, format="json")
        access = self.c.post("/api/auth/token/", {"email": "ed@example.com", "password": "testpass123"},
                             format="json").json()["access"]
        self.c.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        orgs = self.c.get("/api/organizations/").json()
        self.org = orgs[0]["id"] if isinstance(orgs, list) else orgs["results"][0]["id"]
        call_command("grant_plan", "--org", str(self.org), "--plan", "pro", verbosity=0)
        self.link = ShortLink.objects.create(
            organization_id=self.org, slug="keepme",
            destination_url="https://example.com/a", active=True)

    def test_can_edit_destination_and_bot_action(self):
        r = self.c.patch(f"/api/links/{self.link.id}/",
                         {"destination_url": "https://example.com/b", "bot_action": "notfound"},
                         format="json")
        self.assertEqual(r.status_code, 200)
        self.link.refresh_from_db()
        self.assertEqual(self.link.destination_url, "https://example.com/b")
        self.assertEqual(self.link.bot_action, "notfound")

    def test_renaming_the_slug_retires_the_old_redis_key(self):
        with patch("apps.links.views.unpublish_link") as unpub, \
             patch("apps.links.views.publish_link"):
            r = self.c.patch(f"/api/links/{self.link.id}/", {"slug": "brandnew"}, format="json")
        self.assertEqual(r.status_code, 200)
        unpub.assert_called_once_with("keepme")   # old URL must stop redirecting

    def test_editing_without_renaming_leaves_the_key_alone(self):
        with patch("apps.links.views.unpublish_link") as unpub, \
             patch("apps.links.views.publish_link"):
            self.c.patch(f"/api/links/{self.link.id}/", {"title": "Renamed"}, format="json")
        unpub.assert_not_called()

    def test_edit_rescans_the_new_destination_and_disables_if_unsafe(self):
        bad = {"safe": False, "threats": ["SOCIAL_ENGINEERING"],
               "flagged_by": ["google_safe_browsing"], "checked": True}
        with patch("apps.intelligence.threatscan.is_enabled", return_value=True), \
             patch("apps.intelligence.threatscan.scan_url", return_value=bad):
            r = self.c.patch(f"/api/links/{self.link.id}/",
                             {"destination_url": "https://phish.example/login"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.link.refresh_from_db()
        self.assertFalse(self.link.active)

    def test_cannot_rename_onto_a_reserved_slug(self):
        r = self.c.patch(f"/api/links/{self.link.id}/", {"slug": "report"}, format="json")
        self.assertEqual(r.status_code, 400)


@override_settings(SHORTLINK_BASE=SHORT, FRONTEND_URL="https://www.trynobot.com")
class LinkBaseTest(TestCase):
    """The list response carries the short-link base so the dashboard can
    preview a link before the workspace has created any."""

    def setUp(self):
        self.c = APIClient()
        self.c.post("/api/auth/register/", {"email": "b@example.com", "password": "testpass123",
                                            "first_name": "B"}, format="json")
        access = self.c.post("/api/auth/token/", {"email": "b@example.com", "password": "testpass123"},
                             format="json").json()["access"]
        self.c.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    def test_base_is_the_short_domain_with_no_links_yet(self):
        r = self.c.get("/api/links/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["results"], [])
        self.assertEqual(r.json()["base"], SHORT)

    @override_settings(SHORTLINK_BASE="")
    def test_falls_back_to_the_legacy_path_when_no_short_domain(self):
        self.assertEqual(self.c.get("/api/links/").json()["base"], "https://www.trynobot.com/l")


@override_settings(SHORTLINK_BASE=SHORT)
class ChallengeFlagTest(TestCase):
    """The human check is per-redirect and has to reach the engine via Redis."""

    def setUp(self):
        self.org = _workspace("owner@challenge.example")

    def test_defaults_to_off(self):
        link = ShortLink.objects.create(organization=self.org, slug="c1",
                                        destination_url="https://example.com")
        self.assertFalse(link.challenge)

    def test_flag_is_published_in_the_redis_payload(self):
        import json
        from apps.links.sync import _payload
        link = ShortLink.objects.create(organization=self.org, slug="c2",
                                        destination_url="https://example.com", challenge=True)
        self.assertTrue(json.loads(_payload(link))["challenge"])

    def test_payload_stays_false_when_off(self):
        import json
        from apps.links.sync import _payload
        link = ShortLink.objects.create(organization=self.org, slug="c3",
                                        destination_url="https://example.com")
        self.assertFalse(json.loads(_payload(link))["challenge"])


@override_settings(SHORTLINK_BASE=SHORT)
class ForwardParamsTest(TestCase):
    def setUp(self):
        self.org = _workspace("owner@forward.example")

    def test_defaults_to_off(self):
        link = ShortLink.objects.create(organization=self.org, slug="f1",
                                        destination_url="https://form.example/s")
        self.assertFalse(link.forward_params)

    def test_flag_reaches_the_engine_payload(self):
        import json
        from apps.links.sync import _payload
        link = ShortLink.objects.create(organization=self.org, slug="f2",
                                        destination_url="https://form.example/s",
                                        forward_params=True)
        self.assertTrue(json.loads(_payload(link))["forward_params"])


@override_settings(SHORTLINK_BASE=SHORT)
class ForwardParamKeysTest(TestCase):
    def setUp(self):
        self.org = _workspace("owner@keys.example")

    def _link(self, keys):
        return ShortLink.objects.create(
            organization=self.org, slug=f"k{abs(hash(keys)) % 9999}",
            destination_url="https://form.example/s",
            forward_params=True, forward_param_keys=keys)

    def test_keys_are_split_trimmed_and_emptied(self):
        self.assertEqual(self._link("email, rid").forward_keys(), ["email", "rid"])
        self.assertEqual(self._link(" email ,, ,rid ").forward_keys(), ["email", "rid"])
        self.assertEqual(self._link("").forward_keys(), [])

    def test_keys_reach_the_engine_payload(self):
        import json
        from apps.links.sync import _payload
        self.assertEqual(json.loads(_payload(self._link("email,rid")))["forward_keys"],
                         ["email", "rid"])


@override_settings(SHORTLINK_BASE=SHORT)
class BlockVpnTest(TestCase):
    def setUp(self):
        self.org = _workspace("owner@vpn.example")

    def test_defaults_to_off(self):
        self.assertFalse(ShortLink.objects.create(
            organization=self.org, slug="v1",
            destination_url="https://example.com").block_vpn)

    def test_flag_reaches_the_engine_payload(self):
        import json
        from apps.links.sync import _payload
        link = ShortLink.objects.create(organization=self.org, slug="v2",
                                        destination_url="https://example.com", block_vpn=True)
        self.assertTrue(json.loads(_payload(link))["block_vpn"])


class TrackerEnforcementTest(TestCase):
    """Strict mode changes the snippet the dashboard hands out."""

    def setUp(self):
        self.org = _workspace("owner@strict.example")

    def _snippet(self, strict):
        from apps.websites.models import Website
        from apps.websites.serializers import WebsiteSerializer
        w = Website.objects.create(organization=self.org, name="S", domain="s.example",
                                   strict_mode=strict)
        return WebsiteSerializer(w).data["snippet"]

    def test_default_snippet_is_async_and_not_strict(self):
        snip = self._snippet(False)
        self.assertIn("async", snip)
        self.assertNotIn("data-strict", snip)

    def test_strict_snippet_drops_async_and_sets_the_flag(self):
        # An async script can't hide the page before it paints, so strict mode
        # has to load synchronously or it does nothing.
        snip = self._snippet(True)
        self.assertIn('data-strict="1"', snip)
        self.assertNotIn("async", snip)
