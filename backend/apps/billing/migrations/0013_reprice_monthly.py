"""Reprice the monthly tiers to sit inside the click-fraud market.

$50/month undercut ClickCease ($99) by half and Fraud Blocker ($79) by 37%,
while shipping far more volume and domains than either. In a category where
every buyer arrives through paid search and has never heard of us, the bottom
of the price range reads as risk rather than value — and at $8-25 a click it
cannot repay acquisition: month one of a $50 plan doesn't cover a single click
on some of these keywords.

$69 sits just under Fraud Blocker, which reads as competitive rather than
suspicious, and nearly doubles what an ad click can pay for. Done now, while
there are no paying customers: the same change after launch is a migration
with an apology attached.

Weekly prices are deliberately untouched, and every monthly cap already exceeds
its weekly counterpart, so no tier becomes worse than the shorter one.

Bachs product ids are NOT set here — each price is its own product in the Bachs
dashboard and the ids arrive via BACHS_PRODUCT_*_MONTHLY. The old ids point at
products priced at $50/$100/$150, so they must be repriced (or replaced) there
before this goes live, or checkout charges the old amount.
"""
from django.db import migrations

# slug -> (old monthly price, new monthly price) in USD
REPRICE = {
    "basic": (50, 69),
    "plus": (100, 119),
    "pro": (150, 199),
}


def seed(apps, schema_editor):
    Plan = apps.get_model("billing", "Plan")
    for slug, (_old, new) in REPRICE.items():
        Plan.objects.filter(slug=slug).update(price_monthly=new)


def unseed(apps, schema_editor):
    Plan = apps.get_model("billing", "Plan")
    for slug, (old, _new) in REPRICE.items():
        Plan.objects.filter(slug=slug).update(price_monthly=old)


class Migration(migrations.Migration):
    dependencies = [("billing", "0012_seed_monthly_caps")]
    operations = [migrations.RunPython(seed, unseed)]
