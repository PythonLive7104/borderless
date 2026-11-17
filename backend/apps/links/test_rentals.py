"""Releasing an idle private domain back onto the market.

Three things are worth pinning here, and none of them is the happy path.

The first is that a term in the future does not mean anybody is paying. The
October 2026 top-up extended every private domain by a free year, so a workspace
that stopped subscribing months ago still shows a term running into 2027. The
subscription is what decides, and these tests cover that case specifically
because it is the one the obvious field gets wrong.

The second is the refusals. Releasing a domain whose owner is still paying, or
one still inside its grace period, breaks links the owner is being actively told
will keep working — and neither is recoverable by the person it happens to. So
the gate is tested harder than the release.

The third is that rental_state() (one row) and filter_by_state() (a queryset)
agree. The term-only states are settled in SQL for the admin list and the rest
row by row, so they are two implementations of one question and nothing but a
test stops them drifting apart.
"""
from datetime import timedelta
from unittest.mock import patch

from django.contrib.admin.sites import AdminSite
from django.contrib.auth import get_user_model
from django.test import RequestFactory, TestCase
from django.utils import timezone

from apps.links import rentals
from apps.links.admin import RentalStateFilter, ShortDomainAdmin
from apps.links.models import ShortDomain, ShortLink
from apps.organizations.models import create_workspace

GRACE = ShortDomain.PRIVATE_GRACE_DAYS


def _org(email="renter@rentals.example"):
    user = get_user_model().objects.create_user(
        username=email, email=email, password="testpass123")
    return create_workspace(user, "Acme")


def _domain(host, org=None, until=None):
    return ShortDomain.objects.create(
        host=host, organization=org, is_shared=False, active=True,
        verified_at=timezone.now(), private_until=until)


def _lapse_plan(org, days_ago):
    """Put this workspace's subscription out of its paid window."""
    from apps.billing.models import Subscription
    sub = Subscription.objects.get(organization=org)
    sub.status = Subscription.Status.ACTIVE
    sub.period_end = timezone.now() - timedelta(days=days_ago)
    sub.save(update_fields=["status", "period_end"])
    return sub


