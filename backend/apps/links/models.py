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
    slug = models.SlugField(max_length=64, unique=True, default=gen_slug)
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

# Slugs the short domain serves itself (abuse reporting, bot pages). A link can
# never claim one, or it would shadow the page a complainant is trying to reach.
RESERVED_SLUGS = {
    "report", "abuse", "decoy", "blocked", "not-found", "unauthorized",
    "favicon.ico", "robots.txt", "l", "api", "admin",
}


class AbuseReport(models.Model):
    """A public report that a short link is being used for phishing/malware/spam.

    Anyone can file one, with no account — that's the point. A report we can tie
    to a live link re-scans its destination immediately; only a confirmed threat
    disables the link, everything else waits for a human. Being reachable and
    fast here is what stops a complainant escalating to the registrar instead."""

    class Reason(models.TextChoices):
        PHISHING = "phishing", "Phishing / fake login page"
        MALWARE = "malware", "Malware or harmful download"
        SPAM = "spam", "Spam (unsolicited email or SMS)"
        SCAM = "scam", "Scam or fraud"
        OTHER = "other", "Something else"

    class Status(models.TextChoices):
        NEW = "new", "New"
        ACTIONED = "actioned", "Actioned — link disabled"
        DISMISSED = "dismissed", "Dismissed — no action needed"

    # Kept even if the link is deleted, so the audit trail survives a cleanup.
    link = models.ForeignKey(ShortLink, on_delete=models.SET_NULL, null=True, blank=True,
                             related_name="abuse_reports")
    slug = models.CharField(max_length=64, blank=True, db_index=True)
    reported_url = models.CharField(max_length=2000)
    reason = models.CharField(max_length=16, choices=Reason.choices, default=Reason.PHISHING)
    details = models.TextField(blank=True)
    # Optional — a reporter who leaves one gets told what we did about it.
    reporter_email = models.EmailField(blank=True)
    reporter_ip = models.GenericIPAddressField(null=True, blank=True)

    status = models.CharField(max_length=12, choices=Status.choices, default=Status.NEW, db_index=True)
    auto_disabled = models.BooleanField(
        default=False,
        help_text="The threat scan triggered by this report disabled the link.")
    scan_result = models.JSONField(default=dict, blank=True,
                                   help_text="Threat scan run at the moment the report arrived.")

    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "-created_at"])]

    def __str__(self):
        return f"{self.reason} report on /{self.slug or '?'} ({self.status})"
