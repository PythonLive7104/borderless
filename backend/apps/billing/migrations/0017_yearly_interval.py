"""Schema for a third billing interval: yearly.

Mirrors the weekly/monthly pair exactly — its own price, its own caps, its own
Bachs product id — rather than deriving anything from the monthly figures. The
caps cascade down (yearly -> monthly -> weekly) in Plan._cap_for, so a tier that
doesn't differentiate needs no extra values; the fields exist so that one can.

The Bachs product ids are NOT set here. Each price is a separate product in the
Bachs dashboard and the ids arrive via BACHS_PRODUCT_*_YEARLY. Until those exist
checkout refuses annual rather than charging the monthly amount — see
Plan.product_for, which deliberately does not fall back between intervals.
"""
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("billing", "0016_seed_notify_limits")]

    operations = [
        migrations.AddField(
            model_name="plan",
            name="price_yearly",
            field=models.IntegerField(default=0, help_text="USD per year (0 = yearly not offered)"),
        ),
        migrations.AddField(
            model_name="plan",
            name="max_websites_yearly",
            field=models.IntegerField(default=0, help_text="Domains cap on YEARLY billing (0 = same as monthly)"),
        ),
        migrations.AddField(
            model_name="plan",
            name="max_redirects_yearly",
            field=models.IntegerField(default=0, help_text="Redirect cap on YEARLY billing (0 = same as monthly)"),
        ),
        migrations.AddField(
            model_name="plan",
            name="bachs_product_id_yearly",
            field=models.CharField(blank=True, default="", max_length=80,
                                   help_text="Bachs product for the YEARLY price."),
        ),
        migrations.AlterField(
            model_name="subscription",
            name="interval",
            field=models.CharField(
                choices=[("weekly", "Weekly"), ("monthly", "Monthly"), ("yearly", "Yearly")],
                default="weekly", max_length=10),
        ),
    ]
