from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.organizations.models import create_workspace
from apps.campaigns.models import Campaign
from apps.traffic.models import Session, TrafficEvent, Visitor
from apps.websites.models import Website


class CampaignFunnelTest(TestCase):
    """A campaign is a 'stream': its funnel must count only its own attributed
    traffic (same site + utm_campaign), not the whole website."""

    def setUp(self):
        user = get_user_model().objects.create_user(
            username="cf@example.com", email="cf@example.com", password="testpass123")
        self.org = create_workspace(user, "Stream Co")
        self.site = Website.objects.create(organization=self.org, name="S", domain="s.example")
        self.camp = Campaign.objects.create(website=self.site, name="Promo", utm_campaign="promo")

        def ev(action, classification, utm):
            n = TrafficEvent.objects.count()
            v = Visitor.objects.create(website=self.site, visitor_id=f"v{n}")
            sess = Session.objects.create(website=self.site, visitor=v,
                                          session_id=f"s{n}", utm_campaign=utm)
            TrafficEvent.objects.create(website=self.site, visitor=v, session=sess,
                                        type="pageview", action=action,
                                        classification=classification, signals=["known_bot"] if action == "block" else [],
                                        created_at=timezone.now())

        for _ in range(4):
            ev("allow", "human", "promo")
        for _ in range(2):
            ev("block", "bot", "promo")
        # Traffic for a DIFFERENT campaign on the same site must be excluded.
        for _ in range(5):
            ev("allow", "human", "other")

        self.c = APIClient()
        self.c.force_authenticate(user=user)

    def test_funnel_is_scoped_to_the_campaign(self):
        r = self.c.get(f"/api/campaigns/{self.camp.id}/funnel/?range=30d").json()
        self.assertEqual(r["total"], 6)          # 4 allow + 2 block for "promo" only
        self.assertEqual(r["passed"], 4)
        self.assertEqual(r["turned_away"], 2)

    def test_reasons_come_from_this_campaigns_filtered_traffic(self):
        r = self.c.get(f"/api/campaigns/{self.camp.id}/funnel/?range=30d").json()
        reasons = {x["key"] for x in r["reasons"]}
        self.assertIn("known_bot", reasons)

    def test_another_workspace_cannot_read_the_funnel(self):
        other = APIClient()
        u2 = get_user_model().objects.create_user(
            username="x@example.com", email="x@example.com", password="testpass123")
        create_workspace(u2, "Other")
        other.force_authenticate(user=u2)
        r = other.get(f"/api/campaigns/{self.camp.id}/funnel/?range=30d")
        self.assertIn(r.status_code, (403, 404))
