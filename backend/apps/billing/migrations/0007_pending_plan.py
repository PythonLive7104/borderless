from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("billing", "0006_plan_limits")]

    operations = [
        migrations.AddField(
            model_name="subscription",
            name="pending_plan_slug",
            field=models.CharField(blank=True, default="", max_length=50),
        ),
    ]
