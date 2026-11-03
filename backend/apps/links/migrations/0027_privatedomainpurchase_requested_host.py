# Hand-written: Docker on the authoring machine had a wedged container that
# blocked `makemigrations`. Verify with `manage.py makemigrations --check
# --dry-run` before deploying — it must report no changes.
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("links", "0026_shortlink_reviewer_clicks"),
    ]

    operations = [
        migrations.AddField(
            model_name="privatedomainpurchase",
            name="requested_host",
            field=models.CharField(
                blank=True,
                default="",
                help_text="A domain the customer asked us to register, if not from stock.",
                max_length=253,
            ),
        ),
    ]
