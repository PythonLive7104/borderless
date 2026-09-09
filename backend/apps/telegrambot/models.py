import secrets
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.organizations.models import Organization

LINK_TOKEN_TTL = timedelta(minutes=15)


def _token() -> str:
    return secrets.token_urlsafe(12).replace("-", "").replace("_", "")[:16]


class TelegramLinkToken(models.Model):
    """A one-time code that ties a Telegram chat to a TryNoBot account.

    The dashboard mints one and hands the user a t.me deep link; the bot spends
    it on /start. Short-lived and single-use, because anyone holding the token
    can attach their own Telegram account to this workspace.
    """
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name="telegram_tokens")
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE,
                                     related_name="telegram_tokens")
    token = models.CharField(max_length=32, unique=True, default=_token, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def expires_at(self):
        return self.created_at + LINK_TOKEN_TTL

    def is_usable(self) -> bool:
        return self.used_at is None and timezone.now() < self.expires_at


class TelegramLink(models.Model):
    """A connected Telegram chat.

    One row per chat. `state` carries the step of a multi-message flow (asking
    for a destination URL, say) — Telegram gives us no session, so the
    conversation has to live here.
    """
    chat_id = models.BigIntegerField(unique=True, db_index=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name="telegram_links")
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE,
                                     related_name="telegram_links")
    username = models.CharField(max_length=64, blank=True, default="")
    state = models.CharField(max_length=40, blank=True, default="",
                             help_text="Current step of a multi-message flow.")
    state_data = models.JSONField(default=dict, blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-last_seen"]

    def __str__(self):
        return f"{self.username or self.chat_id} -> {self.organization.slug}"

    def clear_state(self):
        self.state, self.state_data = "", {}
        self.save(update_fields=["state", "state_data"])
