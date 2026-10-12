from contextlib import contextmanager
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from django.contrib.auth import get_user_model

from apps.organizations.models import create_workspace
from apps.websites.models import Website


class LiveStateTest(TestCase):
    """The badge is derived, not stored: a site that stops sending events has to
    stop claiming it's protected."""

    def setUp(self):
        user = get_user_model().objects.create_user(
            username="owner@state.example", email="owner@state.example",
            password="testpass123")
        self.org = create_workspace(user, "Acme")

    def _site(self, **kw):
        return Website.objects.create(organization=self.org, name="s",
                                      domain="e.example", **kw)

    def test_a_new_site_is_waiting_not_broken(self):
        self.assertEqual(self._site().live_state(), "waiting")

    def test_recent_traffic_reads_as_active(self):
        s = self._site(last_event_at=timezone.now() - timedelta(hours=2),
                       status=Website.Status.ACTIVE)
        self.assertEqual(s.live_state(), "active")

    def test_a_site_that_went_quiet_stops_saying_active(self):
        s = self._site(status=Website.Status.ACTIVE,
                       last_event_at=timezone.now() - timedelta(days=30))
        self.assertEqual(s.live_state(), "idle")

    def test_the_boundary_is_the_documented_window(self):
        just_inside = timezone.now() - timedelta(days=Website.IDLE_AFTER_DAYS - 1)
        self.assertEqual(self._site(last_event_at=just_inside).live_state(), "active")

    def test_error_wins_over_everything(self):
        s = self._site(status=Website.Status.ERROR, last_event_at=timezone.now())
        self.assertEqual(s.live_state(), "error")


class SafeBrowsingMonitorTest(TestCase):
    """Alert once when a site is newly flagged; clear (and notify) when it
    recovers; don't re-spam while it stays flagged."""

    def setUp(self):
        from django.contrib.auth import get_user_model
        from apps.organizations.models import create_workspace
        user = get_user_model().objects.create_user(
            username="owner@sb.example", email="owner@sb.example", password="testpass123")
        self.org = create_workspace(user, "Acme")
        self.site = Website.objects.create(organization=self.org, name="s", domain="flagged.example")

    def _run(self, threats):
        from unittest.mock import patch
        from django.core import mail
        mail.outbox = []
        with patch("apps.intelligence.threatscan._sb_key", return_value="k"), \
             patch("apps.intelligence.threatscan._safe_browsing", return_value=threats):
            from django.core.management import call_command
            call_command("check_safebrowsing", verbosity=0)
        self.site.refresh_from_db()
        return mail.outbox

    def test_new_flag_sets_state_and_emails_owner(self):
        out = self._run(["SOCIAL_ENGINEERING"])
        self.assertTrue(self.site.safe_browsing_flagged)
        self.assertEqual(self.site.safe_browsing_threats, ["SOCIAL_ENGINEERING"])
        self.assertEqual(len(out), 1)
        self.assertIn("flagged.example", out[0].subject)
        self.assertEqual(out[0].to, ["owner@sb.example"])

    def test_staying_flagged_does_not_re_notify(self):
        self._run(["MALWARE"])
        out = self._run(["MALWARE"])          # still flagged on the next run
        self.assertTrue(self.site.safe_browsing_flagged)
        self.assertEqual(len(out), 0)

    def test_recovery_clears_and_notifies(self):
        self._run(["MALWARE"])
        out = self._run([])                    # clean now
        self.assertFalse(self.site.safe_browsing_flagged)
        self.assertEqual(self.site.safe_browsing_threats, [])
        self.assertEqual(len(out), 1)
        self.assertIn("clear", out[0].subject.lower())

    def test_system_sites_are_skipped(self):
        Website.objects.filter(pk=self.site.pk).update(is_system=True)
        self._run(["MALWARE"])
        self.site.refresh_from_db()
        self.assertIsNone(self.site.safe_browsing_checked_at)


