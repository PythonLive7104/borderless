"""Public contact endpoint.

The form on the marketing site promises a reply within one business day, so
this saves the message first and notifies second: a mail failure must never be
the reason an enquiry disappears.
"""
from django.conf import settings
from rest_framework import permissions, views
from rest_framework.response import Response

from .models import ContactMessage

RL_LIMIT = 5       # submissions
RL_WINDOW = 3600   # per hour, per IP


def _client_ip(request):
    xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "") or ""


def _rate_limited(ip) -> bool:
    if not ip:
        return False
    try:
        from apps.intelligence.service import _r
        r = _r()
        key = f"contact:rl:{ip}"
        n = r.incr(key)
        if n == 1:
            r.expire(key, RL_WINDOW)
        return n > RL_LIMIT
    except Exception:
        return False  # never turn away a real enquiry over a Redis hiccup


class ContactView(views.APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        ip = _client_ip(request)
        if _rate_limited(ip):
            return Response(
                {"ok": False, "error": "That's a lot of messages — please email us directly "
                                       "so nothing gets lost."},
                status=429)

        name = (request.data.get("name") or "").strip()
        email = (request.data.get("email") or "").strip().lower()
        message = (request.data.get("message") or "").strip()
        if not name or not message:
            return Response({"ok": False, "error": "Tell us your name and how we can help."},
                            status=400)
        try:
            from django.core.validators import validate_email
            validate_email(email)
        except Exception:
            return Response({"ok": False, "error": "Enter a valid email address."}, status=400)

        msg = ContactMessage.objects.create(
            name=name[:120], email=email, company=(request.data.get("company") or "").strip()[:160],
            message=message[:5000], ip=ip or None)
        _notify(msg)
        return Response({"ok": True})


def _notify(msg):
    """Email the team. Best effort — the row is already saved."""
    from django.core.mail import EmailMessage

    to = getattr(settings, "SUPPORT_EMAIL", "") or settings.DEFAULT_FROM_EMAIL
    body = (f"From: {msg.name} <{msg.email}>\n"
            f"Company: {msg.company or '—'}\n"
            f"IP: {msg.ip or '—'}\n\n{msg.message}\n")
    try:
        EmailMessage(
            f"Contact form: {msg.name}", body, settings.DEFAULT_FROM_EMAIL, [to],
            # So hitting reply in the inbox answers the prospect, not ourselves.
            reply_to=[msg.email],
        ).send(fail_silently=True)
    except Exception:
        pass
