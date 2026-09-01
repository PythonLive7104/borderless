"""Bachs (bachs.io) payments integration — checkout sessions + webhook verify.

Uses only the standard library. The environment (sandbox vs live) is derived
from the API-key prefix: `sk_sandbox_...` hits sandbox-api.bachs.io, `sk_live_...`
hits api.bachs.io. Disabled (no-op) until BACHS_API_KEY is set, so dev keeps the
instant-activation stub.

Two things to confirm against a real Bachs test event when we go live (marked
CONFIRM below): the exact webhook signature scheme and the JSON path where our
checkout `metadata` is echoed back. Everything else follows their documented
REST shape: POST /v1/checkout-sessions with product_cart/customer/return_url.
"""
import hashlib
import hmac
import json
import urllib.error
import urllib.request

from django.conf import settings

SANDBOX_BASE = "https://sandbox-api.bachs.io/v1"
LIVE_BASE = "https://api.bachs.io/v1"


def _key():
    return getattr(settings, "BACHS_API_KEY", "") or ""


def is_enabled():
    return bool(_key())


def _base():
    return LIVE_BASE if _key().startswith("sk_live_") else SANDBOX_BASE


def _post(path, payload):
    req = urllib.request.Request(
        f"{_base()}{path}",
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {_key()}",
            "Content-Type": "application/json",
            "User-Agent": "Borderless/1.0 (+https://borderless.io)",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read().decode()), None
    except urllib.error.HTTPError as e:
        return None, f"Bachs API error {e.code}: {e.read().decode(errors='replace')}"
    except Exception as e:  # network/timeout
        return None, f"Bachs request failed: {e}"


def create_checkout_session(*, product_id, email, return_url, cancel_url, metadata):
    """Create a Bachs hosted checkout session. Returns (data, error)."""
    payload = {
        "product_cart": [{"product_id": product_id, "quantity": 1}],
        "customer": {"email": email},
        "return_url": return_url,
        "cancel_url": cancel_url,
        "metadata": metadata,
    }
    return _post("/checkout-sessions", payload)


def verify_signature(raw_body: bytes, signature_header: str) -> bool:
    """Verify a webhook using the per-destination signing secret.

    CONFIRM: assumes HMAC-SHA256 of the raw body, hex-encoded, compared
    constant-time. Supports both a bare hex digest and a Stripe-style
    `t=<ts>,v1=<hex>` header. Adjust once we see a real Bachs test event.
    """
    secret = getattr(settings, "BACHS_WEBHOOK_SECRET", "") or ""
    if not secret or not signature_header:
        return False
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    candidates = []
    for part in signature_header.split(","):
        part = part.strip()
        if part.startswith("v1="):
            candidates.append(part[3:])
        elif "=" not in part:
            candidates.append(part)
    if not candidates:
        candidates = [signature_header.strip()]
    return any(hmac.compare_digest(expected, c) for c in candidates)
