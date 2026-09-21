"""Classify sessions we already have.

No new collection was needed for this: the tracker has always sent the full
landing URL (location.href), so the click identifiers are sitting in
landing_url on every session ever recorded. This reads them back.

Only reaches as far as each plan's retention window — older sessions are gone —
but it means the ad-click meter isn't blank on the day it ships.
"""
from django.db import migrations

BATCH = 2000


def backfill(apps, schema_editor):
    # Import the classifier directly: it is pure string handling with no model
    # imports, so it's safe from a migration and won't drift from the runtime
    # rule the consumer applies.
    from apps.traffic.paid_click import classify

    Session = apps.get_model("traffic", "Session")
    updates = []
    qs = Session.objects.filter(is_paid_click=False).only(
        "id", "landing_url", "utm_medium", "utm_source").iterator(chunk_size=BATCH)
    for s in qs:
        is_paid, platform = classify(s.landing_url, s.utm_medium, s.utm_source)
        if not is_paid:
            continue
        s.is_paid_click = True
        s.ad_platform = platform
        updates.append(s)
        if len(updates) >= BATCH:
            Session.objects.bulk_update(updates, ["is_paid_click", "ad_platform"])
            updates = []
    if updates:
        Session.objects.bulk_update(updates, ["is_paid_click", "ad_platform"])


def unbackfill(apps, schema_editor):
    apps.get_model("traffic", "Session").objects.update(is_paid_click=False, ad_platform="")


class Migration(migrations.Migration):
    dependencies = [("traffic", "0010_session_ad_platform_session_is_paid_click")]
    operations = [migrations.RunPython(backfill, unbackfill)]
