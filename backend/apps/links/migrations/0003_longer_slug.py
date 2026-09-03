import apps.links.models
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [("links", "0002_bot_action")]

    operations = [
        migrations.AlterField(
            model_name="shortlink",
            name="slug",
            field=models.SlugField(default=apps.links.models.gen_slug, max_length=64, unique=True),
        ),
    ]
