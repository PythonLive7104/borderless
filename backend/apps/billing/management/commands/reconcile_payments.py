"""Activate plans for customers who paid but were never switched on.

The webhook is the fast path; this is the one that catches everything it misses
— a failed delivery, a signature we couldn't verify, or a customer who closed
the tab before the browser came back. Any subscription still holding a pending
checkout session is checked against Bachs and activated if the money arrived.

Schedule it every 10 minutes (see deploy/README.md). Idempotent: a subscription
with no pending session is skipped, and activating clears the session.
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.billing.models import Subscription
from apps.billing.views import settle_pending_checkout


class Command(BaseCommand):
    help = "Activate any paid-but-not-activated subscriptions by asking Bachs."

    def add_arguments(self, parser):
        parser.add_argument("--hours", type=int, default=72,
                            help="Only look at checkouts started in the last N hours. Default 72.")
        parser.add_argument("--org", type=int, default=None)

    def handle(self, *args, **opts):
        from apps.billing import bachs
        if not bachs.is_enabled():
            self.stdout.write(self.style.WARNING("Bachs isn't configured — nothing to reconcile."))
            return

        qs = (Subscription.objects
              .exclude(bachs_session_id="")
              .exclude(pending_plan_slug="")
              .select_related("organization"))
        if opts["org"]:
            qs = qs.filter(organization_id=opts["org"])
        elif opts["hours"]:
            # A stale session is almost always an abandoned checkout; don't
            # re-poll it forever.
            qs = qs.filter(created_at__gte=timezone.now() - timedelta(days=365),
                           organization__isnull=False)

        checked = activated = 0
        for sub in qs:
            checked += 1
            try:
                if settle_pending_checkout(sub):
                    activated += 1
                    self.stdout.write(self.style.SUCCESS(
                        f"  activated {sub.organization.slug} -> {sub.plan.slug} ({sub.interval})"))
            except Exception as exc:
                self.stderr.write(f"  {sub.organization_id}: {exc}")

        self.stdout.write(self.style.SUCCESS(
            f"Done. {checked} pending checkout(s) checked, {activated} activated."))
