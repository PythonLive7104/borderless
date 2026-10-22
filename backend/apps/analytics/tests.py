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


class VisitorIpRuleTest(TestCase):
    """Visitors show whether their IP is on the workspace allow/deny list, so
    the list can offer to change it."""

    def setUp(self):
        from django.utils import timezone as tz
        user = get_user_model().objects.create_user(
            username="ip@example.com", email="ip@example.com", password="testpass123")
        self.org = create_workspace(user, "IP Co")
        self.site = Website.objects.create(organization=self.org, name="S", domain="s.example")
        for ip in ("1.2.3.4", "10.0.0.7", "8.8.8.8"):
            v = Visitor.objects.create(website=self.site, visitor_id=f"v-{ip}", ip=ip)
            sess = Session.objects.create(website=self.site, visitor=v, session_id=f"s-{ip}")
            TrafficEvent.objects.create(website=self.site, visitor=v, session=sess, type="pageview",
                                        classification="human", action="allow", created_at=tz.now())
        self.c = APIClient()
        self.c.force_authenticate(user=user)

    def _rows(self):
        r = self.c.get(f"/api/analytics/visitors/?organization={self.org.id}").json()
        return {row["ip"]: row["ip_rule"] for row in r["results"]}

    def test_no_entries_means_no_rule_on_any_visitor(self):
        self.assertEqual(set(self._rows().values()), {None})

    def test_an_exact_deny_is_reported(self):
        from apps.rules.models import IPListEntry
        e = IPListEntry.objects.create(organization=self.org, value="1.2.3.4", kind="deny")
        rows = self._rows()
        self.assertEqual(rows["1.2.3.4"], {"id": e.id, "kind": "deny", "value": "1.2.3.4"})
        self.assertIsNone(rows["8.8.8.8"])

    def test_a_cidr_range_covers_an_ip_it_does_not_name(self):
        # The browser can't reasonably test CIDR membership, which is why this
        # is resolved server-side.
        from apps.rules.models import IPListEntry
        IPListEntry.objects.create(organization=self.org, value="10.0.0.0/8", kind="allow")
        rows = self._rows()
        self.assertEqual(rows["10.0.0.7"]["kind"], "allow")
        self.assertEqual(rows["10.0.0.7"]["value"], "10.0.0.0/8")
        self.assertIsNone(rows["1.2.3.4"])

    def test_an_inactive_entry_is_ignored(self):
        from apps.rules.models import IPListEntry
        IPListEntry.objects.create(organization=self.org, value="1.2.3.4", kind="deny", active=False)
        self.assertIsNone(self._rows()["1.2.3.4"])

    def test_another_workspaces_entry_does_not_leak(self):
        from apps.rules.models import IPListEntry
        other = get_user_model().objects.create_user(
            username="o2@example.com", email="o2@example.com", password="testpass123")
        other_org = create_workspace(other, "Other")
        IPListEntry.objects.create(organization=other_org, value="1.2.3.4", kind="deny")
        self.assertIsNone(self._rows()["1.2.3.4"])


