from django.db import migrations


def clear_link_rules(apps, schema_editor):
    """Per-redirect rules lost their UI — the same limits now live on the
    redirect itself (device/OS/country/strictness pickers). Leaving the old
    rows in place would keep silently filtering traffic with nothing in the
    dashboard to show why, so they go with the UI."""
    apps.get_model("rules", "TrafficRule").objects.filter(
        short_link__isnull=False).delete()


class Migration(migrations.Migration):
    dependencies = [("rules", "0007_rule_short_link")]
    operations = [migrations.RunPython(clear_link_rules, migrations.RunPython.noop)]
