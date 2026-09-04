"""Re-scan the destinations of live short links.

Links are scanned when they're created and edited, which catches the obvious
bait-and-switch. It does not catch the slower one: a destination that was clean
on the day it was submitted and turned malicious later, without the link ever
being touched — the attacker just changes the page, or the URL gets flagged by
Safe Browsing a few days after we looked. This command closes that window.

Schedule it hourly from host cron (see deploy/README.md). Nothing is re-enabled
automatically: a link we disabled stays disabled until a human clears it.

Quota note: the VirusTotal free tier allows ~4 lookups/minute and 500/day, so
--limit and --sleep exist to stay inside it. Default settings scan 60 links an
hour, which keeps roughly 1,400 links on a 24-hour cycle.
"""
import time

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from apps.links.models import ShortLink
from apps.links.sync import publish_link, scan_and_flag


class Command(BaseCommand):
    help = "Re-scan destinations of active short links and disable any that went bad."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=60,
                            help="Max links to scan this run (API quota guard). Default 60.")
        parser.add_argument("--age-hours", type=int, default=24,
                            help="Only re-scan links last scanned more than this many hours ago. Default 24.")
        parser.add_argument("--sleep", type=float, default=1.0,
                            help="Seconds to pause between scans. Raise to ~16 if VirusTotal rate-limits you.")
        parser.add_argument("--dry-run", action="store_true",
                            help="Report what would be scanned without calling the scanners.")

    def handle(self, *args, **opts):
        from apps.intelligence.threatscan import is_enabled
        if not is_enabled():
            self.stdout.write(self.style.WARNING(
                "No GOOGLE_SAFE_BROWSING_KEY or VIRUSTOTAL_KEY set — nothing to scan."))
            return

        cutoff = timezone.now() - timedelta(hours=opts["age_hours"])
        # Only links that are live and could still hurt us. Never-scanned links
        # (url_scanned_at NULL) sort first, then the stalest.
        qs = (ShortLink.objects
              .filter(active=True)
              .filter(Q(url_scanned_at__isnull=True) | Q(url_scanned_at__lt=cutoff))
              .order_by("url_scanned_at")[:opts["limit"]])

        links = list(qs)
        if opts["dry_run"]:
            for link in links:
                last = link.url_scanned_at or "never"
                self.stdout.write(f"would scan /{link.slug} -> {link.destination_url} (last: {last})")
            self.stdout.write(self.style.SUCCESS(f"Done. {len(links)} link(s) would be scanned."))
            return

        scanned = disabled = 0
        for link in links:
            try:
                scan_and_flag(link)
            except Exception as exc:      # a scanner outage must not kill the run
                self.stderr.write(f"/{link.slug}: scan failed ({exc})")
                continue
            scanned += 1
            link.refresh_from_db()
            # scan_and_flag only writes the DB; Redis still holds the old payload,
            # so the engine would keep redirecting a link we just killed.
            publish_link(link)
            if not link.active:
                disabled += 1
                self.stdout.write(self.style.WARNING(
                    f"disabled /{link.slug} -> {link.destination_url} ({', '.join(link.url_threats) or 'unsafe'})"))
            if opts["sleep"]:
                time.sleep(opts["sleep"])

        self.stdout.write(self.style.SUCCESS(
            f"Done. {scanned} scanned, {disabled} disabled."))
