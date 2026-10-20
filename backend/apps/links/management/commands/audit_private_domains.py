"""Find workspaces holding more private domains than they paid for.

A concurrent-fulfilment bug could hand one purchase two domains: the webhook,
the browser's verify poll and the reconcile cron each loaded their own copy of
the purchase, all saw it unfulfilled, and the stock query's skip_locked handed
the second caller the NEXT free domain instead of making it wait. The lock in
purchases.assign_domain stops it happening again; this finds what it already did.

Reports by default. --apply releases the extras back to stock, newest first, and
never touches a domain that already has links published on it — taking back a
host a customer is actively using would break live redirects, which is worse
than the overpayment it corrects. Those are listed for a human to settle.
"""
from django.core.management.base import BaseCommand
from django.db.models import Count

from apps.links.models import PrivateDomainPurchase, ShortDomain, ShortLink
from apps.organizations.models import Organization


class Command(BaseCommand):
    help = "Report (or release) private domains a workspace was never charged for."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true",
                            help="Actually release the extras. Without it, reports only.")
        parser.add_argument("--org", type=int, default=None)

    def handle(self, *args, **opts):
        orgs = Organization.objects.all()
        if opts["org"]:
            orgs = orgs.filter(pk=opts["org"])

        extras = kept = 0
        for org in orgs:
            owned = list(ShortDomain.private_for(org.id).order_by("private_until", "id"))
            if not owned:
                continue
            # Every fulfilled purchase entitles them to one domain. Renewals
            # extend a domain they already own, so they buy no new entitlement.
            paid = (PrivateDomainPurchase.objects
                    .filter(organization=org,
                            status=PrivateDomainPurchase.Status.FULFILLED,
                            renew_domain__isnull=True)
                    .count())
            if len(owned) <= paid:
                continue

            over = len(owned) - paid
            self.stdout.write(self.style.WARNING(
                f"{org.slug}: owns {len(owned)} private domain(s), paid for {paid}"))

            # Keep the oldest (the one they have had longest and most likely
            # built links on); the newest are the duplicates the race created.
            for d in reversed(owned):
                if over <= 0:
                    break
                in_use = ShortLink.objects.filter(domain=d).count()
                if in_use:
                    kept += 1
                    self.stdout.write(
                        f"    {d.host} — {in_use} live link(s), NOT released. Settle by hand.")
                    continue
                extras += 1
                over -= 1
                if opts["apply"]:
                    d.organization = None
                    d.is_default = False
                    d.private_until = None
                    d.save(update_fields=["organization", "is_default", "private_until"])
                    self.stdout.write(self.style.SUCCESS(f"    {d.host} — released to stock"))
                else:
                    self.stdout.write(f"    {d.host} — would release (no links on it)")

        if not extras and not kept:
            self.stdout.write(self.style.SUCCESS("No workspace holds more than it paid for."))
            return
        verb = "Released" if opts["apply"] else "Would release"
        self.stdout.write(self.style.SUCCESS(f"{verb} {extras} domain(s); {kept} need a human."))
        if not opts["apply"] and extras:
            self.stdout.write("Re-run with --apply to act on it.")
