"""Public bot-exposure check endpoint (no auth). Rate-limited per client IP."""
from rest_framework import permissions, views
from rest_framework.response import Response

from .botcheck import run_check

RL_LIMIT = 8       # requests
RL_WINDOW = 600    # seconds


def _client_ip(request):
    xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "") or "unknown"


def _rate_limited(ip) -> bool:
    try:
        from apps.intelligence.service import _r
        r = _r()
        key = f"botcheck:rl:{ip}"
        n = r.incr(key)
        if n == 1:
            r.expire(key, RL_WINDOW)
        return n > RL_LIMIT
    except Exception:
        return False  # never block on a Redis hiccup


class BotCheckView(views.APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        if _rate_limited(_client_ip(request)):
            return Response(
                {"ok": False, "error": "You've run a lot of checks — please wait a few minutes and try again."},
                status=429,
            )
        url = request.data.get("url", "")
        return Response(run_check(url))


class BotCheckLeadView(views.APIView):
    """Capture a prospect who wants the full Bot Check report. This is the lead:
    they've seen their own exposure and asked for more. We store them and email
    the report, which starts the relationship and validates the address."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        ip = _client_ip(request)
        if _rate_limited(ip):
            return Response({"ok": False, "error": "Please wait a few minutes and try again."},
                            status=429)
        email = (request.data.get("email") or "").strip().lower()
        url = (request.data.get("url") or "").strip()
        try:
            from django.core.validators import validate_email
            validate_email(email)
        except Exception:
            return Response({"ok": False, "error": "Enter a valid email address."}, status=400)
        if not url:
            return Response({"ok": False, "error": "Missing the scanned site."}, status=400)

        from .models import BotCheckLead
        grade = (request.data.get("grade") or "")[:2]
        try:
            exposure = int(request.data.get("exposure") or 0)
        except (TypeError, ValueError):
            exposure = 0
        lead = BotCheckLead.objects.create(
            email=email, url=url[:2000], grade=grade, exposure=exposure,
            ip=ip if ip != "unknown" else None)
        _send_report(lead)
        return Response({"ok": True})


def _send_report(lead):
    from django.conf import settings
    from django.core.mail import send_mail
    front = getattr(settings, "FRONTEND_URL", "https://trynobot.com").rstrip("/")
    grade = lead.grade or "?"
    send_mail(
        f"Your bot exposure report for {lead.url}",
        f"Thanks for running the free Bot Check on {lead.url}.\n\n"
        f"Exposure grade: {grade}  (score {lead.exposure}/100)\n\n"
        f"The grade reflects how much of your traffic could be automated abuse "
        f"slipping past your current setup. To see it live — exactly how many of "
        f"your real visitors and ad clicks are bots — add the free TryNoBot "
        f"tracker to your site and watch the scores stream in:\n\n"
        f"{front}/signup\n\n"
        f"It takes one script tag and a few minutes. Reply to this email if you'd "
        f"like a hand setting it up.\n\n"
        f"— TryNoBot",
        settings.DEFAULT_FROM_EMAIL, [lead.email], fail_silently=True)
