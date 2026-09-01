from celery import shared_task


@shared_task(name="apps.intelligence.tasks.sync_ja3")
def sync_ja3():
    """Rebuild the Redis ja3:blocklist set from the database."""
    from apps.intelligence.models import sync_to_redis
    return sync_to_redis()
