from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import JA3Block, sync_to_redis


@receiver(post_save, sender=JA3Block)
@receiver(post_delete, sender=JA3Block)
def _resync(sender, **kwargs):
    try:
        sync_to_redis()
    except Exception:
        pass  # Redis unavailable at write time; resync command covers recovery
