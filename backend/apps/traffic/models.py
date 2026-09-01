from django.db import models
from apps.websites.models import Website


class Visitor(models.Model):
    website = models.ForeignKey(Website, on_delete=models.CASCADE, related_name="visitors")
    visitor_id = models.CharField(max_length=64, db_index=True)  # from browser cookie/storage
    first_seen = models.DateTimeField(auto_now_add=True)
    last_seen = models.DateTimeField(auto_now=True)
    # latest observed signals (denormalized for quick display)
    ip = models.GenericIPAddressField(null=True, blank=True)
    country = models.CharField(max_length=2, blank=True)
    device = models.CharField(max_length=16, blank=True)
    browser = models.CharField(max_length=40, blank=True)
    os = models.CharField(max_length=40, blank=True)
    fingerprint = models.CharField(max_length=16, blank=True)

    class Meta:
        unique_together = ("website", "visitor_id")
        indexes = [models.Index(fields=["website", "last_seen"])]


class Session(models.Model):
    website = models.ForeignKey(Website, on_delete=models.CASCADE, related_name="sessions")
    visitor = models.ForeignKey(Visitor, on_delete=models.CASCADE, related_name="sessions")
    session_id = models.CharField(max_length=64, db_index=True)
    started_at = models.DateTimeField(auto_now_add=True)
    last_seen = models.DateTimeField(auto_now=True)
    landing_url = models.TextField(blank=True)
    referrer = models.TextField(blank=True)
    utm_source = models.CharField(max_length=120, blank=True)
    utm_medium = models.CharField(max_length=120, blank=True)
    utm_campaign = models.CharField(max_length=120, blank=True)

    class Meta:
        unique_together = ("website", "session_id")


class TrafficEvent(models.Model):
    class Type(models.TextChoices):
        PAGEVIEW = "pageview", "Pageview"
        EVENT = "event", "Custom event"
        CONVERSION = "conversion", "Conversion"

    website = models.ForeignKey(Website, on_delete=models.CASCADE, related_name="events")
    visitor = models.ForeignKey(Visitor, on_delete=models.CASCADE, related_name="events")
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name="events")
    type = models.CharField(max_length=12, choices=Type.choices, default=Type.PAGEVIEW)
    url = models.TextField(blank=True)
    referrer = models.TextField(blank=True)
    event_name = models.CharField(max_length=80, blank=True)

    # server-side signals
    ip = models.GenericIPAddressField(null=True, blank=True)
    country = models.CharField(max_length=2, blank=True)
    device = models.CharField(max_length=16, blank=True)
    browser = models.CharField(max_length=40, blank=True)
    os = models.CharField(max_length=40, blank=True)
    user_agent = models.TextField(blank=True)
    is_headless = models.BooleanField(default=False)

    # risk fields (Phase 6)
    risk_score = models.IntegerField(null=True, blank=True)
    classification = models.CharField(max_length=16, blank=True)  # human/suspicious/bot/fraud
    confidence = models.FloatField(null=True, blank=True)
    signals = models.JSONField(default=list, blank=True)  # contributing risk signals
    action = models.CharField(max_length=8, default="allow")  # allow/review/block/tag
    tag = models.CharField(max_length=60, blank=True)
    fingerprint = models.CharField(max_length=16, blank=True)
    fp_signals = models.JSONField(default=list, blank=True)  # client-side fingerprint flags
    ja3 = models.CharField(max_length=64, blank=True)  # TLS/JA3 fingerprint hash

    created_at = models.DateTimeField(db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["website", "created_at"])]


class Conversion(models.Model):
    website = models.ForeignKey(Website, on_delete=models.CASCADE, related_name="conversions")
    visitor = models.ForeignKey(Visitor, on_delete=models.CASCADE, related_name="conversions")
    session = models.ForeignKey(Session, on_delete=models.SET_NULL, null=True, blank=True, related_name="conversions")
    event_name = models.CharField(max_length=80, default="conversion")
    revenue = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    currency = models.CharField(max_length=8, default="USD")
    utm_source = models.CharField(max_length=120, blank=True)
    utm_campaign = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["website", "created_at"])]
