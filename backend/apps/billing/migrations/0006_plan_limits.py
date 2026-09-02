from django.db import migrations, models

# Per-plan website/campaign caps (0 = unlimited).
LIMITS = {
    "starter":  {"max_websites": 5,  "max_campaigns": 20},
    "growth":   {"max_websites": 20, "max_campaigns": 50},
    "business": {"max_websites": 0,  "max_campaigns": 0},
}


def set_limits(apps, schema_editor):
    Plan = apps.get_model("billing", "Plan")
    for slug, vals in LIMITS.items():
        Plan.objects.filter(slug=slug).update(**vals)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [("billing", "0005_backfill_trial_end")]

    operations = [
        migrations.AddField(model_name="plan", name="max_websites",
                            field=models.IntegerField(default=0, help_text="0 = unlimited")),
        migrations.AddField(model_name="plan", name="max_campaigns",
                            field=models.IntegerField(default=0, help_text="0 = unlimited")),
        migrations.RunPython(set_limits, noop),
    ]
