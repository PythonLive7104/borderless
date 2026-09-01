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

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    def __str__(self):
        return self.email


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
