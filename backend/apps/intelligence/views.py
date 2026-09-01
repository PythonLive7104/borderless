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
