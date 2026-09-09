"""Register (or clear) the bot's webhook with Telegram.

    python manage.py set_telegram_webhook
    python manage.py set_telegram_webhook --delete

Run once after deploying, and again if FRONTEND_URL or the secret changes.
"""
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.telegrambot import api


class Command(BaseCommand):
    help = "Point Telegram at our webhook endpoint."

    def add_arguments(self, parser):
        parser.add_argument("--delete", action="store_true", help="Unregister the webhook.")

    def handle(self, *args, **opts):
        if not api.is_enabled():
            raise CommandError("TELEGRAM_BOT_TOKEN isn't set.")
        secret = getattr(settings, "TELEGRAM_WEBHOOK_SECRET", "")
        if not secret:
            raise CommandError("TELEGRAM_WEBHOOK_SECRET isn't set.")

        if opts["delete"]:
            api.call("deleteWebhook", {"drop_pending_updates": True})
            self.stdout.write(self.style.SUCCESS("Webhook removed."))
            return

        url = f"{settings.FRONTEND_URL.rstrip('/')}/api/telegram/webhook/{secret}/"
        res = api.call("setWebhook", {
            "url": url,
            "secret_token": secret,        # Telegram echoes this back in a header
            "allowed_updates": ["message"],
            "drop_pending_updates": True,
        })
        if not res or not res.get("ok"):
            raise CommandError(f"Telegram refused the webhook: {res}")
        self.stdout.write(self.style.SUCCESS(f"Webhook set to {url}"))
