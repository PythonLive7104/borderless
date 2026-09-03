import apps.links.models
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("organizations", "0001_initial"),
        ("websites", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="ShortLink",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("slug", models.SlugField(default=apps.links.models.gen_slug, max_length=16, unique=True)),
                ("destination_url", models.URLField(max_length=2000)),
                ("title", models.CharField(blank=True, max_length=120)),
                ("active", models.BooleanField(default=True)),
                ("clicks", models.IntegerField(default=0)),
                ("human_clicks", models.IntegerField(default=0)),
                ("bot_clicks", models.IntegerField(default=0)),
                ("url_safe", models.BooleanField(blank=True, null=True)),
                ("url_threats", models.JSONField(blank=True, default=list)),
                ("url_scanned_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="short_links", to="organizations.organization")),
                ("website", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="short_links", to="websites.website")),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
