from django.db import models
from apps.websites.models import Website


class Campaign(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        PAUSED = "paused", "Paused"

    class Source(models.TextChoices):
        FACEBOOK = "facebook", "Facebook"
        GOOGLE = "google", "Google"
        TIKTOK = "tiktok", "TikTok"
        BING = "bing", "Bing"
        NATIVE = "native", "Native"
        ORGANIC = "organic", "Organic"
        DIRECT = "direct", "Direct"
        OTHER = "other", "Other"

    website = models.ForeignKey(Website, on_delete=models.CASCADE, related_name="campaigns")
    name = models.CharField(max_length=120)
    destination_url = models.URLField(blank=True)
    traffic_source = models.CharField(max_length=16, choices=Source.choices, default=Source.OTHER)
    country = models.CharField(max_length=2, blank=True, help_text="ISO code, optional")
    utm_source = models.CharField(max_length=120, blank=True)
    utm_medium = models.CharField(max_length=120, blank=True)
    utm_campaign = models.CharField(max_length=120, blank=True, db_index=True)
    risk_threshold = models.IntegerField(default=70, help_text="Score at/above which traffic is flagged")
    status = models.CharField(max_length=8, choices=Status.choices, default=Status.ACTIVE)
    # Destination-URL safety (populated by threat scan; None = never scanned)
    url_safe = models.BooleanField(null=True, blank=True)
    url_threats = models.JSONField(default=list, blank=True)
    url_scanned_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.website.tracking_id})"

    @property
    def organization_id(self):
        return self.website.organization_id

    def matched_events(self):
        """Traffic events attributed to this campaign (same site + utm_campaign)."""
        from apps.traffic.models import TrafficEvent
        qs = TrafficEvent.objects.filter(website=self.website)
        if self.utm_campaign:
            qs = qs.filter(session__utm_campaign=self.utm_campaign)
        else:
            qs = qs.none()
        return qs


class CampaignVariant(models.Model):
    """A landing-page variant for A/B split testing within a campaign.

    Assignment is deterministic: a visitor is hashed into the cumulative weight
    range, so the same visitor always sees the same variant (sticky) and
    per-variant stats can be derived without storing every assignment.
    """
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name="variants")
    label = models.CharField(max_length=80)
    destination_url = models.URLField()
    weight = models.PositiveIntegerField(default=1, help_text="Relative traffic share")
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.label} ({self.weight})"
