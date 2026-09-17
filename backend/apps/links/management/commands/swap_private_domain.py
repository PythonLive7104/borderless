"""Move a workspace's private domain rental onto a different host.

Needed when someone is handed the wrong domain — before buyers could choose,
fulfilment took whichever sorted first, so a customer who asked for one host
could end up renting another.

The rental moves with its paid-through date, and the domain given back returns
to private STOCK (not the shared pool), so it can be sold again.
"""
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from ...models import PrivateDomainPurchase, ShortDomain


class Command(BaseCommand):
    help = "Move a workspace's private domain rental from one host to another."

    def add_arguments(self, parser):
        parser.add_argument("old_host", help="The domain they were given, and are giving back.")
        parser.add_argument("new_host", help="The domain they should have. Must be unsold stock.")
        parser.add_argument("--dry-run", action="store_true",
                            help="Check and report, change nothing.")

    def _show(self, label, old_host, new_host):
        self.stdout.write(f"--- {label} ---")
        for host in (old_host, new_host):
            d = ShortDomain.objects.get(host=host)
            self.stdout.write(
                f"  {d.host:<16} org={d.organization_id} shared={d.is_shared} "
                f"until={d.private_until} links={d.links.count()} "
                f"in_stock={ShortDomain.private_stock().filter(pk=d.pk).exists()}")

    def handle(self, *args, **opts):
        old_host, new_host = opts["old_host"].lower(), opts["new_host"].lower()
        try:
            old = ShortDomain.objects.get(host=old_host)
            new = ShortDomain.objects.get(host=new_host)
        except ShortDomain.DoesNotExist as e:
            raise CommandError(f"No such domain: {e}")

        self._show("before", old_host, new_host)

        # Refuse rather than damage anything — every assumption checked up front.
        if not old.organization_id:
            raise CommandError(f"{old_host} is not rented to anyone.")
        if old.links.exists():
            raise CommandError(
                f"{old_host} has {old.links.count()} link(s) — moving it would stop them "
                f"resolving. Repoint or delete them first.")
        if new.organization_id is not None:
            raise CommandError(f"{new_host} is already rented to org {new.organization_id}.")
        if not (new.active and new.verified_at):
            raise CommandError(f"{new_host} is not active/verified — run sync_short_domains first.")

        if opts["dry_run"]:
            self.stdout.write(self.style.WARNING(
                f"would move org {old.organization_id} from {old_host} to {new_host} "
                f"(paid through {old.private_until}) and return {old_host} to stock"))
            return

        org_id = old.organization_id
        with transaction.atomic():
            # Carry the paid-through date across so they lose no time they paid for.
            new.organization_id, new.is_shared, new.is_default = org_id, False, False
            new.private_until = old.private_until
            new.save(update_fields=["organization", "is_shared", "is_default", "private_until"])

            # Back to private stock, NOT the shared pool: it is still stock to sell.
            old.organization, old.private_until = None, None
            old.is_shared = old.is_default = False
            old.save(update_fields=["organization", "private_until", "is_shared", "is_default"])

            # Point their purchase history at what they actually hold, so Renew
            # extends the new domain rather than the one they gave back.
            d = PrivateDomainPurchase.objects.filter(
                domain=old, organization_id=org_id).update(domain=new)
            r = PrivateDomainPurchase.objects.filter(
                renew_domain=old, organization_id=org_id).update(renew_domain=new)

        self.stdout.write(self.style.SUCCESS(
            f"  moved org {org_id}: {old_host} -> {new_host}; "
            f"repointed {d} purchase(s), {r} renewal(s)"))
        self._show("after", old_host, new_host)
