"""The ad-click meter is what customers are billed and compared on, so the
classifier is tested on the URL shapes real campaigns actually produce."""
from django.test import TestCase

from apps.traffic.paid_click import classify


class PaidClickTest(TestCase):
    def test_google_click_ids(self):
        for param, platform in [("gclid", "google_ads"), ("gbraid", "google_ads"),
                                ("wbraid", "google_ads"), ("dclid", "google_display")]:
            paid, got = classify(f"https://shop.example/lp?{param}=EAIaIQobChMI")
            self.assertTrue(paid, param)
            self.assertEqual(got, platform, param)

    def test_other_networks(self):
        cases = {
            "msclkid=abc123": "microsoft_ads",
            "ttclid=xyz": "tiktok_ads",
            "li_fat_id=99": "linkedin_ads",
            "twclid=77": "x_ads",
        }
        for qs, platform in cases.items():
            paid, got = classify(f"https://shop.example/?{qs}")
            self.assertTrue(paid, qs)
            self.assertEqual(got, platform, qs)

    def test_fbclid_is_not_billable(self):
        """Facebook appends fbclid to ORGANIC shares too. Billing on it would
        charge customers for traffic they never bought — the failure mode that
        turns a metering change into a refund queue."""
        paid, platform = classify("https://shop.example/post?fbclid=IwAR0xyz")
        self.assertFalse(paid)
        self.assertEqual(platform, "")

    def test_paid_utm_medium(self):
        for medium in ["cpc", "CPC", "paid_social", "ppc", "display", "remarketing"]:
            paid, _ = classify("https://shop.example/", utm_medium=medium)
            self.assertTrue(paid, medium)

    def test_organic_is_not_paid(self):
        for url, medium in [("https://shop.example/", ""),
                            ("https://shop.example/?utm_medium=organic", "organic"),
                            ("https://shop.example/?utm_medium=email", "email"),
                            ("https://shop.example/?ref=blog", ""),
                            ("https://shop.example/?q=gclid", "")]:
            paid, platform = classify(url, utm_medium=medium)
            self.assertFalse(paid, url)
            self.assertEqual(platform, "")

    def test_empty_click_id_is_not_a_click(self):
        """A copied/truncated URL keeps the key but loses the value. That's
        someone pasting a link, not a click we should charge for."""
        paid, _ = classify("https://shop.example/?gclid=")
        self.assertFalse(paid)

    def test_click_id_beats_utm_medium(self):
        """The click id is minted by the network, so it names the platform
        precisely even when the campaign tagged itself as something else."""
        paid, platform = classify(
            "https://shop.example/?gclid=abc&utm_medium=cpc&utm_source=newsletter")
        self.assertTrue(paid)
        self.assertEqual(platform, "google_ads")

    def test_platform_inferred_from_source_when_only_medium_is_paid(self):
        paid, platform = classify("https://shop.example/", utm_medium="cpc", utm_source="bing")
        self.assertTrue(paid)
        self.assertEqual(platform, "microsoft_ads")

    def test_unknown_paid_source_still_counts(self):
        """Under-counting means giving the traffic away."""
        paid, platform = classify("https://shop.example/", utm_medium="cpc", utm_source="taboola-x")
        self.assertTrue(paid)
        self.assertEqual(platform, "other_paid")

    def test_utm_medium_read_from_the_url_when_not_in_the_payload(self):
        """Some setups tag only the URL and never populate the tracker fields."""
        paid, _ = classify("https://shop.example/?utm_medium=cpc&utm_source=google")
        self.assertTrue(paid)

    def test_junk_never_raises(self):
        for bad in ["", "not a url", "://", "https://[", None]:
            paid, platform = classify(bad or "")
            self.assertFalse(paid)
            self.assertEqual(platform, "")


class PaidClickIngestTest(TestCase):
    """The classification has to survive the trip through the Redis stream and
    land on the session — that's the row the billing meter counts."""

    def setUp(self):
        import time
        from django.contrib.auth import get_user_model
        from apps.organizations.models import create_workspace
        from apps.websites.models import Website

        self.time = time
        user = get_user_model().objects.create_user(
            username="paid@example.com", email="paid@example.com", password="testpass123")
        self.org = create_workspace(user, "Paid Co")
        Website.objects.create(organization=self.org, name="P",
                               domain="p.example", tracking_id="paid123")

    def _ingest(self, session_id, url, **extra):
        from apps.traffic.management.commands.consume_traffic import Command
        from apps.traffic.models import Session

        f = {"site_id": "paid123", "visitor_id": "v1", "session_id": session_id,
             "type": "pageview", "url": url, "ts": str(int(self.time.time())),
             "risk_score": "10", "classification": "human", "confidence": "0.6",
             "signals": "[]", "ip": "203.0.113.10"}
        f.update(extra)
        Command()._ingest(f)
        return Session.objects.get(session_id=session_id)

    def test_ad_click_is_flagged_on_the_session(self):
        s = self._ingest("s-ad", "https://p.example/lp?gclid=EAIaIQ")
        self.assertTrue(s.is_paid_click)
        self.assertEqual(s.ad_platform, "google_ads")

    def test_organic_session_is_not_flagged(self):
        s = self._ingest("s-organic", "https://p.example/blog")
        self.assertFalse(s.is_paid_click)
        self.assertEqual(s.ad_platform, "")

    def test_later_pageviews_do_not_unset_the_flag(self):
        """The click id only appears on the landing URL. Deciding per event
        would flip the session back to unpaid on page two and bill nothing."""
        self._ingest("s-multi", "https://p.example/lp?gclid=EAIaIQ")
        s = self._ingest("s-multi", "https://p.example/pricing")
        self.assertTrue(s.is_paid_click)
        self.assertEqual(s.ad_platform, "google_ads")

    def test_one_ad_click_is_one_session_not_one_event(self):
        from apps.traffic.models import Session, TrafficEvent

        for path in ["/lp?gclid=EAIaIQ", "/pricing", "/signup", "/checkout"]:
            self._ingest("s-count", f"https://p.example{path}")
        self.assertEqual(TrafficEvent.objects.filter(session__session_id="s-count").count(), 4)
        self.assertEqual(Session.objects.filter(is_paid_click=True).count(), 1)
