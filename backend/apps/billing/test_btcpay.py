"""Direct Bitcoin payment, built around the ways a money flow goes wrong.

The one rule that must never break: **nothing activates a plan except an admin
confirming receipt.** So the tests check that starting a payment grants no
access, that confirming grants exactly the plan paid for, that confirming twice
doesn't activate (or pay a referrer) twice, that rejecting grants nothing, and
that the whole feature is invisible when no wallet is configured.
"""
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.billing import btcpay
from apps.billing.models import BtcPayment, Plan, Subscription
from apps.organizations.models import OrganizationMember, Role, create_workspace

ADDR = "1MTEV6vExwn42Jc2THTQk1ts4PyjVwrzmf"
ON = dict(BTC_PAYMENT_ADDRESS=ADDR)


def _user(email):
    return get_user_model().objects.create_user(
        username=email, email=email, password="testpass123")


def _plan():
    return Plan.objects.filter(slug="basic").first() or Plan.objects.create(
        slug="basic", name="Basic", price=25, monthly_events=100000,
        max_redirects=2, sort=1)


def _client(user):
    c = APIClient(); c.force_authenticate(user=user)
    return c


class FeatureFlagTest(TestCase):
    def test_off_when_no_address(self):
        with override_settings(BTC_PAYMENT_ADDRESS=""):
            self.assertFalse(btcpay.is_enabled())
            from apps.billing import payment_methods
            self.assertNotIn("bitcoin", payment_methods.available())

    @override_settings(**ON)
    def test_on_when_address_set(self):
        self.assertTrue(btcpay.is_enabled())
        self.assertEqual(btcpay.address(), ADDR)
        from apps.billing import payment_methods
        self.assertIn("bitcoin", payment_methods.available())


