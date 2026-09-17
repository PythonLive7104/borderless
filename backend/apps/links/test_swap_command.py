from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from io import StringIO

from apps.links.models import PrivateDomainPurchase, ShortDomain, ShortLink
from apps.links.tests import _workspace


class SwapPrivateDomainTest(TestCase):
    def setUp(self):
        self.org = _workspace("swap@priv.example")
        self.until = timezone.now() + timedelta(days=21)
        self.old = ShortDomain.objects.create(
            host="gonb.cc", active=True, verified_at=timezone.now(),
            is_shared=False, organization=self.org, private_until=self.until)
        self.new = ShortDomain.objects.create(
            host="braesse.com", active=True, verified_at=timezone.now(), is_shared=False)
        self.purchase = PrivateDomainPurchase.objects.create(
            organization=self.org, amount=10, domain=self.old)

    def _run(self, *args):
        out = StringIO()
        call_command("swap_private_domain", "gonb.cc", "braesse.com", *args, stdout=out)
        return out.getvalue()

    def test_the_rental_moves_and_keeps_its_paid_through_date(self):
        self._run()
        self.new.refresh_from_db(); self.old.refresh_from_db()
        self.assertEqual(self.new.organization, self.org)
        self.assertEqual(self.new.private_until, self.until)   # no paid time lost
        self.assertIsNone(self.old.organization)
        self.assertIsNone(self.old.private_until)

    def test_the_returned_domain_is_sellable_again_not_shared(self):
        self._run()
        self.old.refresh_from_db()
        self.assertFalse(self.old.is_shared)                   # never the shared pool
        self.assertIn("gonb.cc", ShortDomain.private_stock().values_list("host", flat=True))

    def test_renew_now_targets_the_domain_they_actually_hold(self):
        self._run()
        self.purchase.refresh_from_db()
        self.assertEqual(self.purchase.domain, self.new)

    def test_it_refuses_when_the_old_domain_still_has_links(self):
        ShortLink.objects.create(organization=self.org, domain=self.old,
                                 slug="keepme", destination_url="https://example.com")
        with self.assertRaises(CommandError):
            self._run()
        self.new.refresh_from_db()
        self.assertIsNone(self.new.organization)               # nothing moved

    def test_dry_run_changes_nothing(self):
        self._run("--dry-run")
        self.new.refresh_from_db(); self.old.refresh_from_db()
        self.assertIsNone(self.new.organization)
        self.assertEqual(self.old.organization, self.org)
