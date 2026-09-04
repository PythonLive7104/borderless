"""Set the monthly price on each tier.

Monthly is a genuine discount, not 4x the weekly rate — 4 weeks of Basic is $100
against $50 monthly — so the numbers are set explicitly rather than derived.

Bachs product ids are NOT set here: each monthly price is a separate product in
the Bachs dashboard and those ids arrive via BACHS_PRODUCT_*_MONTHLY in .env (or
per-row in the admin). Until one exists, Plan.product_for("monthly") returns ""
and checkout refuses the monthly option instead of silently charging weekly.
"""
from django.db import migrations

# slug -> monthly price (USD)
MONTHLY = {"basic": 50, "plus": 100, "pro": 150}


def seed(apps, schema_editor):
    Plan = apps.get_model("billing", "Plan")
    for slug, price in MONTHLY.items():
        Plan.objects.filter(slug=slug, price_monthly=0).update(price_monthly=price)


def unseed(apps, schema_editor):
    apps.get_model("billing", "Plan").objects.update(price_monthly=0)


class Migration(migrations.Migration):
    dependencies = [("billing", "0009_monthly_billing_interval")]
    operations = [migrations.RunPython(seed, unseed)]
