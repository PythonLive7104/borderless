from datetime import timedelta
from django.db import migrations


def backfill(apps, schema_editor):
    Subscription = apps.get_model("billing", "Subscription")
    for sub in Subscription.objects.filter(trial_end__isnull=True):
        sub.trial_end = sub.created_at + timedelta(days=14)
        sub.save(update_fields=["trial_end"])


class Migration(migrations.Migration):
    dependencies = [("billing", "0004_subscription_trial_end")]
    operations = [migrations.RunPython(backfill, migrations.RunPython.noop)]
