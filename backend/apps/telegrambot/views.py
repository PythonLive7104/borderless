"""Telegram webhook.

A webhook rather than a polling worker: the VPS already terminates TLS, and a
long-poll process would be another always-on container on a 1.6 GB box.

Two things guard it. The URL carries a secret path segment, and Telegram is
asked to send a secret header with every update — so an update is only accepted
when both match. It always answers 200: Telegram retries anything else, and a
retry would replay the same action.
"""
import json
import logging

from django.conf import settings
from django.utils.crypto import constant_time_compare
from django.views.decorators.csrf import csrf_exempt
from rest_framework import permissions, views
from rest_framework.response import Response

from . import api, handlers
from .models import TelegramLink, TelegramLinkToken

log = logging.getLogger("telegram")


class TelegramWebhookView(views.APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request, secret: str):
        expected = getattr(settings, "TELEGRAM_WEBHOOK_SECRET", "") or ""
        header = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
        if not expected or not constant_time_compare(secret, expected) \
                or not constant_time_compare(header, expected):
            log.warning("telegram webhook rejected (path_ok=%s header_ok=%s)",
                        constant_time_compare(secret, expected),
                        constant_time_compare(header, expected))
            return Response(status=404)   # don't confirm the endpoint exists

        try:
            update = json.loads(request.body.decode())
        except Exception:
            return Response({"ok": True})

        message = update.get("message") or update.get("edited_message") or {}
        chat = message.get("chat") or {}
        chat_id = chat.get("id")
        text = message.get("text") or ""
        if chat_id and text:
            try:
                handlers.handle_message(int(chat_id), text,
                                        (message.get("from") or {}).get("username", ""))
            except Exception:
                # Never 500: Telegram would retry and repeat the action.
                log.exception("telegram handler failed for chat %s", chat_id)
        return Response({"ok": True})


TelegramWebhookView.post = csrf_exempt(TelegramWebhookView.post)


class TelegramConnectView(views.APIView):
    """POST {organization} -> a one-time t.me deep link for this user.

    GET reports whether this workspace already has a chat connected, so the
    dashboard can show "Connected" instead of offering a fresh link.
    """
    permission_classes = [permissions.IsAuthenticated]

    def _membership(self, request, org_id):
        from apps.organizations.models import OrganizationMember
        return OrganizationMember.objects.filter(
            organization_id=org_id, user=request.user).first()

    def get(self, request):
        org_id = request.query_params.get("organization")
        if not org_id or not self._membership(request, org_id):
            return Response({"detail": "Not a member of this workspace."}, status=403)
        link = TelegramLink.objects.filter(organization_id=org_id, user=request.user,
                                           active=True).first()
        return Response({
            "enabled": api.is_enabled(),
            "connected": bool(link),
            "username": link.username if link else "",
        })

    def post(self, request):
        org_id = request.data.get("organization")
        if not org_id or not self._membership(request, org_id):
            return Response({"detail": "Not a member of this workspace."}, status=403)
        if not api.is_enabled():
            return Response({"detail": "The Telegram bot isn't configured yet."}, status=503)

        token = TelegramLinkToken.objects.create(user=request.user, organization_id=org_id)
        bot = getattr(settings, "TELEGRAM_BOT_USERNAME", "") or ""
        return Response({
            "token": token.token,
            "deep_link": f"https://t.me/{bot}?start={token.token}" if bot else "",
            "expires_in_minutes": 15,
        })

    def delete(self, request):
        org_id = request.query_params.get("organization") or request.data.get("organization")
        if not org_id or not self._membership(request, org_id):
            return Response({"detail": "Not a member of this workspace."}, status=403)
        TelegramLink.objects.filter(organization_id=org_id, user=request.user).delete()
        return Response({"disconnected": True})
