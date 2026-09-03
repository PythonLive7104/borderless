import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("websites", "0001_initial"),
        ("rules", "0003_trafficrule_redirect_url_alter_trafficrule_action"),
    ]

    operations = [
        migrations.AddField(
            model_name="trafficrule",
            name="website",
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.CASCADE,
                related_name="site_rules", to="websites.website",
                help_text="Which website this rule applies to. Empty = all websites in the workspace."),
        ),
    ]
