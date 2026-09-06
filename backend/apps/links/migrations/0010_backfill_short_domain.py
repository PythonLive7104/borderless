"""Move existing links onto a ShortDomain row.

Until now the domain lived in SHORTLINK_BASE and links only carried a slug. The
domain is now a row, and a link points at one — so seed the configured domain
and attach every existing link to it. Without this, links would have domain=None,
which publish_link() treats as "not serving" and every live link would go dark.
"""
from urllib.parse import urlparse

from django.conf import settings
from django.db import migrations
from django.utils import timezone


def forwards(apps, schema_editor):
    ShortDomain = apps.get_model("links", "ShortDomain")
    ShortLink = apps.get_model("links", "ShortLink")

    base = (getattr(settings, "SHORTLINK_BASE", "") or "").strip()
    host = urlparse(base if "//" in base else f"//{base}").hostname if base else ""
    if not host:
        # No short domain configured: leave links unattached. They are already
        # not being served (redirects_available() is false), so nothing breaks.
        return

    domain, _ = ShortDomain.objects.get_or_create(
        host=host.lower(),
        defaults={"active": True, "is_default": True, "verified_at": timezone.now(), "sort": 0},
    )
    ShortLink.objects.filter(domain__isnull=True).update(domain=domain)


def backwards(apps, schema_editor):
    apps.get_model("links", "ShortLink").objects.update(domain=None)


class Migration(migrations.Migration):
    dependencies = [("links", "0009_short_domains")]
    operations = [migrations.RunPython(forwards, backwards)]
