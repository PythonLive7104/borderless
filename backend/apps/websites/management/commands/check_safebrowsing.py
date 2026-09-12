"""Check protected websites against Google Safe Browsing and alert on new flags.

Chrome, Firefox and Safari all paint their red "deceptive site" warning straight
from Google's Safe Browsing list, before the page loads — so a flag can't be
handled inside the page. What helps is catching it early: this command notices
the moment a customer's domain lands on the list and emails them how to request
a review, instead of them discovering it when traffic collapses.

Run from host cron (Celery was trimmed on this box), e.g. every 6 hours:
    0 */6 * * *  cd /opt/borderless && docker compose -f docker-compose.prod.yml \\
                 exec -T backend python manage.py check_safebrowsing

No-ops cleanly when GOOGLE_SAFE_BROWSING_KEY isn't set.
"""
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.websites.models import Website


class Command(BaseCommand):
    help = "Check protected websites against Google Safe Browsing; alert on new flags."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=0,
                            help="Max sites to check this run (0 = all).")

    def handle(self, *args, **opts):
        from apps.intelligence import threatscan

        if not threatscan._sb_key():
            self.stdout.write("Safe Browsing key not set (GOOGLE_SAFE_BROWSING_KEY) — nothing to do.")
            return

        sites = (Website.objects.filter(is_system=False)
                 .select_related("organization", "organization__owner")
                 .order_by("safe_browsing_checked_at"))  # least-recently-checked first
        if opts["limit"]:
            sites = sites[:opts["limit"]]

        checked = flagged = cleared = 0
        for site in sites:
            url = site.url or f"https://{site.domain}"
            try:
                threats = threatscan._safe_browsing(url)
            except Exception as e:
                # A transient API error shouldn't flip a site's state either way.
                self.stderr.write(f"  {site.domain}: check failed ({e})")
                continue

            checked += 1
            now = timezone.now()
            was_flagged = site.safe_browsing_flagged
            is_flagged = bool(threats)
            fields = ["safe_browsing_checked_at", "safe_browsing_flagged", "safe_browsing_threats"]
            site.safe_browsing_checked_at = now
            site.safe_browsing_flagged = is_flagged
            site.safe_browsing_threats = threats

            if is_flagged and not was_flagged:
                flagged += 1
                site.safe_browsing_notified_at = now
                fields.append("safe_browsing_notified_at")
                self._notify_flagged(site, threats)
                self.stdout.write(self.style.WARNING(f"  FLAGGED {site.domain}: {', '.join(threats)}"))
            elif not is_flagged and was_flagged:
                cleared += 1
                site.safe_browsing_notified_at = None
                fields.append("safe_browsing_notified_at")
                self._notify_cleared(site)
                self.stdout.write(self.style.SUCCESS(f"  CLEARED {site.domain}"))

            site.save(update_fields=fields)

        self.stdout.write(
            f"Safe Browsing: checked {checked}, newly flagged {flagged}, cleared {cleared}.")

    # --- notifications -----------------------------------------------------

    def _owner_email(self, site) -> str:
        return getattr(getattr(site.organization, "owner", None), "email", "") or ""

    def _notify_flagged(self, site, threats):
        to = self._owner_email(site)
        if not to:
            return
        from django.conf import settings
        from django.core.mail import send_mail

        readable = ", ".join(t.replace("_", " ").title() for t in threats) or "a threat"
        send_mail(
            f"Action needed: Google flagged {site.domain}",
            (
                f"Google Safe Browsing has flagged {site.domain} ({readable}).\n\n"
                "Chrome, Firefox and Safari will all show a red warning before your\n"
                "page loads, so your ad traffic will drop until this is cleared.\n\n"
                "What to do now:\n"
                "1. Open Google Search Console for this domain "
                "(https://search.google.com/search-console).\n"
                "2. Go to Security & Manual Actions -> Security Issues to see what\n"
                "   Google found, fix it, then click Request Review.\n"
                "3. Reviews usually clear within 1-3 days once the cause is fixed.\n\n"
                "Common cause on protected sites: search crawlers being shown a\n"
                "different page than real visitors (cloaking). TryNoBot now lets\n"
                "verified crawlers through to your real page automatically, which\n"
                "helps prevent this — make sure you're on the latest deploy.\n\n"
                f"Workspace: {site.organization.name}\n"
            ),
            settings.DEFAULT_FROM_EMAIL, [to], fail_silently=True,
        )

    def _notify_cleared(self, site):
        to = self._owner_email(site)
        if not to:
            return
        from django.conf import settings
        from django.core.mail import send_mail

        send_mail(
            f"Resolved: {site.domain} is clear on Google Safe Browsing",
            (
                f"Good news — {site.domain} is no longer flagged by Google Safe\n"
                "Browsing. Browser warnings should stop within a few hours as the\n"
                "list propagates.\n"
            ),
            settings.DEFAULT_FROM_EMAIL, [to], fail_silently=True,
        )
