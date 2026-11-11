from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0004_user_attribution"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="signup_ip_hash",
            field=models.CharField(
                blank=True, editable=False, max_length=64, null=True, unique=True),
        ),
    ]
