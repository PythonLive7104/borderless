"""The public publish endpoint: POST/PUT /api/v1/notify/<key>.

Deliberately not behind bearer auth — the secret is the URL, exactly like an
ntfy topic, so it drops straight into a form action, a survey webhook, or a
`curl` from someone else's server with nothing else to configure.

Accepts POST, PUT or GET. POST/PUT take a raw text body or JSON
{"message", "title"}; GET takes ?message= (or ?m=) and ?title= (or ?t=), so a
tool that can only fire a GET — a link, an uptime ping, a webhook that won't do
POST — can still publish. The message is the only required part, and on a bare
GET it defaults to a trigger note so even a pinged link records something. The
title falls back to the channel name so the feed always has a heading.
"""
import json

from django.utils import timezone
from rest_framework import permissions, views
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from . import quota
from .models import Notification, NotifyChannel, sha256

MAX_MESSAGE = 4000
MAX_TITLE = 200
# Two retention rules, applied together on every publish (and by a cron for
# channels that go quiet):
#   - keep at most KEEP_PER_ORG per WORKSPACE, oldest dropped first
#   - drop anything older than MAX_AGE_HOURS regardless of count
# The feed is a short-lived "what just happened", not an archive.
KEEP_PER_ORG = 100
MAX_AGE_HOURS = 48

RL_LIMIT = 60      # publishes
RL_WINDOW = 60     # per minute, per channel

# The whole point is publishing from a customer's own form/site, which is
# cross-origin, so the browser needs these. The key in the URL is the auth, so
# allowing any origin is intended (same posture as ntfy and our /v1/collect).
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
}


def _cors(response):
    for k, v in CORS.items():
        response[k] = v
    return response


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


def _fields_to_message(items):
    """Turn submitted form fields into a readable (title, message).

    Honours the ntfy-style convention first — a `message`/`body` field, with an
    optional `title` — so an intentional integration controls exactly what shows.
    Otherwise it's a plain HTML form we don't control the field names of, so each
    non-empty field is rendered as "name: value", one per line. Either way the
    viewer sees the VALUES, never the multipart envelope.
    """
    d = {}
    for k, v in items:
        d.setdefault(k, v)  # first value wins for the message/title lookup
    title = str(d.get("title") or "")[:MAX_TITLE]
    body = d.get("message") or d.get("body")
    if body is not None:
        return title, str(body)[:MAX_MESSAGE]
    lines = [f"{k}: {v}" for k, v in items if str(v).strip()]
    return title, "\n".join(lines)[:MAX_MESSAGE]


def _parse(request):
    """Pull (title, message) from a POST/PUT body — JSON, a submitted form, or
    raw text — never the raw multipart envelope."""
    ctype = request.META.get("CONTENT_TYPE", "")

    if "application/json" in ctype:
        try:
            data = json.loads((request.body or b"").decode("utf-8", "replace") or "{}")
        except ValueError:
            return "", ""
        if isinstance(data, dict):
            return (str(data.get("title") or "")[:MAX_TITLE],
                    str(data.get("message") or data.get("body") or "")[:MAX_MESSAGE])
        return "", ""

    if "multipart/form-data" in ctype:
        # Let DRF's MultiPartParser turn the envelope into fields.
        items = [(k, str(v)) for k in request.data.keys() for v in request.data.getlist(k)]
        return _fields_to_message(items)

    if "application/x-www-form-urlencoded" in ctype:
        raw = (request.body or b"").decode("utf-8", "replace")
        # `curl -d "just a message"` is urlencoded but has no "=" — treat that as
        # raw text so the simplest one-liner still works.
        if "=" in raw:
            from urllib.parse import parse_qsl
            return _fields_to_message(parse_qsl(raw, keep_blank_values=True))
        return "", raw[:MAX_MESSAGE]

    # anything else: raw text body
    return "", (request.body or b"").decode("utf-8", "replace")[:MAX_MESSAGE]


def _parse_query(request):
    """(title, message) from the query string, for GET publishes. A bare GET
    with no message still records — the point is often just 'this link was hit'."""
    q = request.query_params
    title = (q.get("title") or q.get("t") or "")[:MAX_TITLE]
    message = (q.get("message") or q.get("m") or "").strip()[:MAX_MESSAGE]
    if not message:
        message = "Notification triggered"
    return title, message


class NotifyIngestView(views.APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request, key):
        return self._ingest(request, key)

    def put(self, request, key):
        return self._ingest(request, key)

    def get(self, request, key):
        return self._ingest(request, key)

    def options(self, request, *args, **kwargs):
        # Preflight for a cross-origin JSON POST. No body, just the headers.
        from rest_framework.response import Response as _R
        return _cors(_R(status=204))

    def _ingest(self, request, key):
        return _cors(self._do(request, key))

    def _do(self, request, key):
        channel = NotifyChannel.objects.filter(key_hash=sha256(key), active=True).first()
        if not channel:
            # Same response whether the key is unknown, revoked or paused — a
            # publisher shouldn't be able to probe which keys exist.
            return Response({"ok": False, "error": "Unknown or inactive notification key."},
                            status=404)

        if _rate_limited(channel.id):
            return Response({"ok": False, "error": "Too many notifications — slow down."},
                            status=429)

        if request.method == "GET":
            title, message = _parse_query(request)
        else:
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
        _prune(channel.organization_id)
        _expire(channel.organization_id)
        return Response({"ok": True, "id": note.id}, status=200)


def _prune(organization_id):
    """Trim a workspace to its most recent KEEP_PER_ORG notifications, across
    every channel it owns."""
    ids = list(Notification.objects
               .filter(channel__organization_id=organization_id)
               .order_by("-created_at")
               .values_list("id", flat=True)[KEEP_PER_ORG:KEEP_PER_ORG + 200])
    if ids:
        Notification.objects.filter(id__in=ids).delete()


def _expire(organization_id):
    """Delete this workspace's notifications older than MAX_AGE_HOURS."""
    from datetime import timedelta

    from django.utils import timezone
    cutoff = timezone.now() - timedelta(hours=MAX_AGE_HOURS)
    (Notification.objects
     .filter(channel__organization_id=organization_id, created_at__lt=cutoff)
     .delete())
