"""Fill in the per-tier caps that 0006 added, which default to 0 = unlimited.

redirect_limit() and website_limit() read these straight off the plan, and
billing/models.py is explicit that "no tier is unlimited in the weekly model" —
so leaving the defaults would silently hand every paid workspace unlimited short
links, which is exactly the abuse surface the tiering exists to contain.

Values come from the published pricing page (frontend Pricing.tsx); the slug
mapping is the one settings.BACHS_PRODUCTS documents, where the weekly tiers
reuse the existing products: starter->Basic, growth->Plus, business->Pro.

Deliberately NOT touched: slug, name and price. The live rows are still the old
monthly tiers (Starter/Growth/Business at 29/99/299) and renaming or repricing
them is a billing decision, not a schema fix.
"""
from django.db import migrations

# slug -> (max_redirects, max_websites)
LIMITS = {
    "starter":  (2, 5),    # Basic
    "growth":   (5, 10),   # Plus
    "business": (10, 20),  # Pro
}


def seed(apps, schema_editor):
    Plan = apps.get_model("billing", "Plan")
    for slug, (redirects, websites) in LIMITS.items():
        # Only fill rows still on the 0 default, so a hand-tuned cap survives.
        Plan.objects.filter(slug=slug, max_redirects=0).update(max_redirects=redirects)
        Plan.objects.filter(slug=slug, max_websites=0).update(max_websites=websites)


class Migration(migrations.Migration):
    dependencies = [("billing", "0007_backfill_period_end")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
