import hashlib
import secrets
from django.conf import settings
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


class GoogleAdsAccount(models.Model):
    """A workspace's connected Google Ads account, for pushing IP exclusions.

    Blocking a visitor at the website doesn't stop the advertiser being charged
    for the click — only writing the address into the ad account as a campaign
    exclusion does. This holds the OAuth grant that lets us do that on the
    customer's behalf.

    One account per workspace for now (OneToOne). Agencies managing several ad
    accounts are a later expansion; the exclusion allocator and push client are
    already written per-campaign, so widening this to many is additive.

    Security note: refresh_token is a long-lived, powerful credential. It is
    never exposed through any serializer or API response — only the fact of a
    connection and the customer id are. It is stored as-is (the DB is the trust
    boundary, as it is for webhook secrets and API-key hashes here); encrypting
    secrets at rest is a cross-cutting hardening task tracked separately, not a
    reason to hold this credential anywhere more exposed, like a log or a token
    cache the frontend can read.
    """

    class Status(models.TextChoices):
        CONNECTED = "connected", "Connected"
        REVOKED = "revoked", "Revoked"
        ERROR = "error", "Error"

    organization = models.OneToOneField(Organization, on_delete=models.CASCADE,
                                        related_name="google_ads")
    # The Ads account id (10 digits, dashes stripped). Blank until the customer
    # picks which account to protect after consenting.
    customer_id = models.CharField(max_length=20, blank=True)
    refresh_token = models.TextField(blank=True)
    access_token = models.TextField(blank=True)
    token_expires_at = models.DateTimeField(null=True, blank=True)
    scopes = models.CharField(max_length=300, blank=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.CONNECTED)
    last_error = models.CharField(max_length=300, blank=True)
    connected_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                     on_delete=models.SET_NULL)
    connected_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"GoogleAds({self.organization_id}, {self.customer_id or 'no-account'})"

    @property
    def is_connected(self) -> bool:
        return self.status == self.Status.CONNECTED and bool(self.refresh_token)
