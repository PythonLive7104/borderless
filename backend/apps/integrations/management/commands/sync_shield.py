"""Backfill the server-side shield's Redis mappings (apikey:* and site:*).

Run once after deploying the shield so existing API keys and websites work
immediately:  python manage.py sync_shield
"""
from django.core.management.base import BaseCommand
from apps.integrations.shield import sync_all


class Command(BaseCommand):
    help = "Publish all active API keys + site mappings to Redis for /v1/decide."

    def handle(self, *args, **opts):
        keys, sites = sync_all()
        self.stdout.write(self.style.SUCCESS(f"Shield synced: {keys} API keys, {sites} sites."))
