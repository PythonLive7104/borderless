import secrets
from django.db import models
from apps.organizations.models import Organization
from apps.websites.models import Website


def gen_slug() -> str:
    # short, url-safe, no ambiguous separators
    return secrets.token_urlsafe(8).replace("_", "").replace("-", "")[:8]


class ShortLink(models.Model):
    """A branded short link. Each click is scored by the bot engine and, when a
    website is attached, filtered by that site's Traffic Rules. Real humans go to
    the destination; bots follow the org's block/redirect rule (or are just logged)."""
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="short_links")
    website = models.ForeignKey(Website, on_delete=models.SET_NULL, null=True, blank=True,
                                related_name="short_links",
                                help_text="Optional — which site's Traffic Rules apply to clicks.")
    slug = models.SlugField(max_length=16, unique=True, default=gen_slug)
    destination_url = models.URLField(max_length=2000)
    title = models.CharField(max_length=120, blank=True)
    active = models.BooleanField(default=True)

    class BotAction(models.TextChoices):
        DESTINATION = "off", "Send them to the destination too"
        DECOY = "decoy", "A decoy page"
        NOTFOUND = "notfound", "A 404 page"
        BLANK = "blank", "A blank page"

    # What automated traffic gets. Real visitors always go to the destination.
    bot_action = models.CharField(max_length=10, choices=BotAction.choices, default=BotAction.DECOY)

    clicks = models.IntegerField(default=0)
    human_clicks = models.IntegerField(default=0)
    bot_clicks = models.IntegerField(default=0)

    # Threat scan of the destination (Safe Browsing / VirusTotal). A link that
    # resolves to malware/phishing is auto-disabled so it can't be abused.
    url_safe = models.BooleanField(null=True, blank=True)
    url_threats = models.JSONField(default=list, blank=True)
    url_scanned_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"/{self.slug} -> {self.destination_url}"
