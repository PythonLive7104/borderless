"""Rename the plan rows to the weekly Basic/Plus/Pro tiers the code already expects.

The app was moved to weekly pricing but the rows were never migrated, so the
database still held the old monthly Starter/Growth/Business tiers at 29/99/299
while billing/views.py looked up slug="basic" and keyed settings.BACHS_PRODUCTS
by "basic"/"plus"/"pro". Checkout therefore advertised one price and the row said
another. Prices and names come from the published pricing page (Pricing.tsx).

Ids are untouched, so every existing subscription keeps pointing at its plan and
simply reads the corrected name and price.
"""
from django.db import migrations

# old slug -> (new slug, new name, weekly price USD)
REBRAND = [
    ("starter",  "basic", "Basic", 25),
    ("growth",   "plus",  "Plus",  40),
    ("business", "pro",   "Pro",   70),
]


def rebrand(apps, schema_editor):
    Plan = apps.get_model("billing", "Plan")
    for old, new, name, price in REBRAND:
        # Skip if the new slug already exists (a fresh DB seeded post-rename).
        if Plan.objects.filter(slug=new).exists():
            continue
        Plan.objects.filter(slug=old).update(slug=new, name=name, price=price)


def unrebrand(apps, schema_editor):
    Plan = apps.get_model("billing", "Plan")
    for old, new, _name, _price in REBRAND:
        Plan.objects.filter(slug=new).update(slug=old)


class Migration(migrations.Migration):
    dependencies = [("billing", "0008_seed_plan_limits")]
    operations = [migrations.RunPython(rebrand, unrebrand)]