class FunnelTest(TestCase):
    """The filtering funnel: total checked, how much reached the page vs was
    turned away, and why."""

    def setUp(self):
        user = get_user_model().objects.create_user(
            username="fn@example.com", email="fn@example.com", password="testpass123")
        self.org = create_workspace(user, "Funnel Co")
        self.site = Website.objects.create(organization=self.org, name="S", domain="s.example")

        def ev(action, classification, signals):
            v = Visitor.objects.create(website=self.site, visitor_id=f"v{TrafficEvent.objects.count()}")
            sess = Session.objects.create(website=self.site, visitor=v, session_id=f"s{TrafficEvent.objects.count()}")
            TrafficEvent.objects.create(
                website=self.site, visitor=v, session=sess, type="pageview",
                action=action, classification=classification, signals=signals,
                created_at=timezone.now())

        for _ in range(6):
            ev("allow", "human", [])
        for _ in range(3):
            ev("block", "bot", ["known_bot", "datacenter"])
        ev("redirect", "fraud", ["known_bot"])
        # A conversion must NOT count as a checked decision.
        v = Visitor.objects.create(website=self.site, visitor_id="conv")
        sess = Session.objects.create(website=self.site, visitor=v, session_id="convs")
        TrafficEvent.objects.create(website=self.site, visitor=v, session=sess,
                                    type="conversion", action="allow", created_at=timezone.now())

        self.c = APIClient()
        self.c.force_authenticate(user=user)

    def _funnel(self):
        return self.c.get(f"/api/analytics/funnel/?organization={self.org.id}").json()

    def test_totals_split_passed_and_turned_away(self):
        r = self._funnel()
        self.assertEqual(r["total"], 10)          # 6 allow + 3 block + 1 redirect, no conversion
        self.assertEqual(r["passed"], 6)
        self.assertEqual(r["turned_away"], 4)     # 3 block + 1 redirect
        self.assertEqual(r["pass_rate"], 0.6)

    def test_reasons_are_aggregated_and_labelled(self):
        reasons = {x["key"]: x["count"] for x in self._funnel()["reasons"]}
        self.assertEqual(reasons["known_bot"], 4)   # 3 block + 1 redirect
        self.assertEqual(reasons["datacenter"], 3)
        labels = {x["key"]: x["label"] for x in self._funnel()["reasons"]}
        self.assertEqual(labels["known_bot"], "Known bot user-agent")

    def test_classification_breakdown(self):
        by = {x["key"]: x["count"] for x in self._funnel()["by_classification"]}
        self.assertEqual(by["human"], 6)
        self.assertEqual(by["bot"], 3)
        self.assertEqual(by["fraud"], 1)


class CrawlerHeldOutOfQualityTest(TestCase):
    """Traffic quality counts only traffic the customer can act on.

    Googlebot is automated, so it scores around 50 and classifies as Suspicious
    — correctly. But the engine exempts verified crawlers from rules on purpose,
    because serving a crawler different content from real visitors is cloaking
    and can get a site dropped from search. Counting them dragged "traffic
    quality" below 100% and inflated "Suspicious + Fraud" on precisely the sites
    that get indexed most, which read as the engine malfunctioning.
    """

    def setUp(self):
        user = get_user_model().objects.create_user(
            username="cq@example.com", email="cq@example.com", password="testpass123")
        self.org = create_workspace(user, "Crawler Co")
        self.site = Website.objects.create(organization=self.org, name="S", domain="s.example")

        def ev(classification, signals, risk=0):
            n = TrafficEvent.objects.count()
            v = Visitor.objects.create(website=self.site, visitor_id=f"v{n}")
            sess = Session.objects.create(website=self.site, visitor=v, session_id=f"s{n}")
            TrafficEvent.objects.create(
                website=self.site, visitor=v, session=sess, type="pageview",
                action="allow", classification=classification, signals=signals,
                risk_score=risk, created_at=timezone.now())

        for _ in range(6):
            ev("human", [])
        for _ in range(2):
            ev("suspicious", ["known_bot", "verified_crawler"], risk=50)   # Googlebot
        ev("suspicious", ["proxy_detected"], risk=50)                       # a real one

        self.c = APIClient()
        self.c.force_authenticate(user=user)

    def _totals(self):
        return self.c.get(f"/api/analytics/overview/?organization={self.org.id}").json()["totals"]

    def test_quality_ignores_verified_crawlers(self):
        t = self._totals()
        # 9 events, 2 of them crawlers -> 6 human out of 7 actionable.
        self.assertEqual(t["events"], 9)
        self.assertEqual(t["crawlers"], 2)
        self.assertEqual(t["scored_events"], 7)
        self.assertAlmostEqual(t["quality"], round(6 / 7, 4))

    def test_suspicious_count_ignores_verified_crawlers(self):
        # Only the genuine one, not the two crawlers.
        self.assertEqual(self._totals()["suspicious"], 1)

    def test_flagged_ignores_verified_crawlers(self):
        self.assertEqual(self._totals()["flagged"], 1)

    def test_crawlers_are_reported_not_hidden(self):
        """They must still be visible, or the figures stop reconciling against
        the Visitors card and we have traded one confusion for another."""
        t = self._totals()
        self.assertEqual(t["crawlers"] + t["scored_events"], t["events"])

    def test_the_daily_series_agrees_with_the_headline(self):
        r = self.c.get(f"/api/analytics/overview/?organization={self.org.id}").json()
        pts = r["timeseries"]["quality"]
        self.assertEqual(len(pts), 1)
        self.assertAlmostEqual(pts[0]["pct"], round(6 / 7, 4))