class SnippetCheckTest(TestCase):
    """The active check is the whole point of the upgrade: it must tell a
    'wrong file' install (snippet missing from the served page) apart from a
    'not visited yet' one, without ever being fooled into 'found' by traffic
    alone or by another workspace's tag."""

    def setUp(self):
        user = get_user_model().objects.create_user(
            username="own@snip.example", email="own@snip.example", password="testpass123")
        self.org = create_workspace(user, "Acme")
        self.site = Website.objects.create(organization=self.org, name="s",
                                           domain="site.example", url="https://site.example/")

    def _page(self, tid=None):
        tid = tid if tid is not None else self.site.tracking_id
        return (f'<!doctype html><html><head>'
                f'<script async src="https://trynobot.com/bl.js" data-site-id="{tid}"></script>'
                f'</head><body>hi</body></html>')

    @contextmanager
    def _patch_fetch(self, *, status=200, body="", final="https://site.example/"):
        """Stub BOTH _validate and _fetch. site.example doesn't resolve, so
        without stubbing _validate the check bails as 'unreachable' before the
        fetch we're trying to exercise. Yields the _fetch mock for call asserts."""
        from unittest.mock import patch
        with patch("apps.websites.snippet_check._validate",
                   return_value=("https://site.example/", None)), \
             patch("apps.websites.snippet_check._fetch",
                   return_value=(status, {}, body, final)) as m:
            yield m

    # --- the module ---
    def test_snippet_present_matches_this_sites_id(self):
        from apps.websites import snippet_check
        self.assertTrue(snippet_check._snippet_present(self._page(), self.site.tracking_id))

    def test_another_workspaces_snippet_is_not_ours(self):
        """A page carrying some other site's tag must read as MISSING, or we'd
        tell a customer they're installed when they've pasted the wrong id."""
        from apps.websites import snippet_check
        self.assertFalse(snippet_check._snippet_present(self._page("st_someoneelse"),
                                                        self.site.tracking_id))

    def test_found_when_tag_is_on_the_page(self):
        from apps.websites import snippet_check
        with self._patch_fetch(body=self._page()):
            self.assertEqual(snippet_check.check(self.site)["state"], snippet_check.FOUND)

    def test_missing_when_page_loads_without_the_tag(self):
        from apps.websites import snippet_check
        with self._patch_fetch(body="<html><head></head><body>no tag here</body></html>"):
            self.assertEqual(snippet_check.check(self.site)["state"], snippet_check.MISSING)

    def test_unreachable_when_fetch_raises(self):
        from unittest.mock import patch
        from apps.websites import snippet_check
        with patch("apps.websites.snippet_check._fetch", side_effect=OSError("boom")):
            self.assertEqual(snippet_check.check(self.site)["state"], snippet_check.UNREACHABLE)

    def test_no_url_when_site_has_neither_url_nor_domain(self):
        from apps.websites import snippet_check
        self.site.url = ""
        self.site.domain = ""
        self.assertEqual(snippet_check.check(self.site)["state"], snippet_check.NO_URL)

    def test_falls_back_to_domain_when_no_explicit_url(self):
        from apps.websites import snippet_check
        self.site.url = ""
        with self._patch_fetch(body=self._page()) as m:
            snippet_check.check(self.site)
        self.assertTrue(m.call_args[0][0].startswith("https://site.example"))

    # --- the endpoint ---
    def _verify(self):
        from rest_framework.test import APIClient
        c = APIClient()
        c.force_authenticate(user=get_user_model().objects.get(username="own@snip.example"))
        return c.post(f"/api/websites/{self.site.id}/verify/")

    def test_verify_reports_missing_snippet(self):
        with self._patch_fetch(body="<html><head></head><body>nope</body></html>"):
            r = self._verify()
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.json()["installed"])
        self.assertEqual(r.json()["snippet_state"], "missing")
        self.assertIn("isn't in the page", r.json()["message"])

    def test_verify_reports_found_but_waiting(self):
        with self._patch_fetch(body=self._page()):
            r = self._verify()
        self.assertEqual(r.json()["snippet_state"], "found")
        self.assertFalse(r.json()["installed"])

    def test_verify_short_circuits_once_an_event_arrived(self):
        """A live event is proof enough — don't even fetch the page."""
        from unittest.mock import patch
        self.site.last_event_at = timezone.now()
        self.site.save(update_fields=["last_event_at"])
        with patch("apps.websites.snippet_check.check") as probe:
            r = self._verify()
        probe.assert_not_called()
        self.assertTrue(r.json()["installed"])


