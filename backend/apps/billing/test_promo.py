"""The Black Friday "double period" promo.

It touches billing, so the tests are built around the ways it could cheat a
customer or be cheated: a code that doubles a plan it shouldn't, a code that
keeps working after the campaign ends, a wrong code that silently charges full
price, and — the subtle one — the multiplier farming itself through early
renewals by doubling the rolled-over remainder.
"""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.billing import promo
from apps.billing.models import Plan, Subscription
from apps.billing.views import _activate
from apps.organizations.models import create_workspace

CODE = "BLACKFRIDAY8899"
ON = dict(BLACKFRIDAY_CODE=CODE, BLACKFRIDAY_MULTIPLIER=2)


def _user(email):
    return get_user_model().objects.create_user(
        username=email, email=email, password="testpass123")


def _plan(slug, price=70):
    return Plan.objects.filter(slug=slug).first() or Plan.objects.create(
        slug=slug, name=slug.title(), price=price, monthly_events=1000000,
        max_redirects=10, sort=3)


class PromoRulesTest(TestCase):
    @override_settings(**ON)
    def test_valid_code_on_pro_doubles(self):
        self.assertEqual(promo.period_multiplier(CODE, "pro"), 2)

    @override_settings(**ON)
    def test_case_and_space_insensitive(self):
        self.assertEqual(promo.period_multiplier(f"  {CODE.lower()} ", "pro"), 2)

    @override_settings(**ON)
    def test_it_does_not_apply_to_basic_or_plus(self):
        self.assertEqual(promo.period_multiplier(CODE, "basic"), 1)
        self.assertEqual(promo.period_multiplier(CODE, "plus"), 1)

    @override_settings(**ON)
    def test_a_wrong_code_is_one(self):
        self.assertEqual(promo.period_multiplier("NOPE", "pro"), 1)

    @override_settings(BLACKFRIDAY_CODE="")
    def test_off_when_no_code_configured(self):
        """The campaign ending (setting cleared) must stop an old bookmarked
        code from still doubling."""
        self.assertFalse(promo.is_enabled())
        self.assertEqual(promo.period_multiplier(CODE, "pro"), 1)

    @override_settings(BLACKFRIDAY_CODE=CODE, BLACKFRIDAY_MULTIPLIER=3)
    def test_the_multiplier_is_configurable(self):
        self.assertEqual(promo.period_multiplier(CODE, "pro"), 3)

    @override_settings(**ON)
    def test_validate_messages(self):
        self.assertTrue(promo.validate(CODE, "pro")["valid"])
        self.assertIn("Pro", promo.validate(CODE, "basic")["message"])
        self.assertFalse(promo.validate("WRONG", "pro")["valid"])
        self.assertEqual(promo.validate("", "pro")["message"], "")

    @override_settings(**ON, BLACKFRIDAY_ENDS="2099-12-31")
    def test_a_future_end_date_keeps_it_running(self):
        self.assertFalse(promo.is_expired())
        self.assertTrue(promo.is_enabled())
        self.assertEqual(promo.period_multiplier(CODE, "pro"), 2)
        self.assertEqual(promo.ends_iso(), "2099-12-31")

    @override_settings(**ON, BLACKFRIDAY_ENDS="2000-01-01")
    def test_a_past_end_date_switches_it_off(self):
        """The whole reason for the date: a code still sitting in the .env must
        stop doubling once the campaign is over."""
        self.assertTrue(promo.is_expired())
        self.assertFalse(promo.is_enabled())
        self.assertEqual(promo.period_multiplier(CODE, "pro"), 1)

    @override_settings(**ON, BLACKFRIDAY_ENDS="not-a-date")
    def test_a_malformed_end_date_does_not_take_it_offline(self):
        self.assertFalse(promo.is_expired())
        self.assertTrue(promo.is_enabled())
        self.assertEqual(promo.ends_iso(), "")


@override_settings(**ON)
class ActivationTest(TestCase):
    def setUp(self):
        self.org = create_workspace(_user("a@promo.example"), "Acme")
        self.pro = _plan("pro")
        self.sub = Subscription.objects.get(organization=self.org)

    def _days_bought(self, interval):
        from apps.billing.models import INTERVAL_DAYS
        return INTERVAL_DAYS[interval]

    def test_pro_weekly_with_code_gives_two_weeks(self):
        self.sub.status = Subscription.Status.TRIALING
        self.sub.trial_end = timezone.now()   # no rollover
        self.sub.save()
        _activate(self.sub, self.pro, "weekly", paid_ref="x", promo=CODE)
        self.sub.refresh_from_db()
        got = (self.sub.period_end - self.sub.period_start).days
        self.assertIn(got, (13, 14))          # 2 x 7, allowing for rounding

    def test_pro_monthly_without_code_gives_one_month(self):
        self.sub.status = Subscription.Status.TRIALING
        self.sub.trial_end = timezone.now()
        self.sub.save()
        _activate(self.sub, self.pro, "monthly", paid_ref="x")   # no promo
        self.sub.refresh_from_db()
        got = (self.sub.period_end - self.sub.period_start).days
        self.assertIn(got, (29, 30))

    def test_the_promo_is_cleared_after_activation(self):
        self.sub.pending_promo = CODE
        self.sub.save(update_fields=["pending_promo"])
        _activate(self.sub, self.pro, "weekly", paid_ref="x")   # reads pending_promo
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.pending_promo, "")

    def test_the_multiplier_does_not_stretch_rolled_over_days(self):
        """The anti-farming rule: a customer with 30 days left who renews early
        with the code gets 2x only the NEW period, plus their existing 30 at 1x
        — not 2x everything. Otherwise the code could be farmed by renewing over
        and over."""
        self.sub.status = Subscription.Status.ACTIVE
        self.sub.interval = "weekly"
        self.sub.period_end = timezone.now() + timedelta(days=30)   # banked days
        self.sub.save()
        _activate(self.sub, self.pro, "weekly", paid_ref="x", promo=CODE)
        self.sub.refresh_from_db()
        got = (self.sub.period_end - timezone.now()).days
        # ~30 banked + 14 (2x7) new = ~44, NOT 2 x (30+7)=74.
        self.assertGreater(got, 40)
        self.assertLess(got, 48)


@override_settings(**ON)
class PromoApiTest(TestCase):
    def setUp(self):
        self.c = APIClient()

    def test_promo_info_is_public_and_advertises_the_code(self):
        r = self.c.get("/api/billing/promo/")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json()["active"])
        self.assertEqual(r.json()["code"], CODE)
        self.assertEqual(r.json()["multiplier"], 2)

    @override_settings(BLACKFRIDAY_CODE="")
    def test_promo_info_off_when_no_campaign(self):
        self.assertFalse(self.c.get("/api/billing/promo/").json()["active"])

    @override_settings(**ON, BLACKFRIDAY_ENDS="2099-12-31")
    def test_promo_info_carries_the_end_date_for_the_banner(self):
        body = self.c.get("/api/billing/promo/").json()
        self.assertTrue(body["active"])
        self.assertEqual(body["ends"], "2099-12-31")

    def test_checkout_rejects_an_invalid_code_before_charging(self):
        """A code entered that doesn't apply is a hard error — a customer must
        never be charged full price believing the promo applied."""
        org = create_workspace(_user("co@promo.example"), "Acme")
        _plan("pro")
        c = APIClient(); c.force_authenticate(user=org.owner)
        r = c.post("/api/billing/checkout/",
                   {"organization": org.id, "plan": "pro", "interval": "weekly",
                    "promo_code": "WRONGCODE"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("valid", r.json()["detail"].lower())
