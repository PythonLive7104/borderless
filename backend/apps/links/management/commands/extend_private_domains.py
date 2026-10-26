"""Give existing private domains the full term after the term got longer.

The rental ran for 30 days until October 2026, when it became a year. Nobody
holding a domain bought under the old term should be asked for a year's money
three weeks after paying for a month — so this tops them up to a full term from
today, at no charge.

Reports by default; --apply does it. Safe to run twice: a domain already holding
a full term or more is left exactly as it is, so this can never shorten anyone's
rental, and re-running after a later term change tops up only what is short.
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.links.models import ShortDomain
from apps.links.purchases import period_days


class Command(BaseCommand):
    help = "Top up existing private domains to the current rental term."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true",
                            help="Actually extend them. Without it, reports only.")
        parser.add_argument("--quiet", action="store_true",
                            help="Skip the dashboard notice to each workspace.")

    def handle(self, *args, **opts):
        days = period_days()
        now = timezone.now()
        target = now + timedelta(days=days)

        # Rented private domains only. A bring-your-own domain is the customer's
        # own registration and has no rental to extend.
        qs = (ShortDomain.objects
              .filter(is_shared=False, byod=False, organization__isnull=False)
              .select_related("organization")
              .order_by("host"))

        extended = skipped = 0
        for d in qs:
            if d.private_until and d.private_until >= target:
                skipped += 1
                continue

            was = d.private_until.date().isoformat() if d.private_until else "none"
            left = (d.private_until - now).days if d.private_until else None
            label = f"{left}d left" if left is not None else "no expiry set"

            self.stdout.write(
                f"  {d.host:<28} {d.organization.slug:<20} {was} ({label})"
                f"  ->  {target.date().isoformat()}")
            extended += 1
            if not opts["apply"]:
                continue

            d.private_until = target
            d.save(update_fields=["private_until"])
            if not opts["quiet"]:
                self._tell_them(d, days)

        if skipped:
            self.stdout.write(f"  {skipped} domain(s) already hold a full term — untouched.")
        if not extended:
            self.stdout.write(self.style.SUCCESS("Nothing to extend."))
            return

        verb = "Extended" if opts["apply"] else "Would extend"
        self.stdout.write(self.style.SUCCESS(
            f"{verb} {extended} private domain(s) to {target.date().isoformat()} "
            f"({days} days from today)."))
        if not opts["apply"]:
            self.stdout.write("Re-run with --apply to do it.")

    def _tell_them(self, domain, days):
        """A free extension nobody is told about may as well not have happened.

        Never raises: failing to deliver the good news must not roll back the
        good news itself.
        """
        try:
            from apps.notifications.system import notify_workspace
            term = "a year" if days >= 360 else f"{days} days"
            notify_workspace(
                domain.organization,
                f"{domain.host} now runs for {term}",
                f"Private domains used to be rented monthly and now run for {term}. "
                f"We have extended {domain.host} to "
                f"{domain.private_until.date().isoformat()} at no charge, so you are "
                f"not out of pocket for the change. Nothing to do — your links keep "
                f"working exactly as they are.",
            )
        except Exception:  # pragma: no cover - defensive
            pass
