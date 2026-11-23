"""The savings estimate, built around the ways a savings number can lie.

The category inflates these figures; the tests exist to stop ours doing the same.
So they check that organic bots aren't counted (never billed), that real paying
visitors aren't counted (not waste), that verified crawlers aren't counted (not
fraud), and that no dollar figure is invented when the customer hasn't given a
CPC. The happy-path arithmetic gets one test.
"""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from apps.analytics.savings import savings_for
from apps.organizations.models import create_workspace
from apps.traffic.models import Session, TrafficEvent, Visitor
from apps.websites.models import Website


def _user(email):
    return get_user_model().objects.create_user(
        username=email, email=email, password="testpass123")


class SavingsTest(TestCase):
    def setUp(self):
        self.org = create_workspace(_user("s@sav.example"), "Acme")
        self.site = Website.objects.create(organization=self.org, name="s", domain="s.example")
        self._n = 0

    def _click(self, *, paid, classification, action="allow", reviewer=False):
        self._n += 1
        v, _ = Visitor.objects.get_or_create(website=self.site, visitor_id=f"v{self._n}")
        s = Session.objects.create(website=self.site, visitor=v, session_id=f"s{self._n}",
                                   is_paid_click=paid)
        TrafficEvent.objects.create(
            website=self.site, visitor=v, session=s, classification=classification,
            action=action, is_reviewer=reviewer, created_at=timezone.now())

    def _set_cpc(self, value):
        self.org.avg_cpc = Decimal(str(value))
        self.org.save(update_fields=["avg_cpc"])

    def test_the_dollar_estimate_is_invalid_paid_clicks_times_cpc(self):
        for _ in range(4):
            self._click(paid=True, classification="bot", action="block")
        self._set_cpc("2.50")
        s = savings_for(self.org.id, days=30)
        self.assertEqual(s["invalid_paid_clicks"], 4)
        self.assertEqual(s["estimated_savings"], 10.0)      # 4 x 2.50
        self.assertEqual(s["avg_cpc"], 2.5)

    def test_organic_bots_are_not_savings(self):
        """A bot that arrived on free traffic cost the advertiser nothing, so
        counting it would flatter the figure with clicks that were never billed."""
        for _ in range(5):
            self._click(paid=False, classification="bot", action="block")
        self._set_cpc("3")
        s = savings_for(self.org.id, days=30)
        self.assertEqual(s["paid_clicks"], 0)
        self.assertEqual(s["invalid_paid_clicks"], 0)
        self.assertEqual(s["estimated_savings"], 0.0)

    def test_a_real_paying_visitor_is_not_waste(self):
        self._click(paid=True, classification="human", action="allow")
        self._click(paid=True, classification="bot", action="block")
        self._set_cpc("5")
        s = savings_for(self.org.id, days=30)
        self.assertEqual(s["paid_clicks"], 2)
        self.assertEqual(s["invalid_paid_clicks"], 1)       # only the bot
        self.assertEqual(s["estimated_savings"], 5.0)

    def test_an_ad_review_bot_is_not_counted_as_waste(self):
        """A platform's landing-page reviewer clicks the ad, so it looks paid and
        scores as automated — but Google doesn't bill for it and it isn't fraud,
        so it must not inflate the savings figure."""
        self._click(paid=True, classification="bot", action="allow", reviewer=True)
        self._set_cpc("4")
        s = savings_for(self.org.id, days=30)
        self.assertEqual(s["invalid_paid_clicks"], 0)

    def test_blocked_is_a_subset_of_invalid(self):
        """Caught-and-acted-on vs merely-flagged — a different promise, reported
        separately."""
        self._click(paid=True, classification="bot", action="block")
        self._click(paid=True, classification="fraud", action="allow")   # flagged, not blocked
        self._set_cpc("1")
        s = savings_for(self.org.id, days=30)
        self.assertEqual(s["invalid_paid_clicks"], 2)
        self.assertEqual(s["blocked_paid_clicks"], 1)

    def test_no_cpc_means_no_dollar_figure_is_invented(self):
        self._click(paid=True, classification="bot", action="block")
        s = savings_for(self.org.id, days=30)       # no CPC set
        self.assertEqual(s["invalid_paid_clicks"], 1)
        self.assertIsNone(s["estimated_savings"])
        self.assertFalse(s["has_cpc"])
        self.assertIn("Set your average", s["basis"])

    def test_the_basis_states_the_assumption(self):
        for _ in range(3):
            self._click(paid=True, classification="bot", action="block")
        self._set_cpc("2")
        s = savings_for(self.org.id, days=30)
        self.assertIn("3 invalid paid clicks", s["basis"])
        self.assertIn("$2.00", s["basis"])


class SavingsApiTest(TestCase):
    def setUp(self):
        from rest_framework.test import APIClient
        self.org = create_workspace(_user("api@sav.example"), "Acme")
        self.c = APIClient()
        self.c.force_authenticate(user=self.org.owner)

    def test_a_member_reads_their_savings(self):
        r = self.c.get(f"/api/analytics/savings/?organization={self.org.id}")
        self.assertEqual(r.status_code, 200)
        self.assertIn("invalid_paid_clicks", r.json())

    def test_a_stranger_is_refused(self):
        other = create_workspace(_user("x@sav.example"), "Other")
        r = self.c.get(f"/api/analytics/savings/?organization={other.id}")
        self.assertEqual(r.status_code, 403)

    def test_cpc_can_be_set_through_the_org_endpoint(self):
        r = self.c.patch(f"/api/organizations/{self.org.id}/", {"avg_cpc": "3.25"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.org.refresh_from_db()
        self.assertEqual(float(self.org.avg_cpc), 3.25)

    def test_a_negative_cpc_is_rejected(self):
        r = self.c.patch(f"/api/organizations/{self.org.id}/", {"avg_cpc": "-1"}, format="json")
        self.assertEqual(r.status_code, 400)
