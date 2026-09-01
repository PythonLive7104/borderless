"""Celery application for scheduled maintenance tasks.

Broker + result backend are Redis (already in the stack). The traffic stream
consumer stays a dedicated worker (`consume_traffic`); Celery handles periodic
jobs — data-retention enforcement and JA3 blocklist resync — via Celery Beat.
"""
import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("borderless")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

app.conf.beat_schedule = {
    "enforce-retention-daily": {
        "task": "apps.traffic.tasks.enforce_retention",
        "schedule": crontab(hour=3, minute=0),  # 03:00 daily
    },
    "sync-ja3-hourly": {
        "task": "apps.intelligence.tasks.sync_ja3",
        "schedule": crontab(minute=0),  # top of every hour
    },
}
