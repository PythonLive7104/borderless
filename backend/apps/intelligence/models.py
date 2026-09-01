"""Global TLS/JA3 threat-intel blocklist.

Known-bad JA3 client fingerprints (headless automation stacks, scraping tools,
botnets). Entries sync to the Redis set `ja3:blocklist`, which the Go decision
engine checks on every request to add the `known_bad_ja3` risk signal. Managed
by staff — it benefits every workspace automatically.
"""
from django.db import models

REDIS_SET = "ja3:blocklist"


class JA3Block(models.Model):
    ja3 = models.CharField(max_length=64, unique=True, help_text="JA3 fingerprint hash")
    label = models.CharField(max_length=120, blank=True, help_text="What client this belongs to")
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.ja3} ({self.label or 'unlabeled'})"


def sync_to_redis():
    """Rebuild the Redis blocklist set from active rows. Safe to call anytime."""
    from apps.intelligence.service import _r
    r = _r()
    hashes = list(JA3Block.objects.filter(active=True).values_list("ja3", flat=True))
    pipe = r.pipeline()
    pipe.delete(REDIS_SET)
    if hashes:
        pipe.sadd(REDIS_SET, *hashes)
    pipe.execute()
    return len(hashes)