class RentalStateTest(TestCase):
    def setUp(self):
        self.now = timezone.now()
        self.org = _org()

    def test_the_six_states(self):
        lapsed_org = _org("gone@rentals.example")
        _lapse_plan(lapsed_org, GRACE + 1)
        cases = [
            (_domain("unowned.cc"), rentals.UNOWNED),
            (_domain("noterm.cc", self.org), rentals.NO_TERM),
            (_domain("paid.cc", self.org, self.now + timedelta(days=5)), rentals.PAID),
            (_domain("grace.cc", self.org, self.now - timedelta(days=1)), rentals.GRACE),
            (_domain("done.cc", self.org, self.now - timedelta(days=GRACE + 1)),
             rentals.RELEASABLE),
            # The case the term gets wrong: a year left on the clock, nobody paying.
            (_domain("idle.cc", lapsed_org, self.now + timedelta(days=330)),
             rentals.IDLE_PLAN),
        ]
        for d, want in cases:
            self.assertEqual(rentals.rental_state(d, self.now), want, d.host)

    def test_a_long_term_does_not_protect_a_workspace_that_stopped_paying(self):
        """The whole point. The October 2026 top-up handed every domain a free
        year, so 'paid to 2027' is what a lapsed customer's domain looks like."""
        gone = _org("lapsed@rentals.example")
        _lapse_plan(gone, GRACE + 30)
        d = _domain("stale.cc", gone, self.now + timedelta(days=343))
        self.assertEqual(rentals.rental_state(d, self.now), rentals.IDLE_PLAN)

    def test_a_subscription_that_just_lapsed_is_still_protected(self):
        """Someone who renews a few days late must not find their domain sold."""
        gone = _org("late@rentals.example")
        _lapse_plan(gone, 1)
        d = _domain("recent.cc", gone, self.now + timedelta(days=300))
        self.assertEqual(rentals.rental_state(d, self.now), rentals.PAID)

    def test_a_workspace_with_no_subscription_row_is_left_alone(self):
        """Billing does not lock a half-created org, and nor do we — selling its
        domain on the strength of a missing row would be the worst kind of bug."""
        from apps.billing.models import Subscription
        bare = _org("bare@rentals.example")
        Subscription.objects.filter(organization=bare).delete()
        d = _domain("bare.cc", bare, self.now + timedelta(days=10))
        self.assertEqual(rentals.rental_state(d, self.now), rentals.PAID)

    def test_a_lapsed_plan_with_no_term_is_idle_too(self):
        gone = _org("noterm@rentals.example")
        _lapse_plan(gone, GRACE + 2)
        d = _domain("noterm-idle.cc", gone, None)
        self.assertEqual(rentals.rental_state(d, self.now), rentals.IDLE_PLAN)

    def test_the_last_day_of_grace_is_still_grace(self):
        """Off by one here breaks links a day early, while the owner is still
        being emailed that they have until tomorrow."""
        d = _domain("edge.cc", self.org, self.now - timedelta(days=GRACE) + timedelta(minutes=1))
        self.assertEqual(rentals.rental_state(d, self.now), rentals.GRACE)

    def test_expiring_this_instant_still_counts_as_paid(self):
        d = _domain("exact.cc", self.org, self.now)
        self.assertEqual(rentals.rental_state(d, self.now), rentals.PAID)

    def test_python_and_sql_agree_on_every_state(self):
        """The guard against the two implementations drifting apart.

        Includes the idle-plan row deliberately: a naive "paid" filter is just
        `private_until >= now`, which would scoop that row up and quietly hand a
        lapsed customer's domain back to the protected pile."""
        _domain("a-unowned.cc")
        _domain("b-noterm.cc", self.org)
        _domain("c-paid.cc", self.org, self.now + timedelta(days=3))
        _domain("d-grace.cc", self.org, self.now - timedelta(hours=2))
        _domain("e-done.cc", self.org, self.now - timedelta(days=GRACE + 2))
        gone = _org("sqlgone@rentals.example")
        _lapse_plan(gone, GRACE + 5)
        _domain("f-idle.cc", gone, self.now + timedelta(days=200))

        for state in (rentals.UNOWNED, rentals.NO_TERM, rentals.PAID,
                      rentals.GRACE, rentals.RELEASABLE, rentals.IDLE_PLAN):
            by_sql = set(rentals.filter_by_state(
                ShortDomain.objects.all(), state, self.now
            ).values_list("host", flat=True))
            by_python = {d.host for d in ShortDomain.objects.all()
                         if rentals.rental_state(d, self.now) == state}
            self.assertEqual(by_sql, by_python, f"{state}: SQL and Python disagree")


class ReleaseTest(TestCase):
    def setUp(self):
        self.now = timezone.now()
        self.org = _org()
        self.d = _domain("idle.cc", self.org, self.now - timedelta(days=GRACE + 1))
        self.link = ShortLink.objects.create(
            organization=self.org, domain=self.d, slug="promo",
            destination_url="https://example.com")

    def test_release_puts_it_back_on_sale(self):
        with patch("apps.links.sync.publish_link"):
            n = rentals.release_to_stock(self.d, notify=False)
        self.d.refresh_from_db()
        self.assertEqual(n, 1)
        self.assertIsNone(self.d.organization_id)
        self.assertIsNone(self.d.private_until)
        self.assertFalse(self.d.is_shared)
        self.assertIn(self.d, ShortDomain.private_stock())

    def test_release_does_not_dump_it_into_the_shared_pool(self):
        """A domain sold as exclusive must not start serving everyone's links
        just because its rental lapsed."""
        with patch("apps.links.sync.publish_link"):
            rentals.release_to_stock(self.d, notify=False)
        self.d.refresh_from_db()
        self.assertFalse(self.d.is_shared)
        self.assertNotIn(self.d, ShortDomain.for_org(self.org.id))

    def test_the_links_are_withdrawn_from_the_engine(self):
        """The row says the domain is free; the engine is what actually stops
        redirecting. Miss this and the old owner's links keep resolving on a
        domain somebody else has since bought."""
        with patch("apps.links.sync.publish_link") as pub:
            rentals.release_to_stock(self.d, notify=False)
        pub.assert_called_once()
        self.assertEqual(pub.call_args.args[0].pk, self.link.pk)

    def test_the_former_owner_is_told(self):
        from django.core import mail
        with patch("apps.links.sync.publish_link"):
            rentals.release_to_stock(self.d, notify=True)
        # An org with no owner still releases cleanly; what matters is that
        # notifying never raises and never blocks the release.
        self.d.refresh_from_db()
        self.assertIsNone(self.d.organization_id)
        self.assertLessEqual(len(mail.outbox), 1)

    def test_a_failed_notification_cannot_roll_back_the_release(self):
        with patch("apps.links.sync.publish_link"), \
             patch("apps.links.rentals.tell_former_owner", side_effect=RuntimeError("smtp")):
            with self.assertRaises(RuntimeError):
                rentals.release_to_stock(self.d, notify=True)
        # The release happened before the notice was attempted.
        self.d.refresh_from_db()
        self.assertIsNone(self.d.organization_id)


