"""Google Ads OAuth + exclusion plan, and the safety properties that matter.

This touches a customer's ad spend, so the tests are built around the ways it
could do harm rather than the happy path:

  * the feature leaking on when it isn't configured,
  * a forged or replayed OAuth `state` letting someone connect an account to a
    workspace that isn't theirs,
  * a grant surviving past the granter losing their manager role,
  * the live mutate firing when it hasn't been enabled and tested,
  * one workspace seeing another's exclusion plan or connection.
"""
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.integrations import googleads, googleads_push
from apps.integrations.models import GoogleAdsAccount
from apps.organizations.models import OrganizationMember, Role, create_workspace

ENABLED = dict(
    GOOGLE_ADS_CLIENT_ID="cid.apps.googleusercontent.com",
    GOOGLE_ADS_CLIENT_SECRET="secret",
    GOOGLE_ADS_REDIRECT_URI="https://trynobot.com/api/integrations/google-ads/callback/",
    FRONTEND_URL="https://app.trynobot.com",
)


def _user(email):
    return get_user_model().objects.create_user(
        username=email, email=email, password="testpass123")


def _client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


class FeatureFlagTest(TestCase):
    def test_disabled_when_unconfigured(self):
        with override_settings(GOOGLE_ADS_CLIENT_ID="", GOOGLE_ADS_CLIENT_SECRET="",
                               GOOGLE_ADS_REDIRECT_URI=""):
            self.assertFalse(googleads.is_enabled())
            self.assertFalse(googleads.live_push_enabled())

    @override_settings(**ENABLED)
    def test_enabled_when_configured(self):
        self.assertTrue(googleads.is_enabled())

    @override_settings(**ENABLED, GOOGLE_ADS_LIVE_PUSH=False)
    def test_live_push_stays_off_even_when_connected(self):
        """Credentials present is not enough. The live mutate needs its own
        explicit flag so an untested integration can't alter an account."""
        self.assertTrue(googleads.is_enabled())
        self.assertFalse(googleads.live_push_enabled())


class StateTokenTest(TestCase):
    def test_roundtrip(self):
        s = googleads.make_state(7, 42)
        self.assertEqual(googleads.read_state(s), (7, 42))

    def test_a_forged_state_is_rejected(self):
        self.assertIsNone(googleads.read_state("not-a-real-signed-token"))
        self.assertIsNone(googleads.read_state(""))

    def test_a_tampered_state_is_rejected(self):
        s = googleads.make_state(7, 42)
        self.assertIsNone(googleads.read_state(s + "x"))

    def test_an_expired_state_is_rejected(self):
        s = googleads.make_state(7, 42)
        # Pretend the signer's clock was far in the past.
        with patch("apps.integrations.googleads.STATE_MAX_AGE", -1):
            self.assertIsNone(googleads.read_state(s))


class AuthorizeUrlTest(TestCase):
    @override_settings(**ENABLED)
    def test_it_requests_offline_access_and_the_adwords_scope(self):
        url = googleads.authorize_url("STATE123")
        for needle in ("accounts.google.com", "scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fadwords",
                       "access_type=offline", "prompt=consent", "state=STATE123",
                       "client_id=cid.apps.googleusercontent.com"):
            self.assertIn(needle, url, needle)


class StatusViewTest(TestCase):
    def setUp(self):
        self.org = create_workspace(_user("owner@ga.example"), "Acme")
        self.c = _client(self.org.owner)

    def test_reports_disabled_when_unconfigured(self):
        with override_settings(GOOGLE_ADS_CLIENT_ID=""):
            r = self.c.get(f"/api/integrations/google-ads/status/?organization={self.org.id}")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.json()["enabled"])
        self.assertFalse(r.json()["connected"])

    @override_settings(**ENABLED)
    def test_reports_enabled_and_not_connected(self):
        r = self.c.get(f"/api/integrations/google-ads/status/?organization={self.org.id}")
        self.assertTrue(r.json()["enabled"])
        self.assertFalse(r.json()["connected"])

    def test_a_stranger_cannot_read_status(self):
        other = create_workspace(_user("stranger@ga.example"), "Other")
        r = self.c.get(f"/api/integrations/google-ads/status/?organization={other.id}")
        self.assertIn(r.status_code, (403, 404))


