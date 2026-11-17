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
        """Stub _fetch, which validates its own hops — site.example does not
        resolve, so the real one would bail as 'unreachable' before the fetch we
        are trying to exercise. Yields the mock for call asserts."""
        from unittest.mock import patch
        with patch("apps.websites.snippet_check._fetch",
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

    def test_the_snippet_on_the_page_verifies_the_install_by_itself(self):
        """The regression that made verification feel endless.

        A correct install used to be reported as NOT installed until a visitor
        happened to arrive, so the customer was told to go and load their own
        site and press the button again — on a site with no traffic yet, a loop
        with no exit. Reading our tag out of the served page settles it.
        """
        self.site.strict_mode = False
        self.site.save(update_fields=["strict_mode"])
        with self._patch_fetch(body=self._page()):
            r = self._verify()
        self.assertEqual(r.json()["snippet_state"], "found")
        self.assertTrue(r.json()["installed"])
        # And it must not tell them to go and generate traffic first.
        self.assertNotIn("verify again", r.json()["message"].lower())

    def test_a_verified_install_stays_verified_without_pressing_the_button_again(self):
        """It is recorded, so the next page load already knows. Without this the
        customer re-verifies the same working install every visit."""
        self.site.strict_mode = False
        self.site.save(update_fields=["strict_mode"])
        with self._patch_fetch(body=self._page()):
            self._verify()
        self.site.refresh_from_db()
        self.assertIsNotNone(self.site.snippet_seen_at)
        self.assertEqual(self.site.status, Website.Status.DETECTED)
        self.assertEqual(self.site.live_state(), "installed")

    def test_a_found_snippet_is_not_reported_as_waiting_for_a_visitor(self):
        """The badge must stop saying "waiting for first visitor" once we can
        see the tag — that phrasing reads as "your install didn't work"."""
        self.site.snippet_seen_at = timezone.now()
        self.site.save(update_fields=["snippet_seen_at"])
        self.assertEqual(self.site.live_state(), "installed")

    def test_strict_mode_problems_still_surface_on_a_snippet_only_verify(self):
        """Verifying without traffic must not become a way to skip the strict
        check — an async tag collects traffic fine and hides nothing."""
        async_page = (f'<script async src="https://trynobot.com/bl.js" '
                      f'data-site-id="{self.site.tracking_id}"></script>')
        with self._patch_fetch(body=async_page):
            r = self._verify()
        self.assertEqual(r.json()["snippet_state"], "found")
        self.assertEqual(r.json()["strict_state"], "async")
        self.assertFalse(r.json()["installed"])     # amber, not green

    def test_the_www_variant_is_tried_before_giving_up(self):
        """A customer who typed the apex while the tag is on www had a correct
        install reported as missing. We try the other half of the pair rather
        than making them guess."""
        from apps.websites import snippet_check
        from unittest.mock import patch
        self.site.url = "https://site.example/"

        def fake_fetch(url, **kw):
            if url.startswith("https://www.site.example"):
                return 200, {}, self._page(), url
            return 200, {}, "<html><head></head><body>nope</body></html>", url

        with patch("apps.websites.snippet_check._fetch", side_effect=fake_fetch):
            out = snippet_check.check(self.site)
        self.assertEqual(out["state"], snippet_check.FOUND)
        self.assertIn("www.site.example", out["checked_url"])

    def test_a_correct_install_still_costs_a_single_fetch(self):
        """The fallbacks must not slow down the common case: when the first
        address has the tag, nothing else is fetched."""
        from apps.websites import snippet_check
        with self._patch_fetch(body=self._page()) as m:
            snippet_check.check(self.site)
        self.assertEqual(m.call_count, 1)

    # --- how long it takes -------------------------------------------------
    #
    # Verification is a button someone presses right after pasting a snippet,
    # and the complaint about it was never that it was wrong — it was that it
    # took far longer than expected. These lock the bounds that fixed that, so
    # a later change to the probe cannot quietly give the minute back.

    def test_the_probe_is_given_a_tight_budget_not_the_report_one(self):
        """The Bot Check report can afford to wait eight seconds a hop and three
        hops a URL. This cannot: four URLs at that budget is about a minute of
        spinner."""
        from apps.websites import snippet_check
        with self._patch_fetch(body=self._page()) as m:
            snippet_check.check(self.site)
        kw = m.call_args.kwargs
        self.assertLessEqual(kw["timeout"], 5)
        self.assertLessEqual(kw["max_redirects"], 2)
        self.assertLessEqual(kw["max_bytes"], 300_000)

    def test_an_early_match_does_not_wait_for_the_slow_siblings(self):
        """The old version returned as soon as it found the tag, then blocked on
        the thread pool's exit until every other probe had finished anyway — so
        a www alternative on a dead host still cost the full timeout."""
        import time
        from unittest.mock import patch
        from apps.websites import snippet_check

        page = self._page()

        def fetch(url, **kw):
            if url.startswith("https://site.example"):
                return 200, {}, page, url
            time.sleep(3)           # the alternative host hangs
            raise OSError("timeout")

        started = time.monotonic()
        with patch("apps.websites.snippet_check._fetch", side_effect=fetch):
            out = snippet_check.check(self.site)
        elapsed = time.monotonic() - started

        self.assertEqual(out["state"], snippet_check.FOUND)
        self.assertLess(elapsed, 3, "a found install waited on an unrelated slow probe")

    def test_a_hanging_site_cannot_outlast_the_budget(self):
        """Every probe hanging must still produce an answer, because a customer
        watching a spinner is better served by 'we could not reach your site'
        than by a correct answer they have given up waiting for."""
        import time
        from unittest.mock import patch
        from apps.websites import snippet_check

        def fetch(url, **kw):
            # Kept modest rather than realistic: the worker threads outlive the
            # call by design (that is the point of the budget), and the test
            # process should not sit waiting for them at exit.
            time.sleep(3)
            raise OSError("timeout")

        started = time.monotonic()
        with patch("apps.websites.snippet_check._fetch", side_effect=fetch), \
             patch.object(snippet_check, "PROBE_BUDGET", 1.2):
            out = snippet_check.check(self.site)
        elapsed = time.monotonic() - started

        self.assertEqual(out["state"], snippet_check.UNREACHABLE)
        self.assertLess(elapsed, 6, "the budget did not bound the check")

    def test_the_read_stops_once_the_tag_is_complete(self):
        """A 600KB page cost seconds of transfer to answer a question the first
        few KB had already settled."""
        from apps.websites import snippet_check
        stop = snippet_check._stop_when(self.site.tracking_id)
        tag = f'<script src="/bl.js" data-site-id="{self.site.tracking_id}"'

        # Mid-tag: the id is there but strict_state still needs the closing '>'.
        self.assertFalse(stop(tag.encode()))
        self.assertTrue(stop((tag + "></script>").encode()))

    def test_a_snippet_in_the_body_is_still_found(self):
        """The obvious early stop — halt at </head> — would have been wrong:
        plenty of customers paste the snippet before </body>, and we would have
        reported their working install as missing."""
        from apps.websites import snippet_check
        body_page = (
            '<!doctype html><html><head><title>t</title></head><body><p>hi</p>'
            f'<script src="https://trynobot.com/bl.js" data-site-id="{self.site.tracking_id}"'
            ' data-strict="1"></script></body></html>')
        with self._patch_fetch(body=body_page):
            self.assertEqual(snippet_check.check(self.site)["state"], snippet_check.FOUND)

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

    def test_on_by_default_so_a_new_site_never_flashes_its_content(self):
        """The default flipped deliberately.

        Off, a blocked visitor sees the real page for a fraction of a second
        before being turned away — which customers read as the protection not
        working, and which genuinely leaks the content to anything that
        screenshots or scrapes quickly.
        """
        self.assertTrue(self.site.strict_mode)
        self.assertIn("data-strict", self._snippet())

    def test_turning_it_off_restores_the_plain_async_snippet(self):
        """It must stay a real choice — some customers will accept the flash
        rather than any delay at all."""
        self.site.strict_mode = False
        self.site.save(update_fields=["strict_mode"])
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
        # Flip it away from the default so the assertion below proves the
        # request was refused, rather than coincidentally matching.
        self.site.strict_mode = False
        self.site.save(update_fields=["strict_mode"])
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
