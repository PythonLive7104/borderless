from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0005_user_signup_ip_hash"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="signup_ip_hash",
            field=models.CharField(
                blank=True, db_index=True, editable=False, max_length=64, null=True),
        ),
        migrations.CreateModel(
            name="SignupIPLock",
            fields=[
                ("id", models.BigAutoField(
                    auto_created=True, primary_key=True, serialize=False,
                    verbose_name="ID")),
                ("ip_hash", models.CharField(
                    editable=False, max_length=64, unique=True)),
            ],
        ),
    ]
