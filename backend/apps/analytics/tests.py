"""Per-website filtering on the analytics endpoints.

A workspace with several sites needs to look at one at a time; the filters
existed on the API but nothing in the UI ever sent them, so every site's traffic
appeared in one undifferentiated list.
"""
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.organizations.models import create_workspace
from apps.traffic.models import Session, TrafficEvent, Visitor
from apps.websites.models import Website


class WebsiteScopedAnalyticsTest(TestCase):
    def setUp(self):
        user = get_user_model().objects.create_user(
            username="an@example.com", email="an@example.com", password="testpass123")
        self.org = create_workspace(user, "Analytics Co")
        self.a = Website.objects.create(organization=self.org, name="Site A", domain="a.example")
        self.b = Website.objects.create(organization=self.org, name="Site B", domain="b.example")

        for site, n in ((self.a, 3), (self.b, 2)):
            for i in range(n):
                v = Visitor.objects.create(website=site, visitor_id=f"{site.domain}-{i}")
                sess = Session.objects.create(website=site, visitor=v, session_id=f"{site.domain}-s{i}")
                TrafficEvent.objects.create(website=site, visitor=v, session=sess, type="pageview",
                                            risk_score=0, classification="human", action="allow",
                                            created_at=timezone.now())

        self.c = APIClient()
        self.c.force_authenticate(user=user)

    def _events(self, **params):
        q = "&".join(f"{k}={v}" for k, v in params.items())
        return self.c.get(f"/api/analytics/events/?organization={self.org.id}&{q}").json()

    def _visitors(self, **params):
        q = "&".join(f"{k}={v}" for k, v in params.items())
        return self.c.get(f"/api/analytics/visitors/?organization={self.org.id}&{q}").json()

    def test_events_unfiltered_span_every_site(self):
        self.assertEqual(self._events()["count"], 5)

    def test_events_can_be_scoped_to_one_site(self):
        self.assertEqual(self._events(website=self.a.id)["count"], 3)
        self.assertEqual(self._events(website=self.b.id)["count"], 2)

    def test_visitors_can_be_scoped_to_one_site(self):
        self.assertEqual(self._visitors()["count"], 5)
        self.assertEqual(self._visitors(website=self.a.id)["count"], 3)
        self.assertEqual(self._visitors(website=self.b.id)["count"], 2)

    def test_rows_name_their_site_so_a_mixed_list_is_readable(self):
        self.assertEqual({r["website_name"] for r in self._events()["results"]},
                         {"Site A", "Site B"})
        self.assertEqual({r["website_name"] for r in self._visitors()["results"]},
                         {"Site A", "Site B"})

    def test_another_workspace_sees_none_of_it(self):
        other = get_user_model().objects.create_user(
            username="other@example.com", email="other@example.com", password="testpass123")
        create_workspace(other, "Other Co")
        c = APIClient(); c.force_authenticate(user=other)
        # Even naming the website id explicitly must not leak another org's data.
        r = c.get(f"/api/analytics/events/?website={self.a.id}").json()
        self.assertEqual(r["count"], 0)

    # --- Dashboard and Reports scope the same way -------------------------

    def _overview(self, **params):
        q = "&".join(f"{k}={v}" for k, v in params.items())
        return self.c.get(f"/api/analytics/overview/?organization={self.org.id}&{q}").json()

    def _report(self, **params):
        q = "&".join(f"{k}={v}" for k, v in params.items())
        return self.c.get(f"/api/analytics/report/?organization={self.org.id}&dimension=country&{q}").json()

    def test_dashboard_totals_scope_to_one_site(self):
        self.assertEqual(self._overview()["totals"]["events"], 5)
        self.assertEqual(self._overview(website=self.a.id)["totals"]["events"], 3)
        self.assertEqual(self._overview(website=self.b.id)["totals"]["events"], 2)

    def test_dashboard_visitor_count_scopes_too(self):
        self.assertEqual(self._overview(website=self.a.id)["totals"]["visitors"], 3)

    def test_reports_scope_to_one_site(self):
        total = sum(r["events"] for r in self._report()["rows"])
        scoped = sum(r["events"] for r in self._report(website=self.a.id)["rows"])
        self.assertEqual(total, 5)
        self.assertEqual(scoped, 3)

    def test_revenue_scopes_with_everything_else(self):
        # Revenue comes from a separate query; if it didn't filter, a per-site
        # dashboard would show the whole workspace's money.
        from apps.traffic.models import Conversion
        from django.utils import timezone as tz
        for site, amount in ((self.a, 10), (self.b, 90)):
            v = Visitor.objects.get(website=site, visitor_id=f"{site.domain}-0")
            Conversion.objects.create(website=site, visitor=v, event_name="sale",
                                      revenue=amount, currency="USD", created_at=tz.now())
        self.assertEqual(self._overview()["totals"]["revenue"], 100.0)
        self.assertEqual(self._overview(website=self.a.id)["totals"]["revenue"], 10.0)
