from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [("websites", "0005_alter_website_strict_mode")]

    operations = [
        migrations.AddField(
            model_name="website",
            name="snippet_seen_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
