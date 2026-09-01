from datetime import timedelta
from django.db import models
from django.utils import timezone
from apps.organizations.models import Organization

TRIAL_DAYS = 14


class Plan(models.Model):
    slug = models.SlugField(unique=True)
    name = models.CharField(max_length=60)
    price = models.IntegerField(help_text="USD per month")
    monthly_events = models.BigIntegerField(help_text="Metered event limit per period")
    retention_days = models.IntegerField(default=30)
    team_members = models.IntegerField(default=3, help_text="0 = unlimited")
    sort = models.IntegerField(default=0)
    # Maps this plan to a product created in the Bachs dashboard. Checkout uses it.
    bachs_product_id = models.CharField(max_length=80, blank=True, default="")

    class Meta:
        ordering = ["sort"]

    def __str__(self):
        return f"{self.name} (${self.price})"


class Subscription(models.Model):
    class Status(models.TextChoices):
        TRIALING = "trialing", "Trialing"
        ACTIVE = "active", "Active"
        CANCELED = "canceled", "Canceled"

    organization = models.OneToOneField(Organization, on_delete=models.CASCADE, related_name="subscription")
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT, related_name="subscriptions")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.TRIALING)
    period_start = models.DateTimeField(default=timezone.now)
    trial_end = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # Bachs checkout session id for the most recent upgrade attempt.
    bachs_session_id = models.CharField(max_length=120, blank=True, default="")

    def access_state(self):
        """Whether this workspace can use the app, and why.

        active               -> full access (paid)
        trialing + in-window -> full access, shows days_left
        trialing + expired   -> locked (trial ended, must upgrade)
        canceled             -> locked
        """
        now = timezone.now()
        if self.status == self.Status.ACTIVE:
            return {"locked": False, "reason": "active", "trial_end": self.trial_end, "days_left": None}
        if self.status == self.Status.CANCELED:
            return {"locked": True, "reason": "canceled", "trial_end": self.trial_end, "days_left": 0}
        if self.trial_end and now < self.trial_end:
            days_left = max(0, (self.trial_end - now).days)
            return {"locked": False, "reason": "trialing", "trial_end": self.trial_end, "days_left": days_left}
        return {"locked": True, "reason": "trial_expired", "trial_end": self.trial_end, "days_left": 0}

    def current_period(self):
        start = self.period_start
        end = start + timedelta(days=30)
        now = timezone.now()
        while end < now:
            start, end = end, end + timedelta(days=30)
        return start, end
