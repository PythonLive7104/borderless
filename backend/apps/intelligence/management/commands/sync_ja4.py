from django.core.management.base import BaseCommand
from apps.intelligence.models import sync_ja4_to_redis


class Command(BaseCommand):
    help = "Rebuild the Redis ja4:blocklist set from the database."

    def handle(self, *args, **opts):
        n = sync_ja4_to_redis()
        self.stdout.write(self.style.SUCCESS(f"Synced {n} JA4 hashes to Redis."))
