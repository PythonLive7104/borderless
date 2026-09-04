"""Give existing paid subscriptions the period_end that 0006 added as NULL.

Subscription._deadline() reads period_end for anything that isn't trialing, so a
NULL there reads as "period_ended" and locks a paying workspace out of the app.
Every active subscription predates the column, so they all need filling.

The window is the one they actually bought — period_start + 7 days — not a fresh
week from today: nobody loses access they paid for, and nobody gains time they
didn't. A subscription whose real window has already closed correctly stays
locked until it renews.
"""
from datetime import timedelta

from django.db import migrations

PERIOD_DAYS = 7


def backfill(apps, schema_editor):
    Subscription = apps.get_model("billing", "Subscription")
    for sub in Subscription.objects.filter(period_end__isnull=True):
        start = sub.period_start or sub.created_at
        if not start:
            continue
        sub.period_end = start + timedelta(days=PERIOD_DAYS)
        sub.save(update_fields=["period_end"])


class Migration(migrations.Migration):
    dependencies = [("billing", "0006_plan_limits_and_weekly_periods")]
    operations = [migrations.RunPython(backfill, migrations.RunPython.noop)]
