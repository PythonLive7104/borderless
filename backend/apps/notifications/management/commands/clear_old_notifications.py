"""Delete notifications older than the retention window (default 48h).

On-write cleanup only fires for channels that are still receiving. A channel
that goes quiet would keep its last messages forever, so this sweeps every
workspace. Idempotent — safe to run as often as you like; schedule hourly.

Cron (hourly):
  0 * * * * cd /opt/borderless && docker compose -f docker-compose.prod.yml \\
    exec -T backend python manage.py clear_old_notifications
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.notifications.ingest import MAX_AGE_HOURS
from apps.notifications.models import Notification


class Command(BaseCommand):
    help = "Purge notifications older than the retention window."

    def add_arguments(self, parser):
        parser.add_argument("--hours", type=int, default=MAX_AGE_HOURS,
                            help=f"Age at which a notification is deleted (default {MAX_AGE_HOURS}).")
        parser.add_argument("--dry-run", action="store_true",
                            help="Report the count without deleting.")

    def handle(self, *args, **opts):
        cutoff = timezone.now() - timedelta(hours=opts["hours"])
        qs = Notification.objects.filter(created_at__lt=cutoff)
        n = qs.count()
        if not opts["dry_run"]:
            qs.delete()
        verb = "would delete" if opts["dry_run"] else "deleted"
        self.stdout.write(self.style.SUCCESS(f"Done. {verb} {n} notification(s) older than {opts['hours']}h."))
