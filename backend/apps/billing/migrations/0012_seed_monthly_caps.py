"""Monthly buys a bigger allowance, not just a longer window.

Weekly caps stay as they are; monthly doubles them. Set explicitly rather than
derived, so changing one tier later doesn't silently move the others.
"""
from django.db import migrations

# slug -> (redirects, domains) on MONTHLY billing
MONTHLY_CAPS = {
    "basic": (5, 10),    # weekly: 2 / 5
    "plus": (10, 20),    # weekly: 5 / 10
    "pro": (20, 40),     # weekly: 10 / 20
}


def seed(apps, schema_editor):
    Plan = apps.get_model("billing", "Plan")
    for slug, (redirects, websites) in MONTHLY_CAPS.items():
        Plan.objects.filter(slug=slug).update(
            max_redirects_monthly=redirects, max_websites_monthly=websites)


def unseed(apps, schema_editor):
    apps.get_model("billing", "Plan").objects.update(
        max_redirects_monthly=0, max_websites_monthly=0)


class Migration(migrations.Migration):
    dependencies = [("billing", "0011_monthly_caps")]
    operations = [migrations.RunPython(seed, unseed)]
