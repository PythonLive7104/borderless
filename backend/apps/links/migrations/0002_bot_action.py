from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [("links", "0001_initial")]

    operations = [
        migrations.AddField(
            model_name="shortlink",
            name="bot_action",
            field=models.CharField(
                choices=[("off", "Send them to the destination too"), ("decoy", "A decoy page"),
                         ("notfound", "A 404 page"), ("blank", "A blank page")],
                default="decoy", max_length=10),
        ),
    ]
