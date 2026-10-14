"""Price and provision the yearly tier.

Price: ten months' money for twelve months' access, the convention buyers in
this category already recognise from ClickCease and Fraud Blocker, both of whom
quote their headline price "billed annually". That matters more than the exact
discount: our monthly price is already under their annual-equivalent rate, so
the annual option has to make the comparison obvious rather than win on
cleverness. 69/119/199 -> 690/1190/1990, a shade under 17% off.

Caps: yearly doubles monthly, exactly as monthly doubled weekly. A longer
commitment buys a bigger allowance and not merely more time, which is the rule
the other two intervals already follow — breaking it here would make the annual
plan worse value per month on everything except the price.

Ad clicks are NOT seeded: monthly_ad_clicks is scaled by INTERVAL_MONTHS at
read time, so yearly already resolves to twelve months' worth.
"""
from django.db import migrations

# slug -> (yearly price USD, redirects, domains)
YEARLY = {
    "basic": (690, 10, 20),    # monthly: $69,  5 / 10
    "plus": (1190, 20, 40),    # monthly: $119, 10 / 20
    "pro": (1990, 40, 80),     # monthly: $199, 20 / 40
}


def seed(apps, schema_editor):
    Plan = apps.get_model("billing", "Plan")
    for slug, (price, redirects, websites) in YEARLY.items():
        Plan.objects.filter(slug=slug).update(
            price_yearly=price,
            max_redirects_yearly=redirects,
            max_websites_yearly=websites,
        )


def unseed(apps, schema_editor):
    apps.get_model("billing", "Plan").objects.update(
        price_yearly=0, max_redirects_yearly=0, max_websites_yearly=0)


class Migration(migrations.Migration):
    dependencies = [("billing", "0017_yearly_interval")]
    operations = [migrations.RunPython(seed, unseed)]
