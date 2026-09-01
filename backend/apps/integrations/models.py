import hashlib
import secrets
from django.db import models
from apps.organizations.models import Organization


def sha256(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def gen_secret() -> str:
    return secrets.token_urlsafe(24)


class APIKey(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="api_keys")
    name = models.CharField(max_length=120)
    prefix = models.CharField(max_length=16)          # shown in UI (e.g. blk_1a2b3c4d)
    key_hash = models.CharField(max_length=64, db_index=True)  # sha256 of full key
    last_used = models.DateTimeField(null=True, blank=True)
    revoked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    @staticmethod
    def generate():
        raw = "blk_" + secrets.token_urlsafe(24)
        return raw, raw[:12], sha256(raw)


class Webhook(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="webhooks")
    url = models.URLField()
    events = models.JSONField(default=list)   # e.g. ["conversion.created", "risk.high"]
    secret = models.CharField(max_length=48, default=gen_secret)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class WebhookDelivery(models.Model):
    webhook = models.ForeignKey(Webhook, on_delete=models.CASCADE, related_name="deliveries")
    event = models.CharField(max_length=40)
    success = models.BooleanField(default=False)
    status_code = models.IntegerField(null=True, blank=True)
    attempts = models.IntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


# Valid webhook event names
WEBHOOK_EVENTS = [
    "traffic.classified", "risk.high", "risk.critical", "conversion.created",
]
