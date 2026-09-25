"""Seed the per-plan daily notification allowance.

Generous against the free 50-credit pool so the meter reads as a real upgrade
reason, and scaled by tier. Explicit numbers rather than derived, so changing
one tier later doesn't silently move the others.
"""
from django.db import migrations

# slug -> notifications allowed PER DAY
DAILY = {"basic": 1_000, "plus": 5_000, "pro": 25_000}


def seed(apps, schema_editor):
    Plan = apps.get_model("billing", "Plan")
    for slug, limit in DAILY.items():
        Plan.objects.filter(slug=slug).update(notify_daily_limit=limit)


def unseed(apps, schema_editor):
    apps.get_model("billing", "Plan").objects.update(notify_daily_limit=0)


class Migration(migrations.Migration):
    dependencies = [("billing", "0015_plan_notify_daily_limit")]
    operations = [migrations.RunPython(seed, unseed)]