class ConnectViewTest(TestCase):
    def setUp(self):
        self.org = create_workspace(_user("own@gac.example"), "Acme")

    @override_settings(**ENABLED)
    def test_a_manager_gets_an_authorize_url(self):
        r = _client(self.org.owner).get(
            f"/api/integrations/google-ads/connect/?organization={self.org.id}")
        self.assertEqual(r.status_code, 200)
        self.assertIn("accounts.google.com", r.json()["authorize_url"])

    @override_settings(**ENABLED)
    def test_an_analyst_cannot_connect(self):
        analyst = _user("analyst@gac.example")
        OrganizationMember.objects.create(organization=self.org, user=analyst, role=Role.ANALYST)
        r = _client(analyst).get(
            f"/api/integrations/google-ads/connect/?organization={self.org.id}")
        self.assertEqual(r.status_code, 403)

    def test_connect_404s_when_feature_off(self):
        with override_settings(GOOGLE_ADS_CLIENT_ID=""):
            r = _client(self.org.owner).get(
                f"/api/integrations/google-ads/connect/?organization={self.org.id}")
        self.assertEqual(r.status_code, 404)


@override_settings(**ENABLED)
class CallbackTest(TestCase):
    def setUp(self):
        self.org = create_workspace(_user("cb@ga.example"), "Acme")
        self.pub = APIClient()   # no auth: Google redirects here

    def _tokens(self, **over):
        base = {"refresh_token": "rt-123", "access_token": "at-123",
                "expires_in": 3600, "scope": googleads.SCOPE}
        base.update(over)
        return base

    def test_a_valid_callback_stores_the_connection(self):
        state = googleads.make_state(self.org.id, self.org.owner.id)
        with patch("apps.integrations.googleads_views.googleads.exchange_code",
                   return_value=self._tokens()):
            r = self.pub.get(f"/api/integrations/google-ads/callback/?code=abc&state={state}")
        self.assertEqual(r.status_code, 302)
        self.assertIn("google_ads=connected", r["Location"])
        acct = GoogleAdsAccount.objects.get(organization=self.org)
        self.assertTrue(acct.is_connected)
        self.assertEqual(acct.refresh_token, "rt-123")
        self.assertEqual(acct.connected_by_id, self.org.owner.id)

    def test_a_forged_state_connects_nothing(self):
        with patch("apps.integrations.googleads_views.googleads.exchange_code") as ex:
            r = self.pub.get("/api/integrations/google-ads/callback/?code=abc&state=forged")
        ex.assert_not_called()
        self.assertIn("google_ads=invalid", r["Location"])
        self.assertFalse(GoogleAdsAccount.objects.exists())

    def test_a_grant_from_someone_no_longer_a_manager_is_refused(self):
        """The state was signed for a user who has since been demoted. A past
        grant must not override current permissions."""
        analyst = _user("wasmgr@ga.example")
        OrganizationMember.objects.create(organization=self.org, user=analyst, role=Role.ANALYST)
        state = googleads.make_state(self.org.id, analyst.id)
        with patch("apps.integrations.googleads_views.googleads.exchange_code") as ex:
            r = self.pub.get(f"/api/integrations/google-ads/callback/?code=abc&state={state}")
        ex.assert_not_called()
        self.assertIn("google_ads=forbidden", r["Location"])
        self.assertFalse(GoogleAdsAccount.objects.exists())

    def test_no_refresh_token_is_not_stored(self):
        state = googleads.make_state(self.org.id, self.org.owner.id)
        with patch("apps.integrations.googleads_views.googleads.exchange_code",
                   return_value=self._tokens(refresh_token="")):
            r = self.pub.get(f"/api/integrations/google-ads/callback/?code=abc&state={state}")
        self.assertIn("google_ads=no_refresh", r["Location"])
        self.assertFalse(GoogleAdsAccount.objects.exists())

    def test_a_denied_consent_returns_gracefully(self):
        r = self.pub.get("/api/integrations/google-ads/callback/?error=access_denied")
        self.assertEqual(r.status_code, 302)
        self.assertIn("google_ads=denied", r["Location"])


