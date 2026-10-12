"""Drop the Click table.

Click was the original MVP's analytics row: one record per decision, carrying a
`verdict` of "money" or "white". That design is gone — scored traffic has been
recorded as apps.traffic.TrafficEvent since the traffic stream replaced the old
clicks stream, and nothing has written a Click row since. The table, its admin
page and the `consume_clicks` worker that fed it were all dead.
"""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("analytics", "0001_initial"),
    ]

    operations = [
        migrations.DeleteModel(name="Click"),
    ]
