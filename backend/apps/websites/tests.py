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
