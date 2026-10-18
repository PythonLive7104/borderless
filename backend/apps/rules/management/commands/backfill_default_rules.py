"""Give existing websites the default bot rule that new ones now get.

Sites created before the default existed have no rule covering bot traffic, so
they allow a visitor the engine has already classified as a bot. This offers
them the same starting point.

Deliberately opt-in and dry-run by default: it changes what live customer sites
do with real traffic, which is not something to apply silently.

    python manage.py backfill_default_rules            # show what would change
    python manage.py backfill_default_rules --apply    # do it
"""
from django.core.management.base import BaseCommand

from apps.rules.defaults import create_default_rule
from apps.rules.models import TrafficRule
from apps.websites.models import Website


class Command(BaseCommand):
    help = "Add the default bot rule to websites that have no rules of their own."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true",
                            help="Actually create the rules (default is a dry run).")

    def handle(self, *args, **opts):
        # Only sites with NO rule at all. A customer who has written their own
        # has made their intentions clear, and adding to that silently would be
        # changing their configuration behind their back.
        candidates = [
            w for w in Website.objects.filter(is_system=False).select_related("organization")
            if not TrafficRule.objects.filter(website=w).exists()
        ]

        if not candidates:
            self.stdout.write(self.style.SUCCESS("Every website already has at least one rule."))
            return

        self.stdout.write(f"{len(candidates)} website(s) have no rules:\n")
        for w in candidates:
            self.stdout.write(f"  {w.domain} ({w.organization.name})")

        if not opts["apply"]:
            self.stdout.write("\nDry run. Re-run with --apply to add the default rule.")
            return

        from apps.rules.sync import publish_org
        made, orgs = 0, set()
        for w in candidates:
            if create_default_rule(w, force=opts["missing_bot_rule"]):
                made += 1
                orgs.add(w.organization_id)
        for org_id in orgs:
            publish_org(org_id)

        self.stdout.write(self.style.SUCCESS(
            f"\nCreated {made} rule(s) and published to {len(orgs)} workspace(s)."))
