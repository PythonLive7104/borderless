"""Send the 48-hour Bot Check follow-up to leads that are due one.

Idempotent: each lead is stamped once (followup_sent_at), so running this on a
cron every hour only ever emails a given lead a single time. Skips leads that
already converted — no point nudging a customer.

Cron (hourly):
  0 * * * * cd /opt/borderless && docker compose -f docker-compose.prod.yml \\
    exec -T backend python manage.py send_botcheck_followups
"""
from datetime import timedelta

from django.core.mail import EmailMultiAlternatives
from django.core.management.base import BaseCommand
from django.conf import settings
from django.utils import timezone

from apps.intelligence.emails import followup_email
from apps.intelligence.models import BotCheckLead


class Command(BaseCommand):
    help = "Email the 48h follow-up to Bot Check leads that are due one."

    def add_arguments(self, parser):
        parser.add_argument("--hours", type=int, default=48,
                            help="Age a lead must reach before the follow-up (default 48).")
        parser.add_argument("--dry-run", action="store_true",
                            help="List who would be emailed; send nothing.")

    def handle(self, *args, **opts):
        cutoff = timezone.now() - timedelta(hours=opts["hours"])
        due = (BotCheckLead.objects
               .filter(followup_sent_at__isnull=True, converted=False, created_at__lte=cutoff)
               .order_by("created_at"))
        sent = 0
        for lead in due:
            if opts["dry_run"]:
                self.stdout.write(f"  would email {lead.email} ({lead.url}, grade {lead.grade or '?'})")
                continue
            subject, text, html = followup_email(lead)
            msg = EmailMultiAlternatives(subject, text, settings.DEFAULT_FROM_EMAIL, [lead.email])
            msg.attach_alternative(html, "text/html")
            try:
                msg.send(fail_silently=False)
            except Exception as e:
                # Leave followup_sent_at null so a transient failure retries next run.
                self.stderr.write(f"  failed {lead.email}: {e}")
                continue
            lead.followup_sent_at = timezone.now()
            lead.save(update_fields=["followup_sent_at"])
            sent += 1
        verb = "would send" if opts["dry_run"] else "sent"
        self.stdout.write(self.style.SUCCESS(f"Done. {verb} {due.count() if opts['dry_run'] else sent} follow-up(s)."))
