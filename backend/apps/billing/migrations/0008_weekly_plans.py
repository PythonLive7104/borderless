from datetime import timedelta

from django.db import migrations, models
from django.utils import timezone


# Weekly Basic/Plus/Pro model. "Redirects" = short links, "Domains" = websites.
PLANS = [
    {"slug": "basic", "name": "Basic", "price": 25, "monthly_events": 100000,
     "retention_days": 30, "team_members": 3, "max_websites": 5, "max_campaigns": 5,
     "max_redirects": 2, "sort": 1},
    {"slug": "plus", "name": "Plus", "price": 40, "monthly_events": 300000,
     "retention_days": 90, "team_members": 10, "max_websites": 10, "max_campaigns": 10,
     "max_redirects": 5, "sort": 2},
    {"slug": "pro", "name": "Pro", "price": 70, "monthly_events": 1000000,
     "retention_days": 365, "team_members": 0, "max_websites": 20, "max_campaigns": 0,
     "max_redirects": 10, "sort": 3},
]

# Map subscriptions on the old monthly plans onto the closest new weekly tier.
OLD_TO_NEW = {"starter": "basic", "growth": "plus", "business": "pro"}


def seed(apps, schema_editor):
    Plan = apps.get_model("billing", "Plan")
    Subscription = apps.get_model("billing", "Subscription")

    for p in PLANS:
        Plan.objects.update_or_create(slug=p["slug"], defaults=p)

    for old, new in OLD_TO_NEW.items():
        oldp = Plan.objects.filter(slug=old).first()
        newp = Plan.objects.filter(slug=new).first()
        if oldp and newp:
            Subscription.objects.filter(plan=oldp).update(plan=newp)

    # Give existing ACTIVE subs a fresh weekly window so the new period-end rule
    # doesn't lock them out the moment this deploys.
    now = timezone.now()
    for sub in Subscription.objects.filter(status="active", period_end__isnull=True):
        sub.period_end = now + timedelta(days=7)
        sub.save(update_fields=["period_end"])

    # Remove the now-unused old plans (subscriptions were repointed above).
    Plan.objects.filter(slug__in=list(OLD_TO_NEW.keys())).delete()


def unseed(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [("billing", "0007_pending_plan")]

    operations = [
        migrations.AlterField(
            model_name="plan", name="price",
            field=models.IntegerField(help_text="USD per week"),
        ),
        migrations.AlterField(
            model_name="plan", name="max_websites",
            field=models.IntegerField(default=0, help_text="Domains cap (0 = unlimited)"),
        ),
        migrations.AddField(
            model_name="plan", name="max_redirects",
            field=models.IntegerField(default=0, help_text="Short-link (redirect) cap (0 = unlimited)"),
        ),
        migrations.AddField(
            model_name="subscription", name="period_end",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunPython(seed, unseed),
    ]
