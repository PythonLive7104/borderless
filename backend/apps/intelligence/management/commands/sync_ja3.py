from django.core.management.base import BaseCommand
from apps.intelligence.models import sync_to_redis


class Command(BaseCommand):
    help = "Rebuild the Redis ja3:blocklist set from the database."

    def handle(self, *args, **opts):
        n = sync_to_redis()
        self.stdout.write(self.style.SUCCESS(f"Synced {n} JA3 hashes to Redis."))
