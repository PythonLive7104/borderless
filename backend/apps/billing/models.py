from datetime import timedelta
from django.db import models
from django.utils import timezone
from apps.organizations.models import Organization

TRIAL_DAYS = 7
PERIOD_DAYS = 7  # weekly billing — 7-day access periods


class Plan(models.Model):
    slug = models.SlugField(unique=True)
    name = models.CharField(max_length=60)
    price = models.IntegerField(help_text="USD per week")
    monthly_events = models.BigIntegerField(help_text="Metered event limit per period")
    retention_days = models.IntegerField(default=30)
    team_members = models.IntegerField(default=3, help_text="0 = unlimited")
    max_websites = models.IntegerField(default=0, help_text="Domains cap (0 = unlimited)")
    max_campaigns = models.IntegerField(default=0, help_text="0 = unlimited")
    max_redirects = models.IntegerField(default=0, help_text="Short-link (redirect) cap (0 = unlimited)")
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
    # Explicit end of the current paid period. Weekly access expires here and must
    # be renewed; rollover (start_period) can push it past a bare 7 days.
    period_end = models.DateTimeField(null=True, blank=True)
    trial_end = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # Bachs checkout session id for the most recent upgrade attempt.
    bachs_session_id = models.CharField(max_length=120, blank=True, default="")
    # Plan the user is paying for right now (set at checkout, applied on the
    # webhook, then cleared).
    pending_plan_slug = models.CharField(max_length=50, blank=True, default="")

    def _deadline(self):
        """End of the current access window: the trial end while trialing,
        otherwise the paid period end."""
        return self.trial_end if self.status == self.Status.TRIALING else self.period_end

    def access_state(self):
        """Whether this workspace can use the app, and why.

        Weekly model: access lasts until the period end (or trial end) and then
        LOCKS until renewed — "7 days of access, renew when it runs out".

        active / trialing + in-window -> full access, with days_left
        expired (period_ended / trial_expired) -> locked
        canceled -> locked
        """
        now = timezone.now()
        if self.status == self.Status.CANCELED:
            return {"locked": True, "reason": "canceled", "trial_end": self.trial_end,
                    "deadline": self.period_end, "days_left": 0}
        deadline = self._deadline()
        active_reason = "trialing" if self.status == self.Status.TRIALING else "active"
        expired_reason = "trial_expired" if self.status == self.Status.TRIALING else "period_ended"
        if deadline and now < deadline:
            days_left = max(0, int((deadline - now).total_seconds() // 86400))
            return {"locked": False, "reason": active_reason, "trial_end": self.trial_end,
                    "deadline": deadline, "days_left": days_left}
        return {"locked": True, "reason": expired_reason, "trial_end": self.trial_end,
                "deadline": deadline, "days_left": 0}

    def current_period(self):
        start = self.period_start or self.created_at or timezone.now()
        end = self.period_end or (start + timedelta(days=PERIOD_DAYS))
        return start, end

    def start_period(self, plan):
        """Apply a purchase / renewal / tier change with day-rollover: any unused
        days on the current window carry into the new 7-day period, so renewing
        early or switching tier never loses time. Marks the sub ACTIVE."""
        now = timezone.now()
        deadline = self._deadline()
        remaining = (deadline - now) if (deadline and deadline > now) else timedelta(0)
        self.plan = plan
        self.status = self.Status.ACTIVE
        self.period_start = now
        self.period_end = now + timedelta(days=PERIOD_DAYS) + remaining
        self.pending_plan_slug = ""


# Trial caps: while a workspace is on the free trial it may protect only a
# limited number of sites/campaigns, and cannot create short links at all.
TRIAL_MAX_WEBSITES = 1
TRIAL_MAX_CAMPAIGNS = 1


def is_on_trial(organization_id) -> bool:
    sub = Subscription.objects.filter(organization_id=organization_id).first()
    return bool(sub and sub.status == Subscription.Status.TRIALING)


def _paid_active(sub) -> bool:
    """An active paid subscription still inside its weekly period."""
    return bool(sub and sub.status == Subscription.Status.ACTIVE
                and sub.period_end and timezone.now() < sub.period_end)


def link_shortener_enabled(organization_id) -> bool:
    """Redirection (short links) is included on every paid tier, but NOT on
    the free trial — payment gates it to deter abuse. The count of links is then
    capped per tier (see redirect_limit)."""
    sub = Subscription.objects.filter(organization_id=organization_id).select_related("plan").first()
    return _paid_active(sub)


def redirect_limit(organization_id) -> int:
    """How many short links (redirects) this org may have: 0 while unpaid, else
    the plan's cap. (No tier is unlimited in the weekly model.)"""
    sub = Subscription.objects.filter(organization_id=organization_id).select_related("plan").first()
    if not _paid_active(sub):
        return 0
    return sub.plan.max_redirects


def website_limit(organization_id) -> int:
    """Effective website/domain cap (0 = unlimited). Trial caps at 1; a paid
    plan uses its max_websites."""
    sub = Subscription.objects.filter(organization_id=organization_id).select_related("plan").first()
    if not sub or sub.status == Subscription.Status.TRIALING:
        return TRIAL_MAX_WEBSITES
    return sub.plan.max_websites


def campaign_limit(organization_id) -> int:
    """Effective campaign cap for an org (0 = unlimited)."""
    sub = Subscription.objects.filter(organization_id=organization_id).select_related("plan").first()
    if not sub or sub.status == Subscription.Status.TRIALING:
        return TRIAL_MAX_CAMPAIGNS
    return sub.plan.max_campaigns
