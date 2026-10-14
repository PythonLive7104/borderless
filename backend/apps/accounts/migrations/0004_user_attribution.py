from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("accounts", "0003_user_language_user_notification_prefs_user_timezone")]
    operations = [
        migrations.AddField(
            model_name="user",
            name="attribution",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
