"""The public publish endpoint: POST/PUT /api/v1/notify/<key>.

Deliberately not behind bearer auth — the secret is the URL, exactly like an
ntfy topic, so it drops straight into a form action, a survey webhook, or a
`curl` from someone else's server with nothing else to configure.

Accepts either a raw text body or JSON {"message", "title"}. The message is the
only required part; the title falls back to the channel name so the feed always
has a heading.
"""
import json

from django.utils import timezone
from rest_framework import permissions, views
from rest_framework.response import Response

from . import quota
from .models import Notification, NotifyChannel, sha256

MAX_MESSAGE = 4000
MAX_TITLE = 200
# Keep a channel's history bounded so a runaway publisher can't grow the table
# without limit. Oldest rows fall off; the feed only ever shows recent activity.
KEEP_PER_CHANNEL = 500

RL_LIMIT = 60      # publishes
RL_WINDOW = 60     # per minute, per channel


def _client_ip(request):
    xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "") or ""


def _rate_limited(channel_id) -> bool:
    try:
        from apps.intelligence.service import _r
        r = _r()
        key = f"notify:rl:{channel_id}"
        n = r.incr(key)
        if n == 1:
            r.expire(key, RL_WINDOW)
        return n > RL_LIMIT
    except Exception:
        return False  # never drop a real notification over a Redis hiccup


def _parse(request):
    """Pull (title, message) from the request, JSON or raw text."""
    ctype = request.META.get("CONTENT_TYPE", "")
    raw = request.body or b""
    if "application/json" in ctype:
        try:
            data = json.loads(raw.decode("utf-8", "replace") or "{}")
        except ValueError:
            return "", ""
        if isinstance(data, dict):
            return (str(data.get("title") or "")[:MAX_TITLE],
                    str(data.get("message") or data.get("body") or "")[:MAX_MESSAGE])
        return "", ""
    # raw text body
    return "", raw.decode("utf-8", "replace")[:MAX_MESSAGE]


class NotifyIngestView(views.APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request, key):
        return self._ingest(request, key)

    def put(self, request, key):
        return self._ingest(request, key)

    def _ingest(self, request, key):
        channel = NotifyChannel.objects.filter(key_hash=sha256(key), active=True).first()
        if not channel:
            # Same response whether the key is unknown, revoked or paused — a
            # publisher shouldn't be able to probe which keys exist.
            return Response({"ok": False, "error": "Unknown or inactive notification key."},
                            status=404)

        if _rate_limited(channel.id):
            return Response({"ok": False, "error": "Too many notifications — slow down."},
                            status=429)

        title, message = _parse(request)
        message = (message or "").strip()
        if not message:
            return Response({"ok": False, "error": "Send a message (raw text or JSON message field)."},
                            status=400)

        # Quota is charged only for a message we would actually store, and after
        # the rate limit, so a burst of empties can't drain a workspace's credits.
        if not quota.consume(channel.organization_id):
            return Response(
                {"ok": False,
                 "error": "Notification quota reached. Upgrade your plan, or wait "
                          "for tomorrow's allowance on a paid plan."},
                status=429)

        note = Notification.objects.create(
            channel=channel,
            title=(title.strip() or channel.name)[:MAX_TITLE],
            message=message,
            source_ip=_client_ip(request) or None,
        )
        NotifyChannel.objects.filter(pk=channel.pk).update(last_used=timezone.now())
        _prune(channel.id)
        return Response({"ok": True, "id": note.id}, status=200)


def _prune(channel_id):
    """Trim a channel to its most recent KEEP_PER_CHANNEL notifications."""
    ids = list(Notification.objects.filter(channel_id=channel_id)
               .order_by("-created_at")
               .values_list("id", flat=True)[KEEP_PER_CHANNEL:KEEP_PER_CHANNEL + 200])
    if ids:
        Notification.objects.filter(id__in=ids).delete()
