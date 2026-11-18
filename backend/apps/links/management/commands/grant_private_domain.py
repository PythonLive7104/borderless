"""Give a private domain to a workspace directly, without a purchase.

For when money changed hands outside the normal checkout — a BTC payment, an
offline deal, a comp, a support fix — and you want to hand a customer a private
domain and have it be genuinely theirs. It does the same thing to the domain
row that a paid purchase does, so the result is indistinguishable from a bought
one.

Usage:
    python manage.py grant_private_domain <host> <org>           # org = id or slug
    python manage.py grant_private_domain trynb.cc acme --days 365
    python manage.py grant_private_domain trynb.cc 42 --default --no-notify
"""
from django.core.management.base import BaseCommand, CommandError

from apps.links import rentals
from apps.links.models import ShortDomain
from apps.organizations.models import Organization


class Command(BaseCommand):
    help = "Allocate a private domain to a workspace, making it theirs."

    def add_arguments(self, parser):
        parser.add_argument("host", help="The domain to allocate, e.g. trynb.cc")
        parser.add_argument("org", help="Workspace id or slug to give it to.")
        parser.add_argument("--days", type=int, default=None,
                            help="Term in days (default: the standard paid term).")
        parser.add_argument("--default", action="store_true",
                            help="Pre-select this domain when they create a redirect.")
        parser.add_argument("--no-notify", action="store_true",
                            help="Don't email / notify the workspace.")
        parser.add_argument("--force", action="store_true",
                            help="Allocate even if the domain is inactive, unverified "
                                 "or unhealthy (it won't serve until that's fixed).")

    def handle(self, *args, **opts):
        host = opts["host"].strip().lower()
        domain = ShortDomain.objects.filter(host=host).first()
        if not domain:
            raise CommandError(f"No short domain {host!r}. Add it first.")

        org = self._find_org(opts["org"])

        blocker = domain.sale_blocker
        if blocker and not opts["force"]:
            raise CommandError(
                f"{host} is {blocker} — it won't serve links until that's fixed. "
                f"Re-run with --force to allocate it anyway.")

        if domain.organization_id == org.id:
            self.stdout.write(self.style.WARNING(
                f"{host} already belongs to {org.slug}; refreshing its term."))

        rentals.grant_to_org(domain, org, days=opts["days"],
                             is_default=opts["default"], notify=not opts["no_notify"])
        domain.refresh_from_db()
        self.stdout.write(self.style.SUCCESS(
            f"Allocated {host} to {org.name} ({org.slug}) through "
            f"{domain.private_until:%Y-%m-%d}."
            + ("" if opts["no_notify"] else " The workspace has been notified.")))

    def _find_org(self, ref: str) -> Organization:
        ref = ref.strip()
        org = None
        if ref.isdigit():
            org = Organization.objects.filter(pk=int(ref)).first()
        if org is None:
            org = Organization.objects.filter(slug=ref).first()
        if org is None:
            raise CommandError(f"No workspace matches {ref!r} (tried id and slug).")
        return org
