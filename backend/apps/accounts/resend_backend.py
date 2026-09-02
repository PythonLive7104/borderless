"""Django email backend that sends through the Resend HTTP API.

Activated automatically when RESEND_API_KEY is set (see config/settings.py).
Uses only the standard library so no extra dependency is required. Falls back
gracefully: on any error it behaves like fail_silently when the caller asked
for it, matching Django's SMTP backend semantics.

Resend requires the `from` address to use a domain you've verified in the
Resend dashboard (or `onboarding@resend.dev` for quick testing).
"""
import json
import urllib.error
import urllib.request

from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend

API_URL = "https://api.resend.com/emails"


class ResendBackend(BaseEmailBackend):
    def __init__(self, fail_silently=False, **kwargs):
        super().__init__(fail_silently=fail_silently, **kwargs)
        self.api_key = getattr(settings, "RESEND_API_KEY", "")

    def send_messages(self, email_messages):
        if not email_messages:
            return 0
        if not self.api_key:
            if not self.fail_silently:
                raise ValueError("RESEND_API_KEY is not configured.")
            return 0
        sent = 0
        for msg in email_messages:
            if self._send(msg):
                sent += 1
        return sent

    def _send(self, msg):
        payload = {
            "from": msg.from_email,
            "to": list(msg.to),
            "subject": msg.subject,
            "text": msg.body,
        }
        if msg.cc:
            payload["cc"] = list(msg.cc)
        if msg.bcc:
            payload["bcc"] = list(msg.bcc)
        # attach an HTML alternative if the caller provided one
        for content, mimetype in getattr(msg, "alternatives", []) or []:
            if mimetype == "text/html":
                payload["html"] = content
                break
        data = json.dumps(payload).encode()
        req = urllib.request.Request(
            API_URL,
            data=data,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                # api.resend.com is behind Cloudflare, which blocks the default
                # "Python-urllib" agent (403 / error 1010). Send a real UA.
                "User-Agent": "TryNoBot/1.0 (+https://trynobot.com)",
                "Accept": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                return 200 <= r.status < 300
        except urllib.error.HTTPError as e:
            if not self.fail_silently:
                body = e.read().decode(errors="replace")
                raise RuntimeError(f"Resend API error {e.code}: {body}") from e
            return False
        except Exception:
            if not self.fail_silently:
                raise
            return False