class StrictModeTest(TestCase):
    """Strict mode is the only protection a plain HTML page on a static host
    gets, and it is now switchable from the dashboard — so the API has to accept
    the change and the snippet has to actually reflect it."""

    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="owner@strict.example", email="owner@strict.example",
            password="testpass123")
        self.org = create_workspace(self.user, "Strict Co")
        self.site = Website.objects.create(organization=self.org, name="s",
                                           domain="strict.example")
        from rest_framework.test import APIClient
        self.c = APIClient()
        self.c.force_authenticate(user=self.user)

    def _snippet(self):
        from apps.websites.serializers import WebsiteSerializer
        self.site.refresh_from_db()
        return WebsiteSerializer(self.site).data["snippet"]

    def test_off_by_default_so_existing_sites_are_unchanged(self):
        self.assertFalse(self.site.strict_mode)
        self.assertIn("async", self._snippet())
        self.assertNotIn("data-strict", self._snippet())

    def test_strict_snippet_drops_async_and_adds_the_flag(self):
        # async can't hide the page before it paints, which is the whole point.
        self.site.strict_mode = True
        self.site.save(update_fields=["strict_mode"])
        snippet = self._snippet()
        self.assertIn('data-strict="1"', snippet)
        self.assertNotIn("async", snippet)
        self.assertIn(self.site.tracking_id, snippet)

    def test_an_owner_can_turn_it_on_through_the_api(self):
        # What the new dashboard toggle does.
        r = self.c.patch(f"/api/websites/{self.site.id}/",
                              {"strict_mode": True}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.site.refresh_from_db()
        self.assertTrue(self.site.strict_mode)
        self.assertIn('data-strict="1"', r.json()["snippet"])

    def test_it_can_be_turned_back_off(self):
        self.site.strict_mode = True
        self.site.save(update_fields=["strict_mode"])
        r = self.c.patch(f"/api/websites/{self.site.id}/",
                              {"strict_mode": False}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.site.refresh_from_db()
        self.assertFalse(self.site.strict_mode)

    def test_an_analyst_cannot_flip_it(self):
        from rest_framework.test import APIClient
        from apps.organizations.models import OrganizationMember, Role
        other = get_user_model().objects.create_user(
            username="analyst@strict.example", email="analyst@strict.example",
            password="testpass123")
        OrganizationMember.objects.create(organization=self.org, user=other,
                                          role=Role.ANALYST)
        c = APIClient()
        c.force_authenticate(user=other)
        r = c.patch(f"/api/websites/{self.site.id}/",
                              {"strict_mode": True}, format="json")
        self.assertEqual(r.status_code, 403, r.content)
        self.site.refresh_from_db()
        self.assertFalse(self.site.strict_mode)


class VerifyShieldTest(TestCase):
    """Verification has to recognise BOTH installs.

    Regression: it only looked for type='server_check', which the server-side
    Shield emits. The browser install — the only option for a plain .html file
    on a host that runs no code — emits pageviews and never produces one. So
    anyone who correctly followed the "Single HTML file" instructions was told
    their install had failed, and the suggested fix (install the server-side
    Shield) was something a static host cannot do.
    """

    def setUp(self):
        from rest_framework.test import APIClient
        self.user = get_user_model().objects.create_user(
            username="owner@shield.example", email="owner@shield.example",
            password="testpass123")
        self.org = create_workspace(self.user, "Shield Co")
        self.site = Website.objects.create(organization=self.org, name="s",
                                           domain="shield.example")
        self.c = APIClient()
        self.c.force_authenticate(user=self.user)

    def _event(self, type_):
        from apps.traffic.models import Visitor, Session, TrafficEvent
        v = Visitor.objects.create(website=self.site, visitor_id=f"v-{type_}")
        s = Session.objects.create(website=self.site, visitor=v, session_id=f"s-{type_}")
        return TrafficEvent.objects.create(website=self.site, visitor=v, session=s,
                                           type=type_, created_at=timezone.now())

    def _verify(self, expecting):
        r = self.c.post(f"/api/websites/{self.site.id}/verify-shield/",
                        {"expecting": expecting}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        return r.json()

    def test_single_html_install_is_reported_as_working(self):
        # THE regression. Tracker events only, user is on the Single HTML tab.
        self._event("pageview")
        body = self._verify("browser")
        self.assertTrue(body["active"], "a correct single-HTML install was reported as failed")
        self.assertEqual(body["mode"], "browser")
        self.assertNotIn("Shield snippet", body["message"],
                         "told a static-host user to install something they cannot install")

    def test_server_install_still_verifies(self):
        self._event("server_check")
        body = self._verify("server")
        self.assertTrue(body["active"])
        self.assertEqual(body["mode"], "server")

    def test_a_failed_server_install_is_not_papered_over(self):
        # Tracker working but they were aiming for the server-side Shield: that
        # is a real failure and must still read as one, or they would believe
        # they had protection they do not have.
        self._event("pageview")
        body = self._verify("server")
        self.assertFalse(body["active"])
        self.assertTrue(body["browser_active"])
        self.assertFalse(body["server_active"])

    def test_server_checks_satisfy_the_browser_question_too(self):
        # A server-side install is strictly stronger; don't report it as missing.
        self._event("server_check")
        body = self._verify("browser")
        self.assertTrue(body["active"])
        self.assertEqual(body["mode"], "server")

    def test_nothing_installed_reads_as_nothing(self):
        for expecting in ("server", "browser"):
            body = self._verify(expecting)
            self.assertFalse(body["active"])
            self.assertEqual(body["mode"], "none")

    def test_defaults_to_server_when_not_told(self):
        # Older clients that don't send `expecting` keep the strict behaviour.
        self._event("pageview")
        r = self.c.post(f"/api/websites/{self.site.id}/verify-shield/", {}, format="json")
        self.assertFalse(r.json()["active"])
