"""Compute and (optionally) push a campaign's IP exclusions to Google Ads.

Dry run by default: it prints exactly what it WOULD exclude and changes nothing.
--apply performs the real mutate, and only works when GOOGLE_ADS_LIVE_PUSH is on
AND the workspace has a connected account. This is the safe way to make the
first live push — against a Google *test* account — before any real campaign.

    python manage.py push_exclusions <org> <campaign_id>            # dry run
    python manage.py push_exclusions acme 1234567890 --apply        # live
    python manage.py push_exclusions acme 1234567890 --limit 50
"""
from django.core.management.base import BaseCommand, CommandError

from apps.integrations import googleads_push
from apps.integrations.models import GoogleAdsAccount
from apps.organizations.models import Organization
from apps.traffic import exclusions
from apps.websites.models import Website


class Command(BaseCommand):
    help = "Preview or push a campaign's IP exclusions to Google Ads."

    def add_arguments(self, parser):
        parser.add_argument("org", help="Workspace id or slug.")
        parser.add_argument("campaign_id", help="The Google Ads campaign id (from ValueTrack).")
        parser.add_argument("--apply", action="store_true",
                            help="Actually push (needs GOOGLE_ADS_LIVE_PUSH=1 and a connected account).")
        parser.add_argument("--limit", type=int, default=exclusions.CAMPAIGN_IP_LIMIT,
                            help="Max exclusions (default: the Google per-campaign cap).")

    def handle(self, *args, **opts):
        org = self._org(opts["org"])
        campaign_id = opts["campaign_id"].strip()
        website_ids = list(Website.objects.filter(organization=org).values_list("id", flat=True))

        plan = exclusions.plan_for_campaign(website_ids, campaign_id, limit=opts["limit"])
        self._print_plan(plan)

        if not opts["apply"]:
            self.stdout.write(self.style.WARNING(
                "\nDry run — nothing pushed. Add --apply to push for real."))
            return

        account = GoogleAdsAccount.objects.filter(organization=org).first()
        out = googleads_push.apply(account, campaign_id, plan, dry_run=False)
        if out.get("applied"):
            self.stdout.write(self.style.SUCCESS(
                f"\nPushed to account {out.get('customer_id')}: "
                f"+{out.get('added', 0)} / -{out.get('removed', 0)} exclusion(s)."))
        else:
            self.stdout.write(self.style.ERROR(
                "\nNot pushed: " + (out.get("error") or out.get("reason") or "unknown reason")))

    def _print_plan(self, plan):
        self.stdout.write(f"Campaign {plan.get('campaign_id')}: "
                          f"{len(plan.get('add', []))} to add, "
                          f"{len(plan.get('remove', []))} to remove, "
                          f"{len(plan.get('skipped', []))} over the cap.")
        for c in plan.get("candidates", [])[:20]:
            self.stdout.write(f"  {c['value']:<20} score {c['score']:<7} — {c.get('reason', '')}")

    def _org(self, ref):
        ref = ref.strip()
        org = (Organization.objects.filter(pk=int(ref)).first() if ref.isdigit() else None)
        org = org or Organization.objects.filter(slug=ref).first()
        if not org:
            raise CommandError(f"No workspace matches {ref!r}.")
        return org
