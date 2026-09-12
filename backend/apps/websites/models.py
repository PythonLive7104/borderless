import secrets
from django.db import models
from apps.organizations.models import Organization


def gen_tracking_id() -> str:
    return "st_" + secrets.token_hex(8)  # e.g. st_1a2b3c...


class Website(models.Model):
    class Status(models.TextChoices):
        NOT_INSTALLED = "not_installed", "Not installed"
        DETECTED = "detected", "Detected"
        ACTIVE = "active", "Active"
        ERROR = "error", "Error"

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="websites")
    name = models.CharField(max_length=120)
    domain = models.CharField(max_length=180, help_text="e.g. example.com")
    url = models.URLField(blank=True)
    tracking_id = models.CharField(max_length=32, unique=True, default=gen_tracking_id,
                                   db_index=True, editable=False)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.NOT_INSTALLED)
    last_event_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    # Emits data-strict="1" in the snippet: the tracker hides the page until the
    # verdict lands, so a blocked visitor never sees the content. Always reveals
    # on a 1.2s timer, so a slow check can never white-screen a real visitor.
    strict_mode = models.BooleanField(
        default=False,
        help_text="Hide the page until the bot check finishes (stops blocked visitors seeing content).")

    # An internal holder for traffic that isn't tied to a real site — clicks on
    # a redirect that has no website attached. Without somewhere to put them the
    # consumer dropped those events, so redirect-only customers saw counters go
    # up and an empty Visitors page. Hidden from the Websites list and from plan
    # limits; it isn't a site they added.
    is_system = models.BooleanField(default=False, editable=False)

    # Google Safe Browsing monitoring. Chrome (and Firefox/Safari) paint their
    # red "deceptive site" page straight from this list, before the site loads —
    # so once a domain lands on it there's nothing to do in the page itself. The
    # value of watching it is knowing the moment it happens and getting it
    # cleared through Search Console, instead of finding out when traffic dies.
    safe_browsing_flagged = models.BooleanField(default=False)
    safe_browsing_threats = models.JSONField(default=list, blank=True)
    safe_browsing_checked_at = models.DateTimeField(null=True, blank=True)
    safe_browsing_notified_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.name} ({self.tracking_id})"

    # A site goes quiet when the snippet is removed, the tag breaks, or the site
    # itself stops getting visitors. Stored status can't express that — it only
    # ever moves forwards — so the badge is derived from when we last heard.
    IDLE_AFTER_DAYS = 7

    def live_state(self) -> str:
        """What the dashboard badge should say right now."""
        from django.utils import timezone
        from datetime import timedelta
        if self.status == self.Status.ERROR:
            return "error"
        if not self.last_event_at:
            return "waiting"          # added, but nothing has ever reached us
        if timezone.now() - self.last_event_at > timedelta(days=self.IDLE_AFTER_DAYS):
            return "idle"             # was working; nothing recently
        return "active"

    def mark_event(self):
        """Called by ingestion when an event arrives (Phase 5)."""
        from django.utils import timezone
        self.last_event_at = timezone.now()
        if self.status in (self.Status.NOT_INSTALLED, self.Status.DETECTED):
            self.status = self.Status.ACTIVE
        self.save(update_fields=["last_event_at", "status"])