@override_settings(**ON)
class StartTest(TestCase):
    def setUp(self):
        self.org = create_workspace(_user("owner@btc.example"), "Acme")
        _plan()

    def test_starting_records_a_pending_payment_and_activates_nothing(self):
        r = _client(self.org.owner).post("/api/billing/btc/start/",
                                         {"organization": self.org.id, "plan": "basic",
                                          "interval": "weekly"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        body = r.json()
        self.assertEqual(body["status"], "pending")
        self.assertEqual(body["address"], ADDR)

        # The crucial assertion: no access was granted.
        sub = Subscription.objects.get(organization=self.org)
        self.assertEqual(sub.status, Subscription.Status.TRIALING)
        self.assertEqual(BtcPayment.objects.filter(organization=self.org,
                                                   status="pending").count(), 1)

    def test_the_amount_includes_the_processing_fee(self):
        with override_settings(PAYMENT_FEE_PCT=5, PAYMENT_FEE_FIXED=1):
            r = _client(self.org.owner).post("/api/billing/btc/start/",
                                             {"organization": self.org.id, "plan": "basic",
                                              "interval": "weekly"}, format="json")
        # 25 + (25*5% + 1) = 25 + 2.25 = 27.25
        self.assertEqual(Decimal(r.json()["amount_usd"]), Decimal("27.25"))

    def test_an_analyst_cannot_start_a_payment(self):
        analyst = _user("analyst@btc.example")
        OrganizationMember.objects.create(organization=self.org, user=analyst, role=Role.ANALYST)
        r = _client(analyst).post("/api/billing/btc/start/",
                                  {"organization": self.org.id, "plan": "basic"}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_a_stranger_cannot_start_for_someone_else(self):
        other = create_workspace(_user("other@btc.example"), "Other")
        r = _client(other.owner).post("/api/billing/btc/start/",
                                      {"organization": self.org.id, "plan": "basic"}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_start_404s_when_the_wallet_is_unset(self):
        with override_settings(BTC_PAYMENT_ADDRESS=""):
            r = _client(self.org.owner).post("/api/billing/btc/start/",
                                             {"organization": self.org.id, "plan": "basic"},
                                             format="json")
        self.assertEqual(r.status_code, 404)


@override_settings(**ON)
class ConfirmTest(TestCase):
    def setUp(self):
        self.org = create_workspace(_user("c@btc.example"), "Acme")
        self.admin = _user("admin@btc.example")
        self.plan = _plan()
        self.payment = btcpay.create_request(self.org, self.plan, "weekly",
                                             self.org.owner, Decimal("25"))

    def _confirm(self):
        return btcpay.confirm(self.payment, admin_user=self.admin)

    def test_confirming_activates_the_plan_paid_for(self):
        self.assertTrue(self._confirm())
        sub = Subscription.objects.get(organization=self.org)
        self.assertEqual(sub.status, Subscription.Status.ACTIVE)
        self.assertEqual(sub.plan.slug, "basic")
        self.assertEqual(sub.interval, "weekly")
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, "confirmed")
        self.assertEqual(self.payment.reviewed_by, self.admin)

    def test_confirming_twice_activates_once_and_pays_the_referrer_once(self):
        """Idempotency is the money-safety property. A retried admin click, or a
        double submit, must not re-activate or pay a referral twice."""
        with patch("apps.billing.views._award_referral") as award:
            self.assertTrue(self._confirm())
            self.assertFalse(self._confirm())   # second time: no-op
        award.assert_called_once()

    def test_the_referral_payout_is_keyed_on_this_payment(self):
        """Real money changed hands, so a referral fires — tagged with the
        payment id so the webhook/poll/BTC paths can't each pay for it."""
        with patch("apps.billing.views._award_referral") as award:
            self._confirm()
        # paid_ref flows into award via _activate; assert it carries our id.
        _, _, _, ref = award.call_args.args
        self.assertEqual(ref, f"btc:{self.payment.id}")

    def test_rejecting_grants_nothing(self):
        self.assertTrue(btcpay.reject(self.payment, admin_user=self.admin, reason="no coins"))
        sub = Subscription.objects.get(organization=self.org)
        self.assertEqual(sub.status, Subscription.Status.TRIALING)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, "rejected")
        self.assertIn("no coins", self.payment.admin_note)

    def test_a_rejected_payment_cannot_then_be_confirmed(self):
        btcpay.reject(self.payment, admin_user=self.admin)
        self.assertFalse(self._confirm())
        self.assertEqual(Subscription.objects.get(organization=self.org).status,
                         Subscription.Status.TRIALING)


@override_settings(**ON)
class AdminActionTest(TestCase):
    """The admin surface, since that's where confirmation actually happens."""

    def setUp(self):
        from django.contrib.admin.sites import AdminSite
        from apps.billing.admin import BtcPaymentAdmin
        self.org = create_workspace(_user("a@btc.example"), "Acme")
        self.admin_user = _user("staff@btc.example")
        self.admin = BtcPaymentAdmin(BtcPayment, AdminSite())
        self.payment = btcpay.create_request(self.org, _plan(), "weekly",
                                             self.org.owner, Decimal("25"))

    def _req(self):
        from django.test import RequestFactory
        r = RequestFactory().post("/admin/")
        r.user = self.admin_user
        r._messages = _Msgs()
        return r

    def test_confirm_action_activates(self):
        self.admin.confirm_payments(self._req(), BtcPayment.objects.filter(pk=self.payment.pk))
        self.assertEqual(Subscription.objects.get(organization=self.org).status,
                         Subscription.Status.ACTIVE)

    def test_confirm_action_skips_already_decided(self):
        btcpay.confirm(self.payment, admin_user=self.admin_user)
        req = self._req()
        self.admin.confirm_payments(req, BtcPayment.objects.filter(pk=self.payment.pk))
        self.assertIn("skipped", " ".join(req._messages.sent).lower())


class _Msgs:
    def __init__(self): self.sent = []
    def add(self, level, message, extra_tags=""): self.sent.append(str(message))
