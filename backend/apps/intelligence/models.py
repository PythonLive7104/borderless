"""Global TLS/JA3 threat-intel blocklist.

Known-bad JA3 client fingerprints (headless automation stacks, scraping tools,
botnets). Entries sync to the Redis set `ja3:blocklist`, which the Go decision
engine checks on every request to add the `known_bad_ja3` risk signal. Managed
by staff — it benefits every workspace automatically.
"""
from django.db import models

REDIS_SET = "ja3:blocklist"
JA4_REDIS_SET = "ja4:blocklist"


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


class JA4Block(models.Model):
    """The JA4 counterpart to JA3Block. JA4 is the newer TLS fingerprint —
    harder to spoof and more granular — so it deserves its own blocklist synced
    to `ja4:blocklist`, which the engine checks for the `known_bad_ja4` signal.
    """
    ja4 = models.CharField(max_length=64, unique=True, help_text="JA4 fingerprint hash")
    label = models.CharField(max_length=120, blank=True, help_text="What client this belongs to")
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.ja4} ({self.label or 'unlabeled'})"


def sync_ja4_to_redis():
    """Rebuild the Redis ja4:blocklist set from active rows."""
    from apps.intelligence.service import _r
    r = _r()
    hashes = list(JA4Block.objects.filter(active=True).values_list("ja4", flat=True))
    pipe = r.pipeline()
    pipe.delete(JA4_REDIS_SET)
    if hashes:
        pipe.sadd(JA4_REDIS_SET, *hashes)
    pipe.execute()
    return len(hashes)


class BotCheckLead(models.Model):
    """A prospect who ran the free Bot Check and asked for the full report.

    The Bot Check is the top of the funnel: anyone can scan a site with no
    signup, but a visitor who leaves their email to get the full report (and
    free monitoring) is a warm lead — they've just seen their own exposure and
    raised their hand. This is the list to follow up.
    """
    email = models.EmailField()
    url = models.CharField(max_length=2000, help_text="The site they scanned.")
    grade = models.CharField(max_length=2, blank=True)
    exposure = models.IntegerField(default=0, help_text="0-100 exposure score at scan time.")
    ip = models.GenericIPAddressField(null=True, blank=True)
    # Whether this lead has converted to a signup, filled in later by matching
    # the email against a registered user — so the operator can measure the
    # funnel without a heavy analytics stack.
    converted = models.BooleanField(default=False)
    # When the 48h follow-up email was sent. Null = not yet; set once so the
    # cron sender is idempotent and never emails the same lead twice.
    followup_sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["email", "created_at"])]

    def __str__(self):
        return f"{self.email} — {self.url} ({self.grade or '?'})"
