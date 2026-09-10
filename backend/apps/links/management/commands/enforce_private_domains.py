"""Keep private-domain rentals honest, without breaking live campaigns.

A private domain is rented for 30 days at a time. When it lapses the links on it
keep working through a grace period and the owner is reminded — a redirect may
already be printed on an ad or sitting in someone's inbox, so pulling it the
moment a payment is late would break traffic the customer is paying for
elsewhere. Only after the grace period does the domain go back into stock.

Schedule daily (see deploy/README.md).
"""
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.links.models import ShortDomain
from apps.links.sync import publish_link


class Command(BaseCommand):
    help = "Remind, then reclaim, private domains whose rental has lapsed."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **opts):
        from django.conf import settings
        from django.core.mail import send_mail

        now = timezone.now()
        dry = opts["dry_run"]
        reminded = reclaimed = 0

        rented = ShortDomain.objects.filter(organization__isnull=False, is_shared=False,
                                            private_until__isnull=False).select_related("organization")
        for d in rented:
            owner = getattr(getattr(d, "organization", None), "owner", None)
            email = getattr(owner, "email", "")
            front = settings.FRONTEND_URL.rstrip("/")

            if now <= d.private_until:
                continue                                   # still paid up

            if now < d.private_grace_ends:
                reminded += 1
                if dry:
                    self.stdout.write(f"  would remind {d.host} (grace until {d.private_grace_ends:%Y-%m-%d})")
                    continue
                if email:
                    send_mail(
                        f"Your private domain {d.host} needs renewing",
                        f"The rental on {d.host} has lapsed.\n\n"
                        f"Your links are still working, and will keep working until "
                        f"{d.private_grace_ends:%d %B}. After that the domain is released and "
                        f"those links stop resolving.\n\n"
                        f"Renew here: {front}/dashboard/links",
                        settings.DEFAULT_FROM_EMAIL, [email], fail_silently=True)
                continue

            # Grace is over: release it back to stock.
            reclaimed += 1
            if dry:
                self.stdout.write(self.style.WARNING(
                    f"  would reclaim {d.host} ({d.links.count()} link(s) would stop)"))
                continue

            links = list(d.links.all())
            d.organization = None
            d.private_until = None
            d.is_shared = False          # back to sellable stock, not the public pool
            d.save(update_fields=["organization", "private_until", "is_shared"])
            for link in links:
                publish_link(link)       # withdraws them — the domain is no longer theirs
            if email:
                send_mail(
                    f"{d.host} has been released",
                    f"The rental on {d.host} wasn't renewed, so the domain has been released "
                    f"and its links no longer resolve.\n\n"
                    f"Your links and their click history are still in your account, and you can "
                    f"point new ones at a shared domain any time.\n\n{front}/dashboard/links",
                    settings.DEFAULT_FROM_EMAIL, [email], fail_silently=True)
            self.stdout.write(self.style.WARNING(f"  reclaimed {d.host} — grace period ended"))

        self.stdout.write(self.style.SUCCESS(
            f"Done. {reminded} reminded, {reclaimed} reclaimed."))
