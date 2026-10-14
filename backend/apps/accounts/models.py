import secrets
from datetime import timedelta
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    """Custom user; email is the login identifier."""
    email = models.EmailField(unique=True)
    is_verified = models.BooleanField(default=False)
    timezone = models.CharField(max_length=64, default="UTC")
    language = models.CharField(max_length=8, default="en")
    notification_prefs = models.JSONField(default=dict, blank=True)
    # First-touch acquisition data captured by the marketing site (gclid,
    # msclkid, utm_*, landing path). This is how a paying customer is traced
    # back to the ad that bought them: Google can only match a conversion to a
    # click if we can hand back the gclid, and by the time a trial converts the
    # cookie that carried it is long gone. Blank for organic and direct signups.
    attribution = models.JSONField(default=dict, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    def __str__(self):
        return self.email

    @property
    def acquisition_source(self) -> str:
        """A one-line label for where this account came from.

        Collapses the attribution blob into something readable in a list view,
        because the question being asked of it is almost always "which channel
        is producing paying customers", not "what were all the parameters".
        """
        a = self.attribution or {}
        if a.get("gclid"):
            paid = "google / cpc"
        elif a.get("msclkid"):
            paid = "microsoft / cpc"
        else:
            paid = None
        source = a.get("utm_source")
        medium = a.get("utm_medium")
        if source:
            label = f"{source} / {medium}" if medium else source
        elif paid:
            label = paid
        elif a.get("referrer"):
            label = f"referral / {a['referrer']}"
        elif a:
            label = "direct"
        else:
            return "—"
        campaign = a.get("utm_campaign")
        return f"{label} / {campaign}" if campaign else label

    @property
    def is_paid_acquisition(self) -> bool:
        """True when we paid for the click that produced this account."""
        a = self.attribution or {}
        return bool(a.get("gclid") or a.get("msclkid")
                    or a.get("utm_medium") in {"cpc", "ppc", "paid", "paidsearch"})


def _token() -> str:
    return secrets.token_urlsafe(32)


class EmailVerification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="email_verifications")
    token = models.CharField(max_length=64, unique=True, default=_token, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    used_at = models.DateTimeField(null=True, blank=True)

    def is_valid(self) -> bool:
        return self.used_at is None and self.created_at > timezone.now() - timedelta(days=3)


class PasswordReset(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="password_resets")
    token = models.CharField(max_length=64, unique=True, default=_token, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    used_at = models.DateTimeField(null=True, blank=True)

    def is_valid(self) -> bool:
        return self.used_at is None and self.created_at > timezone.now() - timedelta(hours=2)
