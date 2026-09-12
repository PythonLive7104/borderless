"""Check protected websites against Google Safe Browsing and alert on new flags.

Chrome, Firefox and Safari all paint their red "deceptive site" warning straight
from Google's Safe Browsing list, before the page loads — so a flag can't be
handled inside the page. What helps is catching it early: this command notices
the moment a customer's domain lands on the list and emails them how to request
a review, instead of them discovering it when traffic collapses.

Run from host cron (Celery was trimmed on this box), e.g. every 6 hours:
    0 */6 * * *  cd /opt/borderless && docker compose -f docker-compose.prod.yml \\
                 exec -T backend python manage.py check_safebrowsing

The per-site work lives in apps.websites.safebrowsing so the dashboard's
"Check now" button behaves identically. No-ops when GOOGLE_SAFE_BROWSING_KEY
isn't set.
"""
from django.core.management.base import BaseCommand

from apps.websites.models import Website
from apps.websites import safebrowsing


class Command(BaseCommand):
    help = "Check protected websites against Google Safe Browsing; alert on new flags."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=0,
                            help="Max sites to check this run (0 = all).")

    def handle(self, *args, **opts):
        if not safebrowsing.is_enabled():
            self.stdout.write("Safe Browsing key not set (GOOGLE_SAFE_BROWSING_KEY) — nothing to do.")
            return

        sites = (Website.objects.filter(is_system=False)
                 .select_related("organization", "organization__owner")
                 .order_by("safe_browsing_checked_at"))  # least-recently-checked first
        if opts["limit"]:
            sites = sites[:opts["limit"]]

        checked = flagged = cleared = 0
        for site in sites:
            was = site.safe_browsing_flagged
            r = safebrowsing.check_site(site)
            if not r["enabled"]:
                continue
            checked += 1
            if r["changed"] and r["flagged"]:
                flagged += 1
                self.stdout.write(self.style.WARNING(
                    f"  FLAGGED {site.domain}: {', '.join(r['threats'])}"))
            elif r["changed"] and not r["flagged"] and was:
                cleared += 1
                self.stdout.write(self.style.SUCCESS(f"  CLEARED {site.domain}"))

        self.stdout.write(
            f"Safe Browsing: checked {checked}, newly flagged {flagged}, cleared {cleared}.")
