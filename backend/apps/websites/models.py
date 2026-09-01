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

    def __str__(self):
        return f"{self.name} ({self.tracking_id})"

    def mark_event(self):
        """Called by ingestion when an event arrives (Phase 5)."""
        from django.utils import timezone
        self.last_event_at = timezone.now()
        if self.status in (self.Status.NOT_INSTALLED, self.Status.DETECTED):
            self.status = self.Status.ACTIVE
        self.save(update_fields=["last_event_at", "status"])
