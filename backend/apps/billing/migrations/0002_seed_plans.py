from django.db import migrations


PLANS = [
    {"slug": "starter", "name": "Starter", "price": 29, "monthly_events": 50000, "retention_days": 30, "team_members": 3, "sort": 1},
    {"slug": "growth", "name": "Growth", "price": 99, "monthly_events": 500000, "retention_days": 90, "team_members": 10, "sort": 2},
    {"slug": "business", "name": "Business", "price": 299, "monthly_events": 2000000, "retention_days": 365, "team_members": 0, "sort": 3},
]


def seed(apps, schema_editor):
    Plan = apps.get_model("billing", "Plan")
    Subscription = apps.get_model("billing", "Subscription")
    Organization = apps.get_model("organizations", "Organization")
    for p in PLANS:
        Plan.objects.update_or_create(slug=p["slug"], defaults=p)
    starter = Plan.objects.get(slug="starter")
    for org in Organization.objects.all():
        Subscription.objects.get_or_create(organization=org, defaults={"plan": starter})


def unseed(apps, schema_editor):
    apps.get_model("billing", "Plan").objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [("billing", "0001_initial")]
    operations = [migrations.RunPython(seed, unseed)]
