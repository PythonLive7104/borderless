"""Delete traffic data older than each organization's plan retention window.

Retention is a plan feature (Starter 30d / Growth 90d / Business 365d). This
command is safe to run repeatedly; schedule it daily (cron or Celery beat).
Nothing here talks to an external service.
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.organizations.models import Organization
from apps.traffic.models import Conversion, Session, TrafficEvent, Visitor

BATCH = 5000


class Command(BaseCommand):
    help = "Purge traffic data older than each org's plan retention_days."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would be deleted without deleting.",
        )
        parser.add_argument(
            "--org",
            type=int,
            default=None,
            help="Limit to a single organization id.",
        )

    def handle(self, *args, **opts):
        dry = opts["dry_run"]
        qs = Organization.objects.select_related("subscription__plan")
        if opts["org"]:
            qs = qs.filter(id=opts["org"])

        total = 0
        for org in qs:
            sub = getattr(org, "subscription", None)
            days = getattr(getattr(sub, "plan", None), "retention_days", 0) or 0
            if days <= 0:
                continue  # unlimited retention
            cutoff = timezone.now() - timedelta(days=days)
            site_ids = list(org.websites.values_list("id", flat=True))
            if not site_ids:
                continue

            deleted = self._purge(site_ids, cutoff, dry)
            total += deleted
            if deleted or dry:
                verb = "would delete" if dry else "deleted"
                self.stdout.write(
                    f"[{org.slug}] retention={days}d cutoff={cutoff:%Y-%m-%d} "
                    f"{verb} {deleted} rows"
                )

        self.stdout.write(self.style.SUCCESS(f"Done. {total} rows removed."))

    def _purge(self, site_ids, cutoff, dry):
        deleted = 0
        specs = [
            (TrafficEvent, "created_at"),
            (Conversion, "created_at"),
            (Session, "last_seen"),
            (Visitor, "last_seen"),
        ]
        for model, field in specs:
            base = model.objects.filter(
                website_id__in=site_ids, **{f"{field}__lt": cutoff}
            )
            if dry:
                deleted += base.count()
                continue
            while True:
                ids = list(base.values_list("pk", flat=True)[:BATCH])
                if not ids:
                    break
                n, _ = model.objects.filter(pk__in=ids).delete()
                deleted += n
        return deleted
