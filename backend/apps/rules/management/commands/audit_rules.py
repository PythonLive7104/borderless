"""Find rules that look active but cannot act.

Validation now refuses these at save time, but rules created before that still
exist and are the worst kind of broken: the dashboard shows them enabled, the
engine returns their action, and nothing happens. Run after deploying the
validation change.

    python manage.py audit_rules            # report
    python manage.py audit_rules --disable  # report and switch them off
"""
from django.core.management.base import BaseCommand

from apps.rules.models import TrafficRule


class Command(BaseCommand):
    help = "Report (optionally disable) active rules that cannot carry out their action."

    def add_arguments(self, parser):
        parser.add_argument("--disable", action="store_true",
                            help="Deactivate the rules found, instead of only listing them.")

    def handle(self, *args, **opts):
        broken = []

        for rule in TrafficRule.objects.filter(active=True).prefetch_related("conditions"):
            why = None
            if rule.action == "redirect" and not (rule.redirect_url or "").strip():
                why = "redirect with no destination — the visitor is shown the page instead"
            elif rule.action == "tag" and not (rule.tag or "").strip():
                why = "tag with no label"
            elif not rule.conditions.exists():
                # Evaluate() refuses a rule with no conditions, so it can never fire.
                why = "no conditions — can never match"
            if why:
                broken.append((rule, why))

        if not broken:
            self.stdout.write(self.style.SUCCESS("No broken rules. Every active rule can act."))
            return

        self.stdout.write(self.style.WARNING(f"{len(broken)} rule(s) look active but cannot act:\n"))
        for rule, why in broken:
            scope = rule.website.domain if rule.website_id else (
                f"link #{rule.short_link_id}" if rule.short_link_id else "all websites")
            self.stdout.write(f"  #{rule.id} {rule.name!r} [{scope}] — {why}")

        if opts["disable"]:
            n = TrafficRule.objects.filter(id__in=[r.id for r, _ in broken]).update(active=False)
            self.stdout.write(self.style.SUCCESS(
                f"\nDeactivated {n}. Re-publish so the engine drops them:"))
            self.stdout.write("  python manage.py shell -c "
                              "\"from apps.rules.sync import publish_org; "
                              "from apps.organizations.models import Organization; "
                              "[publish_org(o.id) for o in Organization.objects.all()]\"")
        else:
            self.stdout.write("\nRe-run with --disable to switch them off.")
