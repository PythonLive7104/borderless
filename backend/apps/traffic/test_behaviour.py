"""Behaviour ingestion: the JS tracker's passive signals must survive the trip
through the Redis stream into a TrafficEvent, in a shape a trainer can use."""
import time
from datetime import datetime, timezone

from django.test import TestCase
from django.utils import timezone

from django.contrib.auth import get_user_model

from apps.organizations.models import create_workspace
from apps.websites.models import Website
from apps.traffic.models import TrafficEvent
from apps.traffic.management.commands.consume_traffic import Command, _behaviour


class BehaviourParserTest(TestCase):
    def test_pageview_with_no_behaviour_stores_empty(self):
        # The engine emits -1 / "" for unknown; none of it should be stored.
        f = {"bh_mouse": "-1", "bh_dirchg": "-1", "bh_scroll": "-1", "bh_keys": "-1",
             "bh_ttfi": "-1", "bh_pointer": "", "bh_synthetic": "0", "bh_human": "0"}
        self.assertEqual(_behaviour(f), {})

    def test_a_human_visit_keeps_only_measured_fields(self):
        f = {"bh_mouse": "42", "bh_dirchg": "18", "bh_scroll": "60", "bh_keys": "7",
             "bh_ttfi": "900", "bh_pointer": "mouse", "bh_synthetic": "0", "bh_human": "1"}
        self.assertEqual(_behaviour(f), {
            "mm": 42, "md": 18, "sc": 60, "kd": 7, "ttfi": 900,
            "tp": "mouse", "human": True})

    def test_synthetic_events_are_flagged(self):
        f = {"bh_mouse": "0", "bh_synthetic": "1", "bh_human": "0"}
        b = _behaviour(f)
        self.assertTrue(b["syn"])
        self.assertNotIn("human", b)

    def test_garbage_values_are_dropped_not_raised(self):
        f = {"bh_mouse": "not-a-number", "bh_scroll": "30"}
        self.assertEqual(_behaviour(f), {"sc": 30})


class BehaviourIngestTest(TestCase):
    def setUp(self):
        user = get_user_model().objects.create_user(
            username="beh@example.com", email="beh@example.com", password="testpass123")
        self.org = create_workspace(user, "Beh Co")
        self.site = Website.objects.create(organization=self.org, name="S",
                                           domain="s.example", tracking_id="track123")

    def _event(self, **bh):
        f = {"site_id": "track123", "visitor_id": "v1", "session_id": "s1",
             "type": "behaviour", "url": "https://s.example/", "ts": str(int(time.time())),
             "risk_score": "10", "classification": "human", "confidence": "0.60",
             "signals": "[]", "ip": "203.0.113.9"}
        f.update(bh)
        Command()._ingest(f)
        return TrafficEvent.objects.filter(session__session_id="s1").latest("id")

    def test_behaviour_reaches_postgres(self):
        e = self._event(bh_mouse="30", bh_dirchg="12", bh_human="1", bh_pointer="mouse")
        self.assertEqual(e.behaviour["mm"], 30)
        self.assertTrue(e.behaviour["human"])
        self.assertEqual(e.behaviour["tp"], "mouse")

    def test_pageview_stores_empty_behaviour(self):
        e = self._event(type="pageview", bh_mouse="-1", bh_human="0")
        self.assertEqual(e.behaviour, {})


class ReviewerReportingTest(TestCase):
    """Verified ad-network reviewers are labeled and counted apart from humans
    and bots, so an advertiser's real click quality isn't skewed by the ad
    platform's own landing-page review visits."""

    def setUp(self):
        user = get_user_model().objects.create_user(
            username="rev@example.com", email="rev@example.com", password="testpass123")
        self.org = create_workspace(user, "Rev Co")
        self.site = Website.objects.create(organization=self.org, name="R",
                                           domain="r.example", tracking_id="rev123")

    def _ingest(self, **extra):
        f = {"site_id": "rev123", "visitor_id": "v", "session_id": "s",
             "type": "server_check", "url": "https://r.example/", "ts": str(int(time.time())),
             "risk_score": "20", "classification": "human", "confidence": "0.6",
             "signals": "[]", "ip": "66.249.66.1"}
        f.update(extra)
        Command()._ingest(f)

    def test_reviewer_event_is_flagged_with_platform(self):
        self._ingest(reviewer="1", reviewer_platform="google_ads")
        e = TrafficEvent.objects.latest("id")
        self.assertTrue(e.is_reviewer)
        self.assertEqual(e.reviewer_platform, "google_ads")

    def test_reviewer_click_counts_apart_from_human_and_bot(self):
        from apps.links.models import ShortLink, ShortDomain
        dom = ShortDomain.objects.create(host="r.cc", active=True, verified_at=timezone.now())
        link = ShortLink.objects.create(organization=self.org, domain=dom,
                                        slug="promo", destination_url="https://r.example")
        # a human, a bot, and a reviewer all click the same link
        self._ingest(slug="promo", classification="human")
        self._ingest(slug="promo", classification="bot", reviewer="0")
        self._ingest(slug="promo", classification="bot", reviewer="1",
                     reviewer_platform="google_ads")
        link.refresh_from_db()
        self.assertEqual(link.clicks, 3)
        self.assertEqual(link.human_clicks, 1)
        self.assertEqual(link.bot_clicks, 1)          # the reviewer is NOT counted here
        self.assertEqual(link.reviewer_clicks, 1)