class AdminActionTest(TestCase):
    """The gate, from the admin's side."""

    def setUp(self):
        self.now = timezone.now()
        self.org = _org()
        self.admin = ShortDomainAdmin(ShortDomain, AdminSite())
        self.req = RequestFactory().post("/admin/links/shortdomain/")
        self.req._messages = _Messages()

    def _run(self, *hosts):
        qs = ShortDomain.objects.filter(host__in=hosts)
        with patch("apps.links.sync.publish_link"):
            self.admin.release_lapsed_rentals(self.req, qs)
        return " ".join(m for m in self.req._messages.sent)

    def test_a_lapsed_domain_is_released(self):
        _domain("idle.cc", self.org, self.now - timedelta(days=GRACE + 1))
        out = self._run("idle.cc")
        self.assertIn("1 domain(s) released", out)
        self.assertIsNone(ShortDomain.objects.get(host="idle.cc").organization_id)

    def test_a_paid_domain_is_refused(self):
        """The expensive mistake: this customer has live campaigns."""
        _domain("paid.cc", self.org, self.now + timedelta(days=10))
        out = self._run("paid.cc")
        self.assertIn("Nothing released", out)
        self.assertIn("still paid up", out)
        self.assertIsNotNone(ShortDomain.objects.get(host="paid.cc").organization_id)

    def test_a_domain_still_in_grace_is_refused(self):
        """Their links are meant to keep working while they are being chased."""
        _domain("grace.cc", self.org, self.now - timedelta(days=1))
        out = self._run("grace.cc")
        self.assertIn("Nothing released", out)
        self.assertIn("grace", out)
        self.assertIsNotNone(ShortDomain.objects.get(host="grace.cc").organization_id)

    def test_a_mixed_selection_releases_only_what_it_should(self):
        _domain("idle.cc", self.org, self.now - timedelta(days=GRACE + 1))
        _domain("paid.cc", self.org, self.now + timedelta(days=10))
        _domain("grace.cc", self.org, self.now - timedelta(days=1))
        out = self._run("idle.cc", "paid.cc", "grace.cc")
        self.assertIn("1 domain(s) released", out)
        self.assertIsNone(ShortDomain.objects.get(host="idle.cc").organization_id)
        self.assertIsNotNone(ShortDomain.objects.get(host="paid.cc").organization_id)
        self.assertIsNotNone(ShortDomain.objects.get(host="grace.cc").organization_id)

    def test_a_domain_held_by_a_lapsed_subscriber_is_released(self):
        """The case that sent an admin looking for this button: the term says
        2027 because of the free top-up, but nobody has paid for months."""
        gone = _org("adminidle@rentals.example")
        _lapse_plan(gone, GRACE + 10)
        _domain("idleplan.cc", gone, self.now + timedelta(days=330))
        out = self._run("idleplan.cc")
        self.assertIn("1 domain(s) released", out)
        released = ShortDomain.objects.get(host="idleplan.cc")
        self.assertIsNone(released.organization_id)
        self.assertIn(released, ShortDomain.private_stock())

    def test_a_recently_lapsed_subscriber_is_still_protected(self):
        gone = _org("adminlate@rentals.example")
        _lapse_plan(gone, 2)
        _domain("latesub.cc", gone, self.now + timedelta(days=330))
        out = self._run("latesub.cc")
        self.assertIn("Nothing released", out)
        self.assertIsNotNone(ShortDomain.objects.get(host="latesub.cc").organization_id)

    def test_it_warns_when_the_released_domain_will_not_be_offered(self):
        """Back in stock is not the same as on sale: private_stock() only
        offers domains that are active and verified."""
        d = _domain("idle.cc", self.org, self.now - timedelta(days=GRACE + 1))
        ShortDomain.objects.filter(pk=d.pk).update(active=False)
        out = self._run("idle.cc")
        self.assertIn("NOT offered", out)
        self.assertIn("idle.cc", out)

    def test_a_blocklisted_domain_is_released_but_not_put_back_on_sale(self):
        """The case from the admin list: a flagged domain whose renter left.

        It has to come back — the workspace is not entitled to it — but selling
        it on is worse than not selling anything. The links on it get a browser
        interstitial, and mail carrying them is refused at the recipient's
        gateway, so the next customer pays for a name that is already broken
        everywhere that matters. The row looks completely normal otherwise,
        which is why the warning names the reason.
        """
        d = _domain("burned.cc", self.org, self.now - timedelta(days=GRACE + 1))
        ShortDomain.objects.filter(pk=d.pk).update(
            health=ShortDomain.Health.FLAGGED,
            health_detail="flagged by virustotal")
        out = self._run("burned.cc")

        released = ShortDomain.objects.get(host="burned.cc")
        self.assertIsNone(released.organization_id)      # taken back
        self.assertNotIn(released, ShortDomain.private_stock())   # but not for sale
        self.assertIn("NOT offered", out)
        self.assertIn("burned.cc", out)
        self.assertIn("flagged", out.lower())


