"""Inbound notification channels — an ntfy.sh-style drop for paid workspaces.

A user creates a channel, gets a publish URL with a secret key in it, and pastes
that URL into any form, survey or third-party webhook. Anything that POSTs or
PUTs to the URL lands as a notification in their dashboard feed. No polling, no
outbound config — the key IS the address.

The key is stored only as a hash, shown in full exactly once at creation, and
matched by hash on every publish — same discipline as the REST API keys.
"""
import hashlib
import secrets

from django.db import models

from apps.organizations.models import Organization


def sha256(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


class NotifyChannel(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE,
                                     related_name="notify_channels")
    name = models.CharField(max_length=120)
    prefix = models.CharField(max_length=16)                  # shown in UI, e.g. ntk_1a2b3c4d
    key_hash = models.CharField(max_length=64, db_index=True, unique=True)
    # A paused channel silently drops publishes rather than deleting history, so
    # a leaked key can be shut off without losing what already arrived.
    active = models.BooleanField(default=True)
    last_used = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.prefix})"

    @staticmethod
    def generate():
        """Return (raw_key, prefix, key_hash). The raw key is shown once."""
        raw = "ntk_" + secrets.token_urlsafe(24)
        return raw, raw[:12], sha256(raw)


class Notification(models.Model):
    channel = models.ForeignKey(NotifyChannel, on_delete=models.CASCADE,
                                related_name="notifications")
    title = models.CharField(max_length=200, blank=True)
    message = models.TextField()
    source_ip = models.GenericIPAddressField(null=True, blank=True)
    read = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["channel", "created_at"])]


class NotifyQuota(models.Model):
    """Per-workspace notification usage counters.

    Two meters share one row so a single read tells the whole story:
      - credits_used: lifetime, for free/trial workspaces (a 50-credit pool)
      - day / day_used: today's count, for paid workspaces on a daily limit
    Which one applies is decided by the plan at consume time (billing.notify_quota),
    but both are always tracked so an upgrade or downgrade needs no migration of
    counters — the relevant meter is simply the one that gets read.
    """
    organization = models.OneToOneField(Organization, on_delete=models.CASCADE,
                                         related_name="notify_quota")
    credits_used = models.BigIntegerField(default=0)
    day = models.DateField(null=True, blank=True)
    day_used = models.BigIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)
