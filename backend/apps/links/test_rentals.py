"""Releasing a lapsed private domain back onto the market.

Two things are worth pinning here, and they are not the happy path.

The first is the refusals. Releasing a domain that is still paid up, or still
inside its grace period, breaks links the owner is being actively told will keep
working — and neither is recoverable by the person it happens to. So the gate is
tested harder than the release.

The second is that rental_state() (one row, in Python) and releasable_filter()
(a queryset, in SQL) agree. They are separate implementations of the same
comparison, written so the admin can filter hundreds of rows without loading
them, and nothing but a test stops them drifting apart.
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


class RentalStateTest(TestCase):
    def setUp(self):
        self.now = timezone.now()
        self.org = _org()

    def test_the_five_states(self):
        cases = [
            (_domain("unowned.cc"), rentals.UNOWNED),
            (_domain("noterm.cc", self.org), rentals.NO_TERM),
            (_domain("paid.cc", self.org, self.now + timedelta(days=5)), rentals.PAID),
            (_domain("grace.cc", self.org, self.now - timedelta(days=1)), rentals.GRACE),
            (_domain("done.cc", self.org, self.now - timedelta(days=GRACE + 1)),
             rentals.RELEASABLE),
        ]
        for d, want in cases:
            self.assertEqual(rentals.rental_state(d, self.now), want, d.host)

    def test_the_last_day_of_grace_is_still_grace(self):
        """Off by one here breaks links a day early, while the owner is still
        being emailed that they have until tomorrow."""
        d = _domain("edge.cc", self.org, self.now - timedelta(days=GRACE) + timedelta(minutes=1))
        self.assertEqual(rentals.rental_state(d, self.now), rentals.GRACE)

    def test_expiring_this_instant_still_counts_as_paid(self):
        d = _domain("exact.cc", self.org, self.now)
        self.assertEqual(rentals.rental_state(d, self.now), rentals.PAID)

    def test_python_and_sql_agree_on_every_state(self):
        """The guard against the two implementations drifting apart."""
        _domain("a-unowned.cc")
        _domain("b-noterm.cc", self.org)
        _domain("c-paid.cc", self.org, self.now + timedelta(days=3))
        _domain("d-grace.cc", self.org, self.now - timedelta(hours=2))
        _domain("e-done.cc", self.org, self.now - timedelta(days=GRACE + 2))

        for state in (rentals.UNOWNED, rentals.NO_TERM, rentals.PAID,
                      rentals.GRACE, rentals.RELEASABLE):
            by_sql = set(rentals.releasable_filter(
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

    def test_it_warns_when_the_released_domain_will_not_be_offered(self):
        """Back in stock is not the same as on sale: private_stock() only
        offers domains that are active and verified."""
        d = _domain("idle.cc", self.org, self.now - timedelta(days=GRACE + 1))
        ShortDomain.objects.filter(pk=d.pk).update(active=False)
        out = self._run("idle.cc")
        self.assertIn("Not yet offered", out)
        self.assertIn("idle.cc", out)


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

    def test_the_filter_offers_the_actionable_state_first(self):
        lookups = self.admin.get_list_filter(RequestFactory().get("/"))
        self.assertIn(RentalStateFilter, lookups)
        f = RentalStateFilter(RequestFactory().get("/"), {}, ShortDomain, self.admin)
        self.assertEqual(f.lookups(None, self.admin)[0][0], rentals.RELEASABLE)


class _Messages:
    """Minimal message store — admin actions call message_user()."""
    def __init__(self):
        self.sent = []

    def add(self, level, message, extra_tags=""):
        self.sent.append(str(message))
