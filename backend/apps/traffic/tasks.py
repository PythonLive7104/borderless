from celery import shared_task
from django.core.management import call_command


@shared_task(name="apps.traffic.tasks.enforce_retention")
def enforce_retention():
    """Purge traffic data past each org's plan retention window."""
    call_command("enforce_retention")
    return "ok"