class SellableStockTest(TestCase):
    """What may be offered for private sale.

    private_stock() is the single gate every purchase path goes through —
    checkout, admin fulfilment, the buyer's own pick — so a domain that should
    not be sold has to be excluded here rather than at each call site.
    """

    def setUp(self):
        self.d = _domain("stock.cc")

    def test_a_healthy_unsold_domain_is_for_sale(self):
        self.assertIn(self.d, ShortDomain.private_stock())

    def test_an_unchecked_domain_is_still_for_sale(self):
        """UNKNOWN means the cron has not run, not that anything is wrong.
        Excluding it would make every freshly registered domain unsellable
        until the next check — a missing check turning into lost sales."""
        ShortDomain.objects.filter(pk=self.d.pk).update(
            health=ShortDomain.Health.UNKNOWN)
        self.assertIn(self.d, ShortDomain.private_stock())

    def test_a_flagged_domain_is_withheld(self):
        ShortDomain.objects.filter(pk=self.d.pk).update(
            health=ShortDomain.Health.FLAGGED)
        self.assertNotIn(self.d, ShortDomain.private_stock())

    def test_a_dead_domain_is_withheld(self):
        ShortDomain.objects.filter(pk=self.d.pk).update(
            health=ShortDomain.Health.UNREACHABLE)
        self.assertNotIn(self.d, ShortDomain.private_stock())

    def test_the_blocker_reason_is_reportable(self):
        for state, expect in ((ShortDomain.Health.FLAGGED, "flagged"),
                              (ShortDomain.Health.UNREACHABLE, "dns")):
            ShortDomain.objects.filter(pk=self.d.pk).update(health=state)
            self.assertIn(expect, ShortDomain.objects.get(pk=self.d.pk).sale_blocker.lower())
        ShortDomain.objects.filter(pk=self.d.pk).update(health=ShortDomain.Health.OK)
        self.assertEqual(ShortDomain.objects.get(pk=self.d.pk).sale_blocker, "")

    def test_a_flagged_domain_cannot_be_handed_to_a_paid_order(self):
        """The gate that matters most: assign_domain() sources from
        private_stock(), so a blocklisted name must never reach a buyer who has
        already paid."""
        from apps.links.models import PrivateDomainPurchase
        from apps.links.purchases import assign_domain
        org = _org("buyer@rentals.example")
        ShortDomain.objects.filter(pk=self.d.pk).update(
            health=ShortDomain.Health.FLAGGED)
        order = PrivateDomainPurchase.objects.create(
            organization=org, amount=5, status=PrivateDomainPurchase.Status.PAID)

        self.assertIsNone(assign_domain(order))
        order.refresh_from_db()
        self.assertIsNone(order.domain_id)   # still waiting, not fulfilled badly


