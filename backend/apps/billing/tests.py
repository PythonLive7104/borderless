from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.billing.models import Subscription
from apps.organizations.models import create_workspace


class AccessGatingTest(TestCase):
    def setUp(self):
        self.c = APIClient()
        self.c.post("/api/auth/register/", {"email": "g@example.com", "password": "testpass123", "first_name": "G"}, format="json")
        access = self.c.post("/api/auth/token/", {"email": "g@example.com", "password": "testpass123"}, format="json").json()["access"]
        self.c.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        orgs = self.c.get("/api/organizations/").json()
        self.org = orgs[0]["id"] if isinstance(orgs, list) else orgs["results"][0]["id"]

    def test_trial_then_expired_then_paid(self):
        sub = Subscription.objects.get(organization_id=self.org)
        self.assertFalse(sub.access_state()["locked"])  # trialing
        sub.trial_end = timezone.now() - timedelta(days=1)
        sub.save()
        self.assertTrue(sub.access_state()["locked"])   # expired
        self.assertEqual(sub.access_state()["reason"], "trial_expired")
        # upgrade (dev checkout activates instantly)
        with patch("apps.billing.bachs.is_enabled", return_value=False):
            r = self.c.post("/api/billing/checkout/", {"organization": self.org, "plan": "plus"}, format="json")
        self.assertEqual(r.status_code, 200)
        sub.refresh_from_db()
        self.assertFalse(sub.access_state()["locked"])  # active
        self.assertEqual(sub.status, "active")


class MigratedSubscriptionTest(TestCase):
    """Guards the data the 0007/0008 migrations backfill.

    period_end is read by _deadline() for anything not trialing, so a NULL there
    reads as "period_ended" and locks a paying workspace out. The plan caps are
    what stops a paid tier handing out unlimited short links.
    """

    def test_active_subscription_without_period_end_is_locked_out(self):
        # This is the failure mode 0007 exists to prevent — pinned so nobody
        # reintroduces a nullable period_end without a backfill.
        sub = Subscription(status=Subscription.Status.ACTIVE, period_end=None)
        state = sub.access_state()
        self.assertTrue(state["locked"])
        self.assertEqual(state["reason"], "period_ended")

    def test_seeded_plans_cap_redirects_and_websites(self):
        from apps.billing.models import Plan
        for slug, redirects, websites in (("basic", 2, 5), ("plus", 5, 10), ("pro", 10, 20)):
            plan = Plan.objects.get(slug=slug)
            self.assertEqual(plan.max_redirects, redirects, slug)
            self.assertEqual(plan.max_websites, websites, slug)

    def test_no_paid_tier_is_left_unlimited(self):
        # billing/models.py: "No tier is unlimited in the weekly model."
        from apps.billing.models import Plan
        self.assertFalse(Plan.objects.filter(max_redirects=0).exists())
        self.assertFalse(Plan.objects.filter(max_websites=0).exists())


class PlanRebrandTest(TestCase):
    """0009 renames the rows to the tiers billing/views.py already looks up."""

    def test_plans_are_the_weekly_tiers(self):
        from apps.billing.models import Plan
        self.assertEqual(
            list(Plan.objects.order_by("sort").values_list("slug", "name", "price")),
            [("basic", "Basic", 25), ("plus", "Plus", 40), ("pro", "Pro", 70)])

    def test_old_monthly_slugs_are_gone(self):
        from apps.billing.models import Plan
        self.assertFalse(Plan.objects.filter(slug__in=["starter", "growth", "business"]).exists())

    def test_new_org_gets_the_basic_plan_on_trial(self):
        # signals.ensure_subscription looked up slug="starter", which no longer
        # exists — a new signup would have been left with no subscription at all.
        user = get_user_model().objects.create_user(
            username="rebrand@example.com", email="rebrand@example.com", password="testpass123")
        org = create_workspace(user, "Rebrand Co")
        sub = Subscription.objects.get(organization=org)
        self.assertEqual(sub.plan.slug, "basic")
        self.assertEqual(sub.status, Subscription.Status.TRIALING)
        self.assertFalse(sub.access_state()["locked"])


