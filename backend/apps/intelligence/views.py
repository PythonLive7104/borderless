"""Public bot-exposure check endpoint (no auth). Rate-limited per client IP."""
from rest_framework import permissions, views
from rest_framework.response import Response

from .botcheck import run_check
from .unsubscribe import TOKEN_KEY, read_token

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
    """Deliver the report they asked for — the first, consented email."""
    from django.conf import settings
    from django.core.mail import EmailMultiAlternatives

    from .emails import compliance_footer, list_unsubscribe_headers

    front = getattr(settings, "FRONTEND_URL", "https://trynobot.com").rstrip("/")
    grade = lead.grade or "?"
    foot_text, _ = compliance_footer(lead)
    body = (
        f"Thanks for running the free Bot Check on {lead.url}.\n\n"
        f"Exposure grade: {grade}  (score {lead.exposure}/100)\n\n"
        f"The grade reflects how much of your traffic could be automated abuse "
        f"slipping past your current setup. To see it live — exactly how many of "
        f"your real visitors and ad clicks are bots — add the free TryNoBot "
        f"tracker to your site and watch the scores stream in:\n\n"
        f"{front}/signup\n\n"
        f"It takes one script tag and a few minutes. Reply to this email if you'd "
        f"like a hand setting it up.\n\n"
        f"— TryNoBot\n"
        f"{foot_text}"
    )
    msg = EmailMultiAlternatives(
        f"Your bot exposure report for {lead.url}",
        body,
        settings.DEFAULT_FROM_EMAIL,
        [lead.email],
        headers=list_unsubscribe_headers(lead),
    )
    try:
        msg.send(fail_silently=True)
    except Exception:
        pass


class UnsubscribeView(views.APIView):
    """Opt a Bot Check lead out of follow-up mail.

    Served as a plain HTML page rather than JSON on purpose: this is reached by
    clicking a link in an email client, so it has to render on its own with no
    JavaScript, no login and no app shell. POST is the same action, because
    Gmail and Yahoo's one-click unsubscribe POSTs to the List-Unsubscribe URL
    instead of following it.
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        return self._handle(request.query_params.get(TOKEN_KEY, ""))

    def post(self, request):
        token = request.query_params.get(TOKEN_KEY) or request.data.get(TOKEN_KEY) or ""
        return self._handle(token)

    def _handle(self, token):
        from django.utils import timezone
        from .models import BotCheckLead

        lead_id = read_token(token)
        if lead_id is None:
            return _html_page(
                "That link didn't work",
                "We couldn't read that unsubscribe link — it may have been broken up by "
                "your email client. Reply to any of our emails with the word "
                "&ldquo;unsubscribe&rdquo; and a person will take you off the list.",
                status=400,
            )
        # Stamp every lead sharing the address, not just this record: someone who
        # scanned twice has two rows, and opting out of one while we keep mailing
        # the other is exactly the failure the law is written about.
        lead = BotCheckLead.objects.filter(pk=lead_id).first()
        if lead:
            (BotCheckLead.objects
             .filter(email__iexact=lead.email, unsubscribed_at__isnull=True)
             .update(unsubscribed_at=timezone.now()))
        return _html_page(
            "You're unsubscribed",
            "You won't get any more Bot Check emails from us. It takes effect "
            "immediately — nothing further is queued.",
        )


def _html_page(heading, body, status=200):
    """A self-contained confirmation page. No app shell, no assets, no tracking."""
    from django.conf import settings
    from django.http import HttpResponse

    brand = getattr(settings, "BRAND_NAME", "TryNoBot")
    front = getattr(settings, "FRONTEND_URL", "https://trynobot.com").rstrip("/")
    html = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>{heading} &middot; {brand}</title>
<style>
  body{{margin:0;min-height:100vh;display:grid;place-items:center;background:#f1f5f9;
       font:16px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;padding:24px}}
  .card{{background:#fff;border-radius:16px;padding:40px 32px;max-width:460px;text-align:center;
        box-shadow:0 8px 24px -12px rgba(15,23,42,.25)}}
  h1{{margin:0 0 12px;font-size:22px}} p{{margin:0 0 24px;color:#475569;font-size:15px}}
  a{{color:#2563eb;text-decoration:none;font-weight:600}}
</style></head>
<body><div class="card"><h1>{heading}</h1><p>{body}</p>
<a href="{front}">Back to {brand}</a></div></body></html>"""
    return HttpResponse(html, status=status, content_type="text/html; charset=utf-8")
