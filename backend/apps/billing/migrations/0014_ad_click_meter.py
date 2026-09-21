"""Meter plans in ad clicks, the unit the whole category sells in.

Competitors price in "ad clicks protected" (Fraud Blocker: 5,000 at $79;
ClickCease: 5,000 visits at $99). We priced in "events", so a buyer with both
tabs open could not tell which plan was bigger — and when someone can't
compare, they pick the name they recognise.

The allowances are deliberately generous against that benchmark: they are a
reason to switch that survives being read quickly. Events remain on the plan as
the technical backstop, since a customer with no paid traffic has an ad-click
count of zero forever.
"""
from django.db import migrations, models

# slug -> ad clicks included per MONTH
AD_CLICKS = {"basic": 10_000, "plus": 50_000, "pro": 150_000}


def seed(apps, schema_editor):
    Plan = apps.get_model("billing", "Plan")
    for slug, clicks in AD_CLICKS.items():
        Plan.objects.filter(slug=slug).update(monthly_ad_clicks=clicks)


def unseed(apps, schema_editor):
    apps.get_model("billing", "Plan").objects.update(monthly_ad_clicks=0)


class Migration(migrations.Migration):
    dependencies = [("billing", "0013_reprice_monthly")]
    operations = [
        migrations.AddField(
            model_name="plan",
            name="monthly_ad_clicks",
            field=models.BigIntegerField(
                default=0, help_text="Paid ad clicks included per MONTH (0 = unlimited)"),
        ),
        migrations.RunPython(seed, unseed),
    ]
