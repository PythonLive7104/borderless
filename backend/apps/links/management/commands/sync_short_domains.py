"""Reconcile the ShortDomain table with the domains nginx actually serves.

nginx reads SHORT_DOMAIN / SHORT_DOMAINS from the environment; the dashboard
reads the database. If they drift, users get offered a domain that nothing
answers on. This makes the environment the source of truth: hosts listed there
are created and verified, hosts no longer listed are deactivated (never deleted
— their links keep their history and start working again if it comes back).

    python manage.py sync_short_domains
"""
import os

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.links.models import ShortDomain
from apps.links.sync import publish_link


def _split(raw):
    return [h.strip().lower() for h in (raw or "").split(",") if h.strip()]


def shared_hosts():
    return _split(f"{os.getenv('SHORT_DOMAIN', '')},{os.getenv('SHORT_DOMAINS', '')}")


def private_hosts():
    """Served by nginx, but held as stock to sell — never in the shared pool."""
    return _split(os.getenv("SHORT_DOMAINS_PRIVATE", ""))


def configured_hosts():
    return shared_hosts() + private_hosts()


class Command(BaseCommand):
    help = "Create/activate short domains from the environment; retire the rest."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **opts):
        hosts = configured_hosts()
        shared, private = shared_hosts(), private_hosts()
        if not hosts:
            self.stdout.write(self.style.WARNING(
                "No SHORT_DOMAIN / SHORT_DOMAINS set — redirects are switched off."))

        for i, host in enumerate(hosts):
            d, created = ShortDomain.objects.get_or_create(host=host, defaults={"sort": i})
            changed = created or not d.active or not d.verified_at
            if opts["dry_run"]:
                self.stdout.write(f"  {'would add' if created else 'would enable'} {host}")
                continue
            d.active, d.verified_at, d.sort = True, d.verified_at or timezone.now(), i
            if d.organization_id is not None:
                pass                      # rented out; leave its ownership alone
            elif host in private:
                d.is_shared, d.is_default = False, False   # stock to sell
            elif host in shared:
                d.is_shared = True
            # Only a shared domain may be the default offered to everyone.
            if d.is_shared and not ShortDomain.objects.filter(
                    is_default=True, is_shared=True).exclude(pk=d.pk).exists():
                d.is_default = True
            d.save()
            if changed:
                self.stdout.write(self.style.SUCCESS(f"  {'added' if created else 'enabled'} {host}"))

        # Anything no longer configured stops serving.
        # Only the shared pool is env-driven. A private domain belongs to a
        # customer and must never be retired because it isn't in SHORT_DOMAINS.
        stale = ShortDomain.objects.filter(organization__isnull=True, is_shared=True,
                                           active=True).exclude(host__in=hosts)
        for d in stale:
            if opts["dry_run"]:
                self.stdout.write(f"  would retire {d.host} ({d.links.count()} link(s) stop resolving)")
                continue
            d.active = False
            d.save(update_fields=["active"])
            for link in d.links.all():
                publish_link(link)      # withdraws it from Redis
            self.stdout.write(self.style.WARNING(f"  retired {d.host} — its links no longer resolve"))

        if not opts["dry_run"]:
            self.stdout.write(self.style.SUCCESS(
                f"Done. {ShortDomain.objects.filter(active=True).count()} domain(s) serving."))
