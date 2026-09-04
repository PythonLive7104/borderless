"""Grant a workspace a paid plan without going through checkout.

For comping an account, testing, or fixing up a subscription by hand. Editing
the admin form directly is easy to get wrong — the usual mistake is leaving
period_end in the past, which reads as "expired" no matter how the plan and
status are set — so this drives the same start_period() path a real payment
does, and restores the engine keys the way _activate() does.

    python manage.py grant_plan --org 2 --plan pro
    python manage.py grant_plan --org my-workspace --plan pro --days 30
"""
from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.billing.entitlements import restore_org
from apps.billing.models import Plan, Subscription
from apps.organizations.models import Organization


class Command(BaseCommand):
    help = "Give a workspace an active paid plan (comp / manual activation)."

    def add_arguments(self, parser):
        parser.add_argument("--org", required=True,
                            help="Organization id or slug.")
        parser.add_argument("--plan", required=True,
                            help="Plan slug: basic | plus | pro.")
        parser.add_argument("--interval", choices=["weekly", "monthly"], default=None,
                            help="Billing interval to grant (default: keep what they're on).")
        parser.add_argument("--days", type=int, default=None,
                            help="Override the access window length (default: the plan's 7-day period).")

    def handle(self, *args, **opts):
        org = (Organization.objects.filter(pk=opts["org"]).first()
               if str(opts["org"]).isdigit() else
               Organization.objects.filter(slug=opts["org"]).first())
        if not org:
            raise CommandError(f"No organization matching {opts['org']!r}.")

        plan = Plan.objects.filter(slug=opts["plan"]).first()
        if not plan:
            available = ", ".join(Plan.objects.values_list("slug", flat=True))
            raise CommandError(f"No plan {opts['plan']!r}. Available: {available}")

        sub, _ = Subscription.objects.get_or_create(organization=org, defaults={"plan": plan})
        sub.start_period(plan, opts["interval"])   # ACTIVE + a real future period_end
        if opts["days"]:
            sub.period_end = timezone.now() + timedelta(days=opts["days"])
        sub.save(update_fields=["plan", "status", "interval", "period_start", "period_end",
                                "pending_plan_slug", "pending_interval"])

        # Republish rules/site/apikey/shortlink keys so the engine starts
        # protecting and redirecting again straight away.
        restore_org(org.id)

        state = sub.access_state()
        self.stdout.write(self.style.SUCCESS(
            f"[{org.slug}] {plan.name} ({sub.interval}) active until {sub.period_end:%Y-%m-%d %H:%M} UTC "
            f"— locked={state['locked']} ({state['reason']}), {state['days_left']} day(s) left."))