class DisconnectTest(TestCase):
    @override_settings(**ENABLED)
    def test_disconnect_removes_and_revokes(self):
        org = create_workspace(_user("dc@ga.example"), "Acme")
        GoogleAdsAccount.objects.create(organization=org, refresh_token="rt",
                                        customer_id="1234567890")
        with patch("apps.integrations.googleads_views.googleads.revoke", return_value=True) as rev:
            r = _client(org.owner).post("/api/integrations/google-ads/disconnect/",
                                        {"organization": org.id}, format="json")
        self.assertEqual(r.status_code, 200)
        rev.assert_called_once()
        self.assertFalse(GoogleAdsAccount.objects.filter(organization=org).exists())


class ExclusionPlanViewTest(TestCase):
    """The sellable screen: works before any Google connection, isolated per org."""

    def setUp(self):
        from apps.websites.models import Website
        from apps.traffic.models import Session, TrafficEvent, Visitor
        from django.utils import timezone
        self.org = create_workspace(_user("plan@ga.example"), "Acme")
        self.site = Website.objects.create(organization=self.org, name="s", domain="s.example")
        v, _ = Visitor.objects.get_or_create(website=self.site, visitor_id="v1")
        s, _ = Session.objects.get_or_create(
            website=self.site, session_id="s1",
            defaults={"visitor": v, "is_paid_click": True, "ad_campaign_id": "C1"})
        TrafficEvent.objects.create(website=self.site, visitor=v, session=s,
                                    ip="45.33.32.10", classification="bot", action="block",
                                    created_at=timezone.now())
        self.c = _client(self.org.owner)

    def test_plan_works_without_a_connected_account(self):
        r = self.c.get(f"/api/integrations/google-ads/exclusion-plan/"
                       f"?organization={self.org.id}&campaign_id=C1")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["add"], ["45.33.32.10"])

    def test_campaign_id_is_required(self):
        r = self.c.get(f"/api/integrations/google-ads/exclusion-plan/?organization={self.org.id}")
        self.assertEqual(r.status_code, 400)

    def test_a_stranger_cannot_read_a_plan(self):
        other = create_workspace(_user("peek@ga.example"), "Other")
        r = _client(other.owner).get(
            f"/api/integrations/google-ads/exclusion-plan/"
            f"?organization={self.org.id}&campaign_id=C1")
        self.assertIn(r.status_code, (403, 404))


class PushSafetyTest(TestCase):
    """The live mutate must not fire unless it has been explicitly turned on."""

    def _plan(self):
        return {"add": ["45.33.32.1"], "remove": [], "keep": [], "skipped": []}

    def test_default_call_is_a_dry_run(self):
        out = googleads_push.apply(None, "C1", self._plan())
        self.assertFalse(out["applied"])
        self.assertTrue(out["dry_run"])
        self.assertEqual(out["add"], ["45.33.32.1"])

    @override_settings(**ENABLED, GOOGLE_ADS_LIVE_PUSH=False)
    def test_asking_to_apply_with_live_off_still_only_previews(self):
        acct = GoogleAdsAccount(refresh_token="rt", status=GoogleAdsAccount.Status.CONNECTED)
        out = googleads_push.apply(acct, "C1", self._plan(), dry_run=False)
        self.assertFalse(out["applied"])
        self.assertTrue(out["dry_run"])
        self.assertIn("turned off", out["reason"].lower())

    @override_settings(**ENABLED, GOOGLE_ADS_LIVE_PUSH=True)
    def test_with_live_on_it_reaches_the_unimplemented_mutate(self):
        """Proves the gate opens only under the flag — and that the live path is
        still the explicitly-unimplemented one, so nothing half-built can run
        against a real account by surprise."""
        acct = GoogleAdsAccount(refresh_token="rt", status=GoogleAdsAccount.Status.CONNECTED)
        out = googleads_push.apply(acct, "C1", self._plan(), dry_run=False)
        self.assertFalse(out["applied"])
        self.assertIn("error", out)
        self.assertIn("not implemented", out["error"].lower())
