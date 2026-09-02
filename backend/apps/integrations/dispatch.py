"""Best-effort webhook delivery with HMAC signing and a short retry."""
import hashlib
import hmac
import json
import urllib.request

from .models import Webhook, WebhookDelivery


def _sign(secret: str, body: bytes) -> str:
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def dispatch(org_id: int, event: str, payload: dict):
    hooks = Webhook.objects.filter(organization_id=org_id, active=True)
    for hook in hooks:
        if event not in (hook.events or []):
            continue
        body = json.dumps({"event": event, "data": payload}).encode()
        sig = _sign(hook.secret, body)
        ok, code, attempts = False, None, 0
        for attempt in range(2):  # 1 try + 1 retry
            attempts = attempt + 1
            try:
                req = urllib.request.Request(hook.url, data=body, method="POST", headers={
                    "Content-Type": "application/json",
                    "X-TryNoBot-Event": event,
                    "X-TryNoBot-Signature": sig,
                })
                with urllib.request.urlopen(req, timeout=3) as resp:
                    code = resp.status
                    ok = 200 <= code < 300
                if ok:
                    break
            except Exception:
                ok = False
        WebhookDelivery.objects.create(webhook=hook, event=event, success=ok,
                                       status_code=code, attempts=attempts)