class ExpiryGatingTest(TestCase):
    """A workspace past its window loses the product, server-side."""

    def setUp(self):
        self.c = APIClient()
        self.c.post("/api/auth/register/", {"email": "x@example.com", "password": "testpass123",
                                            "first_name": "X"}, format="json")
        access = self.c.post("/api/auth/token/", {"email": "x@example.com", "password": "testpass123"},
                             format="json").json()["access"]
        self.c.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        orgs = self.c.get("/api/organizations/").json()
        self.org = orgs[0]["id"] if isinstance(orgs, list) else orgs["results"][0]["id"]
        self.sub = Subscription.objects.get(organization_id=self.org)

    def _expire(self):
        self.sub.status = Subscription.Status.ACTIVE
        self.sub.period_end = timezone.now() - timedelta(hours=1)
        self.sub.trial_end = timezone.now() - timedelta(days=8)
        self.sub.save()

    def test_expired_workspace_is_locked(self):
        self._expire()
        from apps.billing.entitlements import workspace_locked
        self.assertTrue(workspace_locked(self.org))
        self.assertEqual(self.sub.access_state()["reason"], "period_ended")

    def test_expired_workspace_cannot_create_a_website(self):
        self._expire()
        r = self.c.post("/api/websites/", {"organization": self.org, "name": "Site",
                                           "domain": "example.com"}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_expired_workspace_cannot_create_a_rule(self):
        self._expire()
        r = self.c.post("/api/rules/", {"organization": self.org, "name": "Block bots",
                                        "action": "block", "priority": 1}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_expired_workspace_cannot_create_a_short_link(self):
        self._expire()
        r = self.c.post("/api/links/", {"organization": self.org,
                                        "destination_url": "https://example.com"}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_entitled_workspace_can_still_create(self):
        # Trialing by default — the gate must not block a workspace in-window.
        r = self.c.post("/api/websites/", {"organization": self.org, "name": "Site",
                                           "domain": "example.com"}, format="json")
        self.assertIn(r.status_code, (200, 201))

    def test_reads_stay_open_so_they_can_reach_billing(self):
        self._expire()
        self.assertEqual(self.c.get("/api/websites/").status_code, 200)
        self.assertEqual(self.c.get(f"/api/billing/subscription/?organization={self.org}").status_code, 200)

    def test_enforce_access_revokes_engine_keys_for_an_expired_org(self):
        self._expire()
        with patch("apps.billing.management.commands.enforce_access.revoke_org") as revoke:
            call_command("enforce_access", "--org", str(self.org), verbosity=0)
        revoke.assert_called_once_with(self.org)

    def test_enforce_access_restores_an_entitled_org(self):
        with patch("apps.billing.management.commands.enforce_access.restore_org") as restore:
            call_command("enforce_access", "--org", str(self.org), verbosity=0)
        restore.assert_called_once_with(self.org)

    def test_renewal_restores_engine_access_immediately(self):
        self._expire()
        with patch("apps.billing.views.restore_org") as restore, \
             patch("apps.billing.bachs.is_enabled", return_value=False):
            r = self.c.post("/api/billing/checkout/",
                            {"organization": self.org, "plan": "plus"}, format="json")
        self.assertEqual(r.status_code, 200)
        restore.assert_called_once_with(self.org)
        self.sub.refresh_from_db()
        self.assertFalse(self.sub.access_state()["locked"])


class GrantPlanCommandTest(TestCase):
    """grant_plan must produce a subscription that actually reads as unlocked —
    the trap when doing this by hand is leaving period_end in the past."""

    def setUp(self):
        user = get_user_model().objects.create_user(
            username="grant@example.com", email="grant@example.com", password="testpass123")
        self.org = create_workspace(user, "Grant Co")

    def test_grants_an_active_plan_with_a_future_window(self):
        call_command("grant_plan", "--org", str(self.org.id), "--plan", "pro", verbosity=0)
        sub = Subscription.objects.get(organization=self.org)
        self.assertEqual(sub.plan.slug, "pro")
        self.assertEqual(sub.status, Subscription.Status.ACTIVE)
        self.assertGreater(sub.period_end, timezone.now())
        self.assertFalse(sub.access_state()["locked"])

    def test_accepts_a_slug_and_clears_a_stale_pending_plan(self):
        sub = Subscription.objects.get(organization=self.org)
        sub.pending_plan_slug = "plus"
        sub.save(update_fields=["pending_plan_slug"])
        call_command("grant_plan", "--org", self.org.slug, "--plan", "pro", verbosity=0)
        sub.refresh_from_db()
        self.assertEqual(sub.pending_plan_slug, "")

    def test_days_override(self):
        call_command("grant_plan", "--org", str(self.org.id), "--plan", "basic",
                     "--days", "30", verbosity=0)
        sub = Subscription.objects.get(organization=self.org)
        self.assertGreater(sub.period_end, timezone.now() + timedelta(days=29))

    def test_unknown_plan_is_rejected(self):
        from django.core.management.base import CommandError
        with self.assertRaises(CommandError):
            call_command("grant_plan", "--org", str(self.org.id), "--plan", "enterprise", verbosity=0)

    def test_granting_unlocks_the_redirect_feature(self):
        from apps.billing.models import link_shortener_enabled, redirect_limit
        self.assertFalse(link_shortener_enabled(self.org.id))   # trialing
        call_command("grant_plan", "--org", str(self.org.id), "--plan", "pro", verbosity=0)
        self.assertTrue(link_shortener_enabled(self.org.id))
        self.assertEqual(redirect_limit(self.org.id), 10)


@override_settings(BACHS_PRODUCTS_MONTHLY={"basic": "", "plus": "", "pro": ""})
class MonthlyIntervalTest(TestCase):
    """Weekly and monthly are two prepaid window lengths on the same tier."""

    def setUp(self):
        self.c = APIClient()
        self.c.post("/api/auth/register/", {"email": "iv@example.com", "password": "testpass123",
                                            "first_name": "I"}, format="json")
        access = self.c.post("/api/auth/token/", {"email": "iv@example.com", "password": "testpass123"},
                             format="json").json()["access"]
        self.c.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        orgs = self.c.get("/api/organizations/").json()
        self.org = orgs[0]["id"] if isinstance(orgs, list) else orgs["results"][0]["id"]

    def _checkout(self, plan, interval=None):
        body = {"organization": self.org, "plan": plan}
        if interval:
            body["interval"] = interval
        with patch("apps.billing.bachs.is_enabled", return_value=False):
            return self.c.post("/api/billing/checkout/", body, format="json")

    def test_monthly_prices_are_seeded(self):
        from apps.billing.models import Plan
        self.assertEqual(
            {p.slug: p.price_monthly for p in Plan.objects.all()},
            {"basic": 50, "plus": 100, "pro": 150})

    def test_monthly_is_cheaper_than_four_weeks(self):
        # If this ever inverts, the toggle is advertising a discount that isn't one.
        from apps.billing.models import Plan
        for p in Plan.objects.all():
            self.assertLess(p.price_monthly, p.price * 4, p.slug)

    def test_weekly_checkout_gives_a_7_day_window(self):
        self.assertEqual(self._checkout("plus").status_code, 200)
        sub = Subscription.objects.get(organization_id=self.org)
        self.assertEqual(sub.interval, "weekly")
        self.assertEqual(sub.period_days, 7)

    def test_monthly_checkout_gives_a_30_day_window(self):
        self.assertEqual(self._checkout("plus", "monthly").status_code, 200)
        sub = Subscription.objects.get(organization_id=self.org)
        self.assertEqual(sub.interval, "monthly")
        self.assertEqual(sub.period_days, 30)
        # 30 days plus whatever trial time was left, thanks to rollover.
        self.assertGreater(sub.period_end, timezone.now() + timedelta(days=29))

    def test_defaults_to_weekly_when_no_interval_is_sent(self):
        self._checkout("basic")
        self.assertEqual(Subscription.objects.get(organization_id=self.org).interval, "weekly")

    def test_bad_interval_is_rejected(self):
        r = self._checkout("basic", "yearly")
        self.assertEqual(r.status_code, 400)
        self.assertIn("weekly", r.json()["detail"])

    def test_switching_interval_keeps_the_tier_and_rolls_days_over(self):
        self._checkout("pro", "weekly")
        sub = Subscription.objects.get(organization_id=self.org)
        weekly_end = sub.period_end
        self._checkout("pro", "monthly")
        sub.refresh_from_db()
        self.assertEqual(sub.plan.slug, "pro")
        self.assertEqual(sub.interval, "monthly")
        self.assertGreater(sub.period_end, weekly_end)   # no time lost in the switch

    def test_price_and_product_resolve_per_interval(self):
        from apps.billing.models import Plan
        pro = Plan.objects.get(slug="pro")
        self.assertEqual(pro.price_for("weekly"), 70)
        self.assertEqual(pro.price_for("monthly"), 150)
        pro.bachs_product_id = "prod_weekly"
        pro.bachs_product_id_monthly = "prod_monthly"
        self.assertEqual(pro.product_for("weekly"), "prod_weekly")
        self.assertEqual(pro.product_for("monthly"), "prod_monthly")

    def test_monthly_is_refused_while_the_tier_has_no_monthly_price(self):
        from apps.billing.models import Plan
        Plan.objects.filter(slug="basic").update(price_monthly=0)
        r = self._checkout("basic", "monthly")
        self.assertEqual(r.status_code, 400)
        self.assertIn("monthly", r.json()["detail"])

    def test_grant_plan_can_grant_monthly(self):
        call_command("grant_plan", "--org", str(self.org), "--plan", "pro",
                     "--interval", "monthly", verbosity=0)
        sub = Subscription.objects.get(organization_id=self.org)
        self.assertEqual(sub.interval, "monthly")
        self.assertEqual(sub.period_days, 30)
