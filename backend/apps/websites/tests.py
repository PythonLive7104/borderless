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
