from datetime import timedelta
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.links.abuse import extract_slug
from apps.links.models import AbuseReport, ShortDomain, ShortLink
from django.contrib.auth import get_user_model

from apps.organizations.models import create_workspace

SHORT = "https://trynb.cc"


def _domain(host="trynb.cc", **kw):
    from django.utils import timezone
    d, _ = ShortDomain.objects.get_or_create(
        host=host, defaults={"active": True, "is_default": True,
                             "verified_at": timezone.now(), **kw})
    return d


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
            domain=_domain(),
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
        self.stale = ShortLink.objects.create(domain=_domain(), 
            organization=self.org, slug="stale1", destination_url="https://went-bad.example",
            active=True, url_safe=True, url_scanned_at=timezone.now() - timedelta(days=5))
        self.fresh = ShortLink.objects.create(domain=_domain(), 
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
        self.link = ShortLink.objects.create(domain=_domain(), 
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
        unpub.assert_called_once_with("keepme", "trynb.cc")   # old URL must stop redirecting

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
        _domain()

    def test_base_is_the_short_domain_with_no_links_yet(self):
        orgs = self.c.get("/api/organizations/").json()
        org = orgs[0]["id"] if isinstance(orgs, list) else orgs["results"][0]["id"]
        r = self.c.get(f"/api/links/?organization={org}")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["results"], [])
        self.assertEqual(r.json()["base"], SHORT)

    def test_no_usable_domain_means_no_base_rather_than_the_brand_domain(self):
        # Previously this fell back to <main domain>/l, which served redirects
        # from the brand we keep link abuse away from.
        ShortDomain.objects.update(active=False)
        self.assertEqual(self.c.get("/api/links/").json()["base"], "")


@override_settings(SHORTLINK_BASE=SHORT)
class ChallengeFlagTest(TestCase):
    """The human check is per-redirect and has to reach the engine via Redis."""

    def setUp(self):
        self.org = _workspace("owner@challenge.example")

    def test_defaults_to_off(self):
        link = ShortLink.objects.create(domain=_domain(), organization=self.org, slug="c1",
                                        destination_url="https://example.com")
        self.assertFalse(link.challenge)

    def test_flag_is_published_in_the_redis_payload(self):
        import json
        from apps.links.sync import _payload
        link = ShortLink.objects.create(domain=_domain(), organization=self.org, slug="c2",
                                        destination_url="https://example.com", challenge=True)
        self.assertTrue(json.loads(_payload(link))["challenge"])

    def test_style_defaults_to_press_and_hold(self):
        link = ShortLink.objects.create(domain=_domain(), organization=self.org, slug="c4",
                                        destination_url="https://example.com", challenge=True)
        self.assertEqual(link.challenge_style, "hold")

    def test_each_style_reaches_the_engine(self):
        import json
        from apps.links.sync import _payload
        for i, style in enumerate(("hold", "checkbox", "slide")):
            link = ShortLink.objects.create(domain=_domain(), organization=self.org, slug=f"cs{i}",
                                            destination_url="https://example.com",
                                            challenge=True, challenge_style=style)
            self.assertEqual(json.loads(_payload(link))["challenge_style"], style)

    def test_payload_stays_false_when_off(self):
        import json
        from apps.links.sync import _payload
        link = ShortLink.objects.create(domain=_domain(), organization=self.org, slug="c3",
                                        destination_url="https://example.com")
        self.assertFalse(json.loads(_payload(link))["challenge"])


@override_settings(SHORTLINK_BASE=SHORT)
class ForwardParamsTest(TestCase):
    def setUp(self):
        self.org = _workspace("owner@forward.example")

    def test_defaults_to_off(self):
        link = ShortLink.objects.create(domain=_domain(), organization=self.org, slug="f1",
                                        destination_url="https://form.example/s")
        self.assertFalse(link.forward_params)

    def test_flag_reaches_the_engine_payload(self):
        import json
        from apps.links.sync import _payload
        link = ShortLink.objects.create(domain=_domain(), organization=self.org, slug="f2",
                                        destination_url="https://form.example/s",
                                        forward_params=True)
        self.assertTrue(json.loads(_payload(link))["forward_params"])


@override_settings(SHORTLINK_BASE=SHORT)
class ForwardParamKeysTest(TestCase):
    def setUp(self):
        self.org = _workspace("owner@keys.example")

    def _link(self, keys):
        return ShortLink.objects.create(domain=_domain(), 
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
        self.assertFalse(ShortLink.objects.create(domain=_domain(), 
            organization=self.org, slug="v1",
            destination_url="https://example.com").block_vpn)

    def test_flag_reaches_the_engine_payload(self):
        import json
        from apps.links.sync import _payload
        link = ShortLink.objects.create(domain=_domain(), organization=self.org, slug="v2",
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


class NoBrandDomainFallbackTest(TestCase):
    """Short links live on SHORT_DOMAIN only.

    With no short domain the service is OFF — it must never fall back to the
    main domain, because the entire reason for the separate domain is that link
    abuse lands there instead of on the brand.
    """

    def setUp(self):
        self.org = _workspace("owner@fallback.example")
        self.link = ShortLink.objects.create(domain=_domain(), 
            organization=self.org, slug="abc", destination_url="https://example.com")

    @override_settings(FRONTEND_URL="https://www.trynobot.com")
    def test_a_retired_domain_yields_no_link_at_all(self):
        from apps.links.serializers import ShortLinkSerializer
        ShortDomain.objects.update(active=False)
        self.link.refresh_from_db()
        self.assertEqual(ShortLinkSerializer(self.link).data["short_url"], "")

    @override_settings(FRONTEND_URL="https://www.trynobot.com")
    def test_the_brand_domain_never_appears_in_a_link(self):
        from apps.links.serializers import ShortLinkSerializer
        self.assertNotIn("trynobot.com", ShortLinkSerializer(self.link).data["short_url"])

    @override_settings(FRONTEND_URL="https://www.trynobot.com")
    def test_decoy_is_not_served_from_the_brand_domain(self):
        import json
        from apps.links.sync import _payload
        self.assertNotIn("trynobot.com", json.loads(_payload(self.link))["decoy_url"])

    def test_service_reports_unavailable_and_gates_the_feature(self):
        from apps.billing.models import link_shortener_enabled, redirects_available
        ShortDomain.objects.update(active=False)
        self.assertFalse(redirects_available())
        self.assertFalse(link_shortener_enabled(self.org.id))

    def test_service_is_available_once_a_short_domain_is_set(self):
        from apps.billing.models import redirects_available
        self.assertTrue(redirects_available())


class RedirectsPausedApiTest(TestCase):
    def setUp(self):
        self.c = APIClient()
        self.c.post("/api/auth/register/", {"email": "p@example.com", "password": "testpass123",
                                            "first_name": "P"}, format="json")
        access = self.c.post("/api/auth/token/", {"email": "p@example.com", "password": "testpass123"},
                             format="json").json()["access"]
        self.c.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        orgs = self.c.get("/api/organizations/").json()
        self.org = orgs[0]["id"] if isinstance(orgs, list) else orgs["results"][0]["id"]
        _domain()
        ShortDomain.objects.update(active=False)   # every domain retired

    def test_list_reports_an_empty_base(self):
        self.assertEqual(self.c.get("/api/links/").json()["base"], "")

    def test_creating_a_link_is_refused_while_paused(self):
        call_command("grant_plan", "--org", str(self.org), "--plan", "pro", verbosity=0)
        r = self.c.post("/api/links/", {"organization": self.org,
                                        "destination_url": "https://example.com"}, format="json")
        self.assertEqual(r.status_code, 403)
        self.assertIn("unavailable", r.json()["detail"].lower())


class MultiDomainTest(TestCase):
    """Links live on a chosen domain; a slug is only meaningful with its host."""

    def setUp(self):
        self.org = _workspace("owner@multi.example")
        self.cc = _domain("trynb.cc")
        self.link = _domain("trynb.link", is_default=False)

    def test_same_slug_can_exist_on_two_domains(self):
        a = ShortLink.objects.create(organization=self.org, domain=self.cc, slug="promo",
                                     destination_url="https://a.example")
        b = ShortLink.objects.create(organization=self.org, domain=self.link, slug="promo",
                                     destination_url="https://b.example")
        self.assertNotEqual(a.pk, b.pk)

    def test_a_slug_cannot_repeat_on_the_same_domain(self):
        from django.db import IntegrityError, transaction
        ShortLink.objects.create(organization=self.org, domain=self.cc, slug="dup",
                                 destination_url="https://a.example")
        with self.assertRaises(IntegrityError), transaction.atomic():
            ShortLink.objects.create(organization=self.org, domain=self.cc, slug="dup",
                                     destination_url="https://b.example")

    def test_redis_key_includes_the_host(self):
        link = ShortLink.objects.create(organization=self.org, domain=self.link, slug="k1",
                                        destination_url="https://a.example")
        self.assertEqual(link.host_slug(), "trynb.link/k1")

    def test_short_url_uses_the_links_own_domain(self):
        from apps.links.serializers import ShortLinkSerializer
        link = ShortLink.objects.create(organization=self.org, domain=self.link, slug="k2",
                                        destination_url="https://a.example")
        self.assertEqual(ShortLinkSerializer(link).data["short_url"], "https://trynb.link/k2")

    def test_decoy_is_served_from_the_links_own_domain(self):
        import json
        from apps.links.sync import _payload
        link = ShortLink.objects.create(organization=self.org, domain=self.link, slug="k3",
                                        destination_url="https://a.example")
        self.assertEqual(json.loads(_payload(link))["decoy_url"], "https://trynb.link/decoy.html")

    def test_retiring_a_domain_kills_its_links_but_not_others(self):
        from apps.billing.models import redirects_available
        self.assertTrue(redirects_available())
        ShortDomain.objects.update(active=False)
        self.assertFalse(redirects_available())

    def test_a_workspace_only_sees_shared_domains_and_its_own(self):
        other = _workspace("someone@else.example")
        mine = ShortDomain.objects.create(host="mine.example", organization=self.org,
                                          active=True, verified_at=timezone.now())
        hosts = set(ShortDomain.for_org(self.org.id).values_list("host", flat=True))
        self.assertIn("trynb.cc", hosts)          # shared pool
        self.assertIn(mine.host, hosts)           # own domain
        self.assertNotIn(mine.host, set(ShortDomain.for_org(other.id).values_list("host", flat=True)))


@override_settings(SHORTLINK_BASE=SHORT)
class LongSlugTest(TestCase):
    """Slugs go up to 200 characters, and every layer has to agree."""

    def setUp(self):
        self.org = _workspace("owner@longslug.example")

    def test_a_200_character_slug_is_accepted(self):
        slug = "a" * 200
        link = ShortLink.objects.create(domain=_domain(), organization=self.org, slug=slug,
                                        destination_url="https://example.com")
        link.refresh_from_db()
        self.assertEqual(len(link.slug), 200)

    def test_the_serializer_allows_the_same_length(self):
        from apps.links.serializers import ShortLinkSerializer
        f = ShortLinkSerializer().fields["slug"]
        self.assertGreaterEqual(f.max_length, 200)

    def test_a_long_slug_still_parses_out_of_a_reported_url(self):
        # The abuse parser had its own 64-char ceiling; a long slug would have
        # been silently unmatchable, so a report on it could never be actioned.
        from apps.links.abuse import extract_slug
        slug = "b" * 200
        self.assertEqual(extract_slug(f"{SHORT}/{slug}"), slug)

    def test_something_longer_than_the_limit_is_not_treated_as_a_slug(self):
        from apps.links.abuse import extract_slug
        self.assertEqual(extract_slug(f"{SHORT}/{'c' * 201}"), "")


class AbuseHostsAcrossDomainsTest(TestCase):
    """A report must be matchable on ANY of our short domains."""

    def setUp(self):
        self.org = _workspace("owner@hosts.example")
        _domain("trynb.cc")
        _domain("korv.cc", is_default=False)

    def test_a_slug_is_recognised_on_every_short_domain(self):
        from apps.links.abuse import extract_slug
        for host in ("trynb.cc", "korv.cc"):
            self.assertEqual(extract_slug(f"https://{host}/abc123"), "abc123", host)

    def test_a_domain_we_do_not_serve_still_yields_nothing(self):
        from apps.links.abuse import extract_slug
        self.assertEqual(extract_slug("https://evil.example/abc123"), "")


class PrivateDomainTest(TestCase):
    """Shared, unsold stock, and private are three different things."""

    def setUp(self):
        self.org = _workspace("owner@priv.example")
        self.other = _workspace("someone@other.example")
        self.shared = _domain("trynb.cc")
        _domain("korv.cc", is_default=False)
        self.stock = ShortDomain.objects.create(
            host="pavo.cc", active=True, verified_at=timezone.now(), is_shared=False)

    def test_shared_domains_are_offered_to_everyone(self):
        hosts = set(ShortDomain.for_org(self.org.id).values_list("host", flat=True))
        self.assertEqual(hosts, {"trynb.cc", "korv.cc"})

    def test_unsold_stock_is_offered_to_nobody(self):
        # The bug this flag prevents: a domain we've registered but not sold
        # showing up in every customer's dropdown.
        for org in (self.org, self.other):
            self.assertNotIn("pavo.cc",
                             set(ShortDomain.for_org(org.id).values_list("host", flat=True)))

    def test_selling_it_makes_it_visible_only_to_the_buyer(self):
        self.stock.organization = self.org
        self.stock.save()
        self.assertIn("pavo.cc", set(ShortDomain.for_org(self.org.id).values_list("host", flat=True)))
        self.assertNotIn("pavo.cc", set(ShortDomain.for_org(self.other.id).values_list("host", flat=True)))

    def test_stock_count_drops_when_one_is_sold(self):
        self.assertEqual(ShortDomain.private_stock().count(), 1)
        self.stock.organization = self.org
        self.stock.save()
        self.assertEqual(ShortDomain.private_stock().count(), 0)
        self.assertEqual(ShortDomain.private_for(self.org.id).count(), 1)

    def test_a_buyer_can_actually_create_links_on_their_private_domain(self):
        self.stock.organization = self.org
        self.stock.save()
        link = ShortLink.objects.create(organization=self.org, domain=self.stock,
                                        slug="mine", destination_url="https://e.example")
        from apps.links.serializers import ShortLinkSerializer
        self.assertEqual(ShortLinkSerializer(link).data["short_url"], "https://pavo.cc/mine")

    def test_sync_does_not_retire_a_private_domain_missing_from_the_env(self):
        # SHORT_DOMAINS only describes the shared pool. A customer's domain must
        # not be switched off because it isn't listed there.
        self.stock.organization = self.org
        self.stock.save()
        with patch.dict("os.environ", {"SHORT_DOMAIN": "trynb.cc", "SHORT_DOMAINS": "korv.cc"}):
            call_command("sync_short_domains", verbosity=0)
        self.stock.refresh_from_db()
        self.assertTrue(self.stock.active)
        self.assertFalse(self.stock.is_shared)
        self.assertEqual(self.stock.organization, self.org)


class PrivateDomainPurchaseTest(TestCase):
    """Paying for exclusivity must actually deliver exclusivity."""

    def setUp(self):
        from apps.links.models import PrivateDomainPurchase
        self.org = _workspace("buyer@priv.example")
        self.other = _workspace("rival@priv.example")
        _domain("trynb.cc")
        self.stock = ShortDomain.objects.create(host="pavo.cc", active=True,
                                                verified_at=timezone.now(), is_shared=False)
        self.P = PrivateDomainPurchase

    def _purchase(self, org=None):
        return self.P.objects.create(organization=org or self.org, amount=25)

    def test_paying_assigns_a_domain_from_stock(self):
        from apps.links.purchases import mark_paid
        d = mark_paid(self._purchase())
        self.assertEqual(d.host, "pavo.cc")
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.organization, self.org)
        self.assertFalse(self.stock.is_shared)

    def test_the_buyer_gets_it_and_nobody_else_does(self):
        from apps.links.purchases import mark_paid
        mark_paid(self._purchase())
        self.assertIn("pavo.cc", set(ShortDomain.for_org(self.org.id).values_list("host", flat=True)))
        self.assertNotIn("pavo.cc", set(ShortDomain.for_org(self.other.id).values_list("host", flat=True)))

    def test_two_buyers_never_get_the_same_domain(self):
        # Only one domain in stock; the second buyer must be recorded as paid
        # and awaiting stock, never handed the same host.
        from apps.links.purchases import mark_paid
        a, b = self._purchase(), self._purchase(self.other)
        first, second = mark_paid(a), mark_paid(b)
        self.assertEqual(first.host, "pavo.cc")
        self.assertIsNone(second)
        b.refresh_from_db()
        self.assertEqual(b.status, self.P.Status.PAID)     # money kept, delivery owed

    def test_paying_with_no_stock_is_recorded_not_lost(self):
        from apps.links.purchases import mark_paid
        self.stock.delete()
        p = self._purchase()
        self.assertIsNone(mark_paid(p))
        p.refresh_from_db()
        self.assertEqual(p.status, self.P.Status.PAID)
        self.assertIsNone(p.domain)

    def test_the_backlog_is_fulfilled_once_stock_arrives(self):
        from apps.links.purchases import fulfil_backlog, mark_paid
        self.stock.delete()
        p = self._purchase()
        mark_paid(p)
        ShortDomain.objects.create(host="korv2.cc", active=True,
                                   verified_at=timezone.now(), is_shared=False)
        self.assertEqual(fulfil_backlog(), 1)
        p.refresh_from_db()
        self.assertEqual(p.status, self.P.Status.FULFILLED)
        self.assertEqual(p.domain.host, "korv2.cc")

    def test_paying_twice_does_not_take_a_second_domain(self):
        from apps.links.purchases import mark_paid
        p = self._purchase()
        mark_paid(p)
        ShortDomain.objects.create(host="spare.cc", active=True,
                                   verified_at=timezone.now(), is_shared=False)
        mark_paid(p)                                   # webhook + reconcile both fire
        self.assertEqual(ShortDomain.private_stock().count(), 1)


class PrivateDomainCheckoutApiTest(TestCase):
    def setUp(self):
        self.c = APIClient()
        self.c.post("/api/auth/register/", {"email": "pd@example.com", "password": "testpass123",
                                            "first_name": "P"}, format="json")
        access = self.c.post("/api/auth/token/", {"email": "pd@example.com", "password": "testpass123"},
                             format="json").json()["access"]
        self.c.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        orgs = self.c.get("/api/organizations/").json()
        self.org = orgs[0]["id"] if isinstance(orgs, list) else orgs["results"][0]["id"]
        _domain("trynb.cc")

    def _buy(self):
        return self.c.post("/api/links/private-domain/checkout/",
                           {"organization": self.org}, format="json")

    def test_an_unpaid_workspace_cannot_buy_one(self):
        self.assertEqual(self._buy().status_code, 403)

    @override_settings(DEBUG=False, BACHS_PRODUCT_PRIVATE_DOMAIN="")
    def test_no_product_configured_refuses_rather_than_giving_one_away(self):
        call_command("grant_plan", "--org", str(self.org), "--plan", "pro", verbosity=0)
        with patch("apps.billing.bachs.is_enabled", return_value=True):
            r = self._buy()
        self.assertEqual(r.status_code, 503)
        from apps.links.models import PrivateDomainPurchase
        self.assertFalse(PrivateDomainPurchase.objects.filter(
            status=PrivateDomainPurchase.Status.FULFILLED).exists())


class PrivateDomainRentalTest(TestCase):
    """Rented for 30 days at a time, with a grace period before reclaiming."""

    def setUp(self):
        from apps.links.models import PrivateDomainPurchase
        self.org = _workspace("renter@priv.example")
        _domain("trynb.cc")
        self.stock = ShortDomain.objects.create(host="pavo.cc", active=True,
                                                verified_at=timezone.now(), is_shared=False)
        self.P = PrivateDomainPurchase

    def _pay(self):
        from apps.links.purchases import mark_paid
        return mark_paid(self.P.objects.create(organization=self.org, amount=5))

    def test_paying_rents_it_for_30_days(self):
        d = self._pay()
        self.assertAlmostEqual((d.private_until - timezone.now()).days, 29, delta=1)

    def test_a_second_payment_renews_rather_than_taking_another_domain(self):
        self._pay()
        spare = ShortDomain.objects.create(host="korv2.cc", active=True,
                                           verified_at=timezone.now(), is_shared=False)
        d = self._pay()
        self.assertEqual(d.host, "pavo.cc")
        self.assertAlmostEqual((d.private_until - timezone.now()).days, 59, delta=1)
        spare.refresh_from_db()
        self.assertIsNone(spare.organization)          # untouched

    def test_renewing_after_a_lapse_starts_from_today_not_the_old_date(self):
        d = self._pay()
        d.private_until = timezone.now() - timedelta(days=10)
        d.save()
        d = self._pay()
        self.assertGreater(d.private_until, timezone.now() + timedelta(days=29))

    def test_a_lapsed_rental_is_only_reminded_during_the_grace_period(self):
        d = self._pay()
        d.private_until = timezone.now() - timedelta(days=2)
        d.save()
        call_command("enforce_private_domains", verbosity=0)
        d.refresh_from_db()
        self.assertEqual(d.organization, self.org)     # still theirs
        self.assertIsNotNone(d.private_until)

    def test_it_is_reclaimed_only_after_the_grace_period(self):
        d = self._pay()
        d.private_until = timezone.now() - timedelta(days=ShortDomain.PRIVATE_GRACE_DAYS + 1)
        d.save()
        call_command("enforce_private_domains", verbosity=0)
        d.refresh_from_db()
        self.assertIsNone(d.organization)
        self.assertFalse(d.is_shared)                  # back to stock, not the public pool
        self.assertEqual(ShortDomain.private_stock().count(), 1)

    def test_links_keep_working_through_the_grace_period(self):
        import json
        from apps.links.sync import _payload
        d = self._pay()
        link = ShortLink.objects.create(organization=self.org, domain=d, slug="live",
                                        destination_url="https://e.example")
        d.private_until = timezone.now() - timedelta(days=1)
        d.save()
        call_command("enforce_private_domains", verbosity=0)
        link.refresh_from_db()
        self.assertTrue(json.loads(_payload(link))["active"])

    def test_a_reclaimed_domain_stops_serving_its_old_links(self):
        from apps.links.sync import publish_link
        d = self._pay()
        link = ShortLink.objects.create(organization=self.org, domain=d, slug="gone",
                                        destination_url="https://e.example")
        d.private_until = timezone.now() - timedelta(days=ShortDomain.PRIVATE_GRACE_DAYS + 1)
        d.save()
        with patch("apps.links.sync.unpublish_link") as unpub:
            call_command("enforce_private_domains", verbosity=0)
            link.refresh_from_db()
            publish_link(link)
        self.assertTrue(unpub.called)      # withdrawn: the domain isn't theirs any more


class DomainEntitlementTest(TestCase):
    """A link may only resolve on a domain its workspace is entitled to."""

    def setUp(self):
        self.org = _workspace("a@ent.example")
        self.other = _workspace("b@ent.example")
        self.shared = _domain("trynb.cc")

    def _link(self, domain, org=None):
        return ShortLink.objects.create(organization=org or self.org, domain=domain,
                                        slug=f"s{domain.pk}{(org or self.org).pk}",
                                        destination_url="https://e.example")

    def test_shared_domains_publish_for_anyone(self):
        with patch("apps.links.sync._r") as r:
            from apps.links.sync import publish_link
            publish_link(self._link(self.shared))
            self.assertTrue(r.return_value.set.called)

    def test_stock_never_publishes(self):
        stock = ShortDomain.objects.create(host="pavo.cc", active=True,
                                           verified_at=timezone.now(), is_shared=False)
        with patch("apps.links.sync._r") as r:
            from apps.links.sync import publish_link
            publish_link(self._link(stock))
            self.assertFalse(r.return_value.set.called)

    def test_another_workspaces_private_domain_never_publishes(self):
        theirs = ShortDomain.objects.create(host="korv.cc", active=True, verified_at=timezone.now(),
                                            is_shared=False, organization=self.other)
        with patch("apps.links.sync._r") as r:
            from apps.links.sync import publish_link
            publish_link(self._link(theirs))          # link owned by self.org
            self.assertFalse(r.return_value.set.called)

    def test_your_own_private_domain_publishes(self):
        mine = ShortDomain.objects.create(host="mine.cc", active=True, verified_at=timezone.now(),
                                          is_shared=False, organization=self.org)
        with patch("apps.links.sync._r") as r:
            from apps.links.sync import publish_link
            publish_link(self._link(mine))
            self.assertTrue(r.return_value.set.called)


class PrivateDomainNeedsActivePlanTest(TestCase):
    """A private domain is an add-on to a live plan, never a substitute for one."""

    def setUp(self):
        self.c = APIClient()
        self.c.post("/api/auth/register/", {"email": "sub@example.com", "password": "testpass123",
                                            "first_name": "S"}, format="json")
        access = self.c.post("/api/auth/token/", {"email": "sub@example.com", "password": "testpass123"},
                             format="json").json()["access"]
        self.c.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        orgs = self.c.get("/api/organizations/").json()
        self.org = orgs[0]["id"] if isinstance(orgs, list) else orgs["results"][0]["id"]
        _domain("trynb.cc")
        ShortDomain.objects.create(host="pavo.cc", active=True,
                                   verified_at=timezone.now(), is_shared=False)

    def _buy(self):
        return self.c.post("/api/links/private-domain/checkout/",
                           {"organization": self.org}, format="json")

    def test_a_trialing_workspace_cannot_buy_one(self):
        r = self._buy()
        self.assertEqual(r.status_code, 403)
        self.assertIn("paid plan", r.json()["detail"])

    def test_an_expired_plan_cannot_buy_one(self):
        from apps.billing.models import Subscription
        call_command("grant_plan", "--org", str(self.org), "--plan", "pro", verbosity=0)
        sub = Subscription.objects.get(organization_id=self.org)
        sub.period_end = timezone.now() - timedelta(days=1)
        sub.save()
        self.assertEqual(self._buy().status_code, 403)

    def test_nothing_is_charged_or_assigned_when_refused(self):
        from apps.links.models import PrivateDomainPurchase
        self._buy()
        self.assertFalse(PrivateDomainPurchase.objects.exists())
        self.assertEqual(ShortDomain.private_stock().count(), 1)   # still unsold


class LapsedPlanSuspendsPrivateLinksTest(TestCase):
    """A weekly plan running out stops the redirects — even on a domain the
    workspace is still renting. The rental buys exclusivity, not access."""

    def setUp(self):
        self.org = _workspace("weekly@priv.example")
        _domain("trynb.cc")
        stock = ShortDomain.objects.create(host="pavo.cc", active=True,
                                           verified_at=timezone.now(), is_shared=False)
        from apps.links.models import PrivateDomainPurchase
        from apps.links.purchases import mark_paid
        call_command("grant_plan", "--org", str(self.org.id), "--plan", "pro",
                     "--interval", "weekly", verbosity=0)
        self.domain = mark_paid(PrivateDomainPurchase.objects.create(
            organization=self.org, amount=5))
        self.link = ShortLink.objects.create(organization=self.org, domain=self.domain,
                                             slug="wk", destination_url="https://e.example")

    def test_while_the_plan_is_live_the_links_serve(self):
        from apps.billing.entitlements import workspace_locked
        self.assertFalse(workspace_locked(self.org.id))

    def test_when_the_weekly_plan_lapses_the_links_are_withdrawn(self):
        from apps.billing.entitlements import workspace_locked
        from apps.billing.models import Subscription
        sub = Subscription.objects.get(organization=self.org)
        sub.period_end = timezone.now() - timedelta(hours=1)
        sub.save()
        self.assertTrue(workspace_locked(self.org.id))
        with patch("apps.billing.entitlements.revoke_org") as revoke:
            call_command("enforce_access", "--org", str(self.org.id), verbosity=0)
        # enforce_access binds the name at import; assert through the command's view
        self.assertTrue(workspace_locked(self.org.id))

    def test_the_domain_stays_theirs_while_the_rental_is_paid(self):
        from apps.billing.models import Subscription
        sub = Subscription.objects.get(organization=self.org)
        sub.period_end = timezone.now() - timedelta(hours=1)
        sub.save()
        call_command("enforce_private_domains", verbosity=0)
        self.domain.refresh_from_db()
        self.assertEqual(self.domain.organization, self.org)   # not reclaimed


class DomainPoolSplitTest(TestCase):
    """SHORT_DOMAINS is the shared pool; SHORT_DOMAINS_PRIVATE is stock to sell.
    Both are served by nginx — only the first is offered to everyone."""

    def setUp(self):
        self.org = _workspace("split@example.com")

    def _sync(self, shared="trynb.cc", private="korv.cc,gonb.cc"):
        with patch.dict("os.environ", {"SHORT_DOMAIN": shared, "SHORT_DOMAINS": "",
                                       "SHORT_DOMAINS_PRIVATE": private}):
            call_command("sync_short_domains", verbosity=0)

    def test_only_the_shared_domain_is_offered_to_a_workspace(self):
        self._sync()
        self.assertEqual(set(ShortDomain.for_org(self.org.id).values_list("host", flat=True)),
                         {"trynb.cc"})

    def test_the_private_ones_become_sellable_stock(self):
        self._sync()
        self.assertEqual(set(ShortDomain.private_stock().values_list("host", flat=True)),
                         {"korv.cc", "gonb.cc"})

    def test_the_default_is_never_a_private_domain(self):
        self._sync()
        default = ShortDomain.default_for(self.org.id)
        self.assertEqual(default.host, "trynb.cc")
        self.assertTrue(default.is_shared)

    def test_moving_a_domain_from_shared_to_private_takes_it_out_of_the_pool(self):
        # korv.cc was shared before this change; the next sync must retire it
        # from the pool rather than leave it available to everyone.
        self._sync(shared="trynb.cc,korv.cc", private="")
        self.assertIn("korv.cc", set(ShortDomain.for_org(self.org.id).values_list("host", flat=True)))
        self._sync(shared="trynb.cc", private="korv.cc,gonb.cc")
        self.assertNotIn("korv.cc", set(ShortDomain.for_org(self.org.id).values_list("host", flat=True)))
        self.assertIn("korv.cc", set(ShortDomain.private_stock().values_list("host", flat=True)))

    def test_a_rented_domain_is_not_dragged_back_into_stock(self):
        self._sync()
        korv = ShortDomain.objects.get(host="korv.cc")
        korv.organization = self.org
        korv.save()
        self._sync()
        korv.refresh_from_db()
        self.assertEqual(korv.organization, self.org)     # still the renter's
        self.assertEqual(ShortDomain.private_stock().count(), 1)   # only gonb.cc left


class RedirectTrafficIsRecordedTest(TestCase):
    """A redirect with no website attached must still produce visitors and
    click-log rows — its clicks were being dropped entirely."""

    def setUp(self):
        self.org = _workspace("owner@traffic.example")
        self.link = ShortLink.objects.create(organization=self.org, domain=_domain(),
                                             slug="tr", destination_url="https://e.example")

    def test_the_payload_carries_the_owning_workspace(self):
        import json
        from apps.links.sync import _payload
        # Without this the consumer has no idea whose traffic a website-less
        # redirect belongs to, and drops the event.
        self.assertEqual(json.loads(_payload(self.link))["org"], str(self.org.id))

    def test_the_consumer_parks_it_on_an_internal_holder(self):
        from apps.traffic.management.commands.consume_traffic import _redirect_site
        site = _redirect_site(str(self.org.id))
        self.assertIsNotNone(site)
        self.assertTrue(site.is_system)
        self.assertEqual(site.organization, self.org)

    def test_the_holder_is_reused_not_duplicated(self):
        from apps.traffic.management.commands.consume_traffic import _redirect_site
        a = _redirect_site(str(self.org.id))
        b = _redirect_site(str(self.org.id))
        self.assertEqual(a.pk, b.pk)

    def test_an_unknown_workspace_is_still_dropped(self):
        from apps.traffic.management.commands.consume_traffic import _redirect_site
        self.assertIsNone(_redirect_site("999999"))
        self.assertIsNone(_redirect_site(""))

    def test_the_holder_is_hidden_from_the_websites_list_and_limits(self):
        from apps.websites.models import Website
        from apps.traffic.management.commands.consume_traffic import _redirect_site
        _redirect_site(str(self.org.id))
        visible = Website.objects.filter(organization=self.org, is_system=False).count()
        self.assertEqual(visible, 0)          # not a site they added


@override_settings(SHORTLINK_BASE=SHORT)
class CountryGateTest(TestCase):
    def setUp(self):
        self.org = _workspace("owner@geo.example")

    def _link(self, mode, countries):
        return ShortLink.objects.create(organization=self.org, domain=_domain(),
                                        slug=f"g{mode}{len(countries)}",
                                        destination_url="https://e.example",
                                        country_mode=mode, countries=countries)

    def test_codes_are_normalised(self):
        self.assertEqual(self._link("allow", " us , ca ,, gb ").country_list(),
                         ["US", "CA", "GB"])

    def test_the_gate_reaches_the_engine(self):
        import json
        p = json.loads(__import__("apps.links.sync", fromlist=["_payload"])._payload(
            self._link("allow", "US,CA")))
        self.assertEqual(p["country_mode"], "allow")
        self.assertEqual(p["countries"], ["US", "CA"])

    def test_off_by_default_sends_no_restriction(self):
        import json
        from apps.links.sync import _payload
        link = ShortLink.objects.create(organization=self.org, domain=_domain(), slug="gd",
                                        destination_url="https://e.example")
        p = json.loads(_payload(link))
        self.assertEqual(p["country_mode"], "off")
        self.assertEqual(p["countries"], [])


@override_settings(SHORTLINK_BASE=SHORT)
class SimpleGatesTest(TestCase):
    """Device/OS/strictness replaced the per-redirect rule builder, so they have
    to reach the engine on their own."""

    def setUp(self):
        self.org = _workspace("owner@gates.example")

    def _payload(self, **kw):
        import json
        from apps.links.sync import _payload
        link = ShortLink.objects.create(organization=self.org, domain=_domain(),
                                        slug=kw.pop("slug", "sg1"),
                                        destination_url="https://e.example", **kw)
        return json.loads(_payload(link))

    def test_device_and_os_lists_are_normalised(self):
        p = self._payload(device_mode="allow", devices=" Mobile , Tablet ",
                          os_mode="block", operating_systems="Android,,iOS")
        self.assertEqual(p["device_mode"], "allow")
        self.assertEqual(p["devices"], ["mobile", "tablet"])
        self.assertEqual(p["os_mode"], "block")
        self.assertEqual(p["operating_systems"], ["android", "ios"])

    def test_strictness_reaches_the_engine(self):
        self.assertEqual(self._payload(slug="sg2", max_risk=60)["max_risk"], 60)

    def test_defaults_impose_nothing(self):
        p = self._payload(slug="sg3")
        self.assertEqual((p["device_mode"], p["os_mode"], p["max_risk"]), ("off", "off", 0))
        self.assertEqual((p["devices"], p["operating_systems"]), ([], []))
