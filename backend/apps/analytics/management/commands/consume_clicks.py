"""Reads the events:clicks Redis stream (written by the Go service) into Postgres.

Run as a long-lived worker:  python manage.py consume_clicks
"""
import time
from datetime import datetime, timezone

import redis
from django.conf import settings
from django.core.management.base import BaseCommand

from apps.analytics.models import Click

STREAM = "events:clicks"
GROUP = "analytics"
CONSUMER = "worker-1"


class Command(BaseCommand):
    help = "Consume click events from Redis Streams into the Click table."

    def handle(self, *args, **opts):
        r = redis.from_url(settings.REDIS_URL, decode_responses=True)
        try:
            r.xgroup_create(STREAM, GROUP, id="0", mkstream=True)
        except redis.ResponseError:
            pass  # group already exists

        self.stdout.write(self.style.SUCCESS(f"Consuming {STREAM}..."))
        while True:
            try:
                resp = r.xreadgroup(GROUP, CONSUMER, {STREAM: ">"}, count=100, block=5000)
            except redis.ConnectionError:
                time.sleep(1)
                continue
            if not resp:
                continue
            for _stream, entries in resp:
                rows = []
                ack_ids = []
                for entry_id, f in entries:
                    rows.append(Click(
                        public_id=f.get("public_id", ""),
                        ts=datetime.fromtimestamp(int(f.get("ts", "0")), tz=timezone.utc),
                        verdict=f.get("verdict", ""),
                        reason=f.get("reason", ""),
                        ip=f.get("ip") or None,
                        country=f.get("country", ""),
                        device=f.get("device", ""),
                        user_agent=f.get("ua", ""),
                        is_headless=f.get("is_headless", "0") == "1",
                    ))
                    ack_ids.append(entry_id)
                Click.objects.bulk_create(rows, ignore_conflicts=True)
                if ack_ids:
                    r.xack(STREAM, GROUP, *ack_ids)
