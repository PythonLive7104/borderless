"""Keep private-domain rentals honest, without breaking live campaigns.

A workspace stops being entitled to a private domain in two ways, and both
release it:

  * the rental term lapses (PRIVATE_DOMAIN_PERIOD_DAYS), or
  * the workspace's subscription lapses. A private domain runs alongside a live
    plan, never instead of one; once the plan is gone the engine stops serving
    that workspace's links entirely, so the domain is reserved against a
    customer who has left.

Either way the links keep working through a grace period and the owner is
warned first — a redirect may already be printed on an ad or sitting in
someone's inbox, so pulling it the moment a payment is late would break traffic
the customer is paying for elsewhere. Only after grace does it go back on sale.

The subscription half is deliberate and newer. Until it existed, a domain stayed
locked to a workspace that had stopped paying for anything, and nothing short of
hand-editing the row would free the name — made worse by the October 2026
top-up, which extended every term by a free year and so left those domains
looking paid up into 2027.

Schedule daily (see deploy/README.md).
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.links import rentals
from apps.links.models import ShortDomain


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

        # No private_until filter: a domain whose workspace stopped paying is
        # idle whether or not it carries a term, and the term is the weaker
        # signal anyway — see apps.links.rentals.
        rented = ShortDomain.objects.filter(organization__isnull=False, is_shared=False
                                            ).select_related("organization")
        for d in rented:
            owner = getattr(getattr(d, "organization", None), "owner", None)
            email = getattr(owner, "email", "")
            front = settings.FRONTEND_URL.rstrip("/")
            state = rentals.rental_state(d, now)

            if state in rentals.IDLE_STATES:
                reclaimed += 1
                why = ("subscription lapsed" if state == rentals.IDLE_PLAN
                       else "grace period ended")
                if dry:
                    self.stdout.write(self.style.WARNING(
                        f"  would reclaim {d.host} — {why} "
                        f"({d.links.count()} link(s) would stop)"))
                    continue
                # The release itself — clear the owner and term, back to
                # sellable stock, withdraw the links, tell the former owner —
                # lives in apps.links.rentals, because an admin can also release
                # a domain by hand from the Short domains page and the two must
                # do the same thing. See that module for why it is only correct
                # as a whole.
                rentals.release_to_stock(d, reason=state)
                self.stdout.write(self.style.WARNING(f"  reclaimed {d.host} — {why}"))
                continue

            if state == rentals.GRACE:
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

            # Still current by the term — but the subscription may have lapsed
            # within the grace period, in which case the domain is on its way to
            # being released and the owner has not been told. Warning them is
            # the whole reason there is a grace period at all; losing a domain
            # with no notice is how a lapsed customer becomes an angry one.
            lapsed_at = rentals.plan_lapsed_at(d.organization_id)
            if lapsed_at is None:
                continue
            ends = lapsed_at + timedelta(days=rentals.domain_grace_days())
            reminded += 1
            if dry:
                self.stdout.write(f"  would warn {d.host} (subscription lapsed, "
                                  f"released {ends:%Y-%m-%d})")
                continue
            if email:
                send_mail(
                    f"Your private domain {d.host} is about to be released",
                    f"Your subscription has lapsed, so {d.host} is no longer in use "
                    f"and your links on it are not running.\n\n"
                    f"We will hold the domain for you until {ends:%d %B}. After that "
                    f"it goes back on sale and anyone can take the name.\n\n"
                    f"Start a plan again here: {front}/dashboard/billing",
                    settings.DEFAULT_FROM_EMAIL, [email], fail_silently=True)

        self.stdout.write(self.style.SUCCESS(
            f"Done. {reminded} reminded, {reclaimed} reclaimed."))