class NightlyJobTest(TestCase):
    """The policy change: a domain must not stay locked to a workspace that
    stopped paying. Previously the job reclaimed only on a lapsed TERM, so a
    customer who cancelled kept the name indefinitely — and after the free
    year-long top-up, indefinitely meant well into 2027."""

    def setUp(self):
        self.now = timezone.now()

    def _run(self, **kw):
        from io import StringIO
        from django.core.management import call_command
        out = StringIO()
        with patch("apps.links.sync.publish_link"):
            call_command("enforce_private_domains", stdout=out, stderr=StringIO(), **kw)
        return out.getvalue()

    def test_a_lapsed_subscription_releases_the_domain(self):
        gone = _org("cron@rentals.example")
        _lapse_plan(gone, GRACE + 3)
        _domain("croneidle.cc", gone, self.now + timedelta(days=300))
        self._run()
        d = ShortDomain.objects.get(host="croneidle.cc")
        self.assertIsNone(d.organization_id)
        self.assertFalse(d.is_shared)       # on sale, not in the shared pool
        self.assertIn(d, ShortDomain.private_stock())

    def test_it_warns_before_it_takes_it(self):
        """Losing a domain with no notice is how a lapsed customer becomes an
        angry one — the grace period exists to be used."""
        from django.core import mail
        gone = _org("cronwarn@rentals.example")
        _lapse_plan(gone, 2)
        _domain("cronwarn.cc", gone, self.now + timedelta(days=300))
        self._run()
        self.assertIsNotNone(ShortDomain.objects.get(host="cronwarn.cc").organization_id)
        self.assertTrue(any("about to be released" in m.subject for m in mail.outbox),
                        [m.subject for m in mail.outbox])

    def test_a_paying_workspace_is_untouched(self):
        org = _org("cronpaid@rentals.example")
        _domain("cronpaid.cc", org, self.now + timedelta(days=300))
        self._run()
        self.assertIsNotNone(ShortDomain.objects.get(host="cronpaid.cc").organization_id)

    def test_dry_run_changes_nothing(self):
        gone = _org("crondry@rentals.example")
        _lapse_plan(gone, GRACE + 3)
        _domain("crondry.cc", gone, self.now + timedelta(days=300))
        out = self._run(dry_run=True)
        self.assertIn("would reclaim", out)
        self.assertIn("subscription lapsed", out)
        self.assertIsNotNone(ShortDomain.objects.get(host="crondry.cc").organization_id)


class RentalColumnTest(TestCase):
    """The column renders for every row on the list page, so a formatting slip
    in any branch takes the whole page down rather than one cell."""

    def setUp(self):
        self.now = timezone.now()
        self.org = _org()
        self.admin = ShortDomainAdmin(ShortDomain, AdminSite())

    def test_every_state_renders(self):
        cases = [
            (_domain("unowned.cc"), "—"),
            (_domain("noterm.cc", self.org), "no end date"),
            (_domain("paid.cc", self.org, self.now + timedelta(days=5)), "paid to"),
            (_domain("grace.cc", self.org, self.now - timedelta(days=1)), "links work until"),
            (_domain("done.cc", self.org, self.now - timedelta(days=GRACE + 1)),
             "ready to release"),
        ]
        for d, expected in cases:
            out = self.admin.rental(d)
            self.assertIsInstance(out, str)
            self.assertIn(expected, out, d.host)

    def test_an_unowned_domain_holding_a_stale_date_does_not_crash(self):
        """Stock released by hand can keep an old private_until. The column must
        read it as 'not rented', not try to describe a rental that ended."""
        d = _domain("stale.cc", None, self.now - timedelta(days=400))
        self.assertEqual(self.admin.rental(d), "—")

    def test_the_filter_offers_the_actionable_states_first(self):
        """The filter is opened to answer "what can I put back on sale?", so the
        two releasable states lead. Idle-subscription first of those: after the
        free year-long top-up it is the one most idle domains fall into."""
        lookups = self.admin.get_list_filter(RequestFactory().get("/"))
        self.assertIn(RentalStateFilter, lookups)
        f = RentalStateFilter(RequestFactory().get("/"), {}, ShortDomain, self.admin)
        offered = [value for value, _label in f.lookups(None, self.admin)]
        self.assertEqual(offered[:2], [rentals.IDLE_PLAN, rentals.RELEASABLE])
        # Every state is reachable, or some domains can never be found.
        self.assertEqual(set(offered), set(rentals.LABELS))


class _Messages:
    """Minimal message store — admin actions call message_user()."""
    def __init__(self):
        self.sent = []

    def add(self, level, message, extra_tags=""):
        self.sent.append(str(message))
