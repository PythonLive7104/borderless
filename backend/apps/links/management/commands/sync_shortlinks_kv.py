"""Backfill the Cloudflare edge KV with every edge-safe short link.

Run once after configuring CF creds and deploying the Worker, and any time you
want to reconcile. Ongoing changes sync automatically via publish_link.
"""
from django.core.management.base import BaseCommand

from apps.links.edge import sync_link_kv
from apps.links.models import ShortLink


class Command(BaseCommand):
    help = "Push all edge-safe short links to Cloudflare KV (and remove the rest)."

    def handle(self, *args, **opts):
        n = 0
        for link in ShortLink.objects.select_related("domain", "website").filter(active=True):
            sync_link_kv(link)
            n += 1
        self.stdout.write(self.style.SUCCESS(f"Reconciled {n} active link(s) with edge KV."))
