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
import time
import json
import urllib.error
import urllib.parse
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
            "User-Agent": "TryNoBot/1.0 (+https://trynobot.com)",
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


#: How far out of date a delivery may be, per the Bachs documentation.
SIGNATURE_TOLERANCE_SECONDS = 300


def verify_signature(raw_body: bytes, signature_header: str,
                     timestamp_header: str = "") -> bool:
    """Verify a webhook using the per-destination signing secret.

    The scheme, from docs.bachs.io/guides/webhooks/overview:

        message  = f"{timestamp}.{raw_body}"
        expected = HMAC-SHA256(secret, message).hexdigest()

    The timestamp comes from `X-Bachs-Timestamp`, or from the `t=` field of the
    `X-Bachs-Signature-V2` header, which has the form `t=<unix>,v1=<hex>`. Any
    `v1=` value matching is a pass, because the header may carry several during
    a secret rotation.

    This previously signed the raw body ALONE, with no timestamp. That is why
    every delivery was rejected with "Invalid signature" — the digest could
    never match, whatever the secret was. The original docstring said the scheme
    was assumed from documentation and should be confirmed against a real event;
    it wasn't, and eight live payments were rejected before anyone noticed.
    Treat that as the lesson: the settle-on-return poll is the only reason those
    customers still got their plans.
    """
    secret = getattr(settings, "BACHS_WEBHOOK_SECRET", "") or ""
    if not secret or not signature_header:
        return False

    # Pull the candidate signatures, and the timestamp if it is in the header.
    candidates, ts_from_header = [], ""
    for part in signature_header.split(","):
        part = part.strip()
        if part.startswith("v1="):
            candidates.append(part[3:])
        elif part.startswith("t="):
            ts_from_header = part[2:]
        elif "=" not in part:
            candidates.append(part)
    if not candidates:
        candidates = [signature_header.strip()]

    timestamp = (timestamp_header or ts_from_header or "").strip()
    if not timestamp:
        return False

    # Reject replays of an old, validly-signed delivery.
    try:
        age = abs(time.time() - int(timestamp))
    except (TypeError, ValueError):
        return False
    if age > SIGNATURE_TOLERANCE_SECONDS:
        return False

    message = timestamp.encode() + b"." + raw_body
    expected = hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()
    return any(hmac.compare_digest(expected, c) for c in candidates)

def _get(path):
    req = urllib.request.Request(
        f"{_base()}{path}",
        headers={
            "Authorization": f"Bearer {_key()}",
            "User-Agent": "TryNoBot/1.0 (+https://trynobot.com)",
            "Accept": "application/json",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read().decode()), None
    except urllib.error.HTTPError as e:
        return None, f"Bachs API error {e.code}: {e.read().decode(errors='replace')}"
    except Exception as e:
        return None, f"Bachs request failed: {e}"


def get_product(product_id: str):
    """Fetch one product's configuration from Bachs. Returns (data, error).

    Read-only, and only used by the check_bachs_products command. What a
    checkout offers — price, billing interval, which payment methods appear —
    is a property of the PRODUCT in the Bachs dashboard, not of the session we
    create, so the only way to explain a difference between two checkouts is to
    look at the two products.
    """
    if not product_id:
        return None, "no product id configured"
    return _get(f"/products/{urllib.parse.quote(product_id)}")


def get_checkout_session(session_id: str):
    """Read a checkout session back from Bachs. Returns (data, error).

    This is the authoritative answer to "did they pay?", and unlike the webhook
    it doesn't depend on delivery, on a signature scheme we had to guess, or on
    the customer leaving the tab open.
    """
    if not session_id:
        return None, "No checkout session id."
    return _get(f"/checkout-sessions/{urllib.parse.quote(session_id)}")


# Status names seen across payment providers for "the money arrived".
PAID_STATES = {"paid", "succeeded", "success", "completed", "complete", "settled", "active"}
UNPAID_STATES = {"failed", "cancelled", "canceled", "expired", "refunded", "chargeback"}


def session_is_paid(data) -> bool:
    """Whether a retrieved session represents a completed payment.

    Bachs's exact field name isn't documented to us, so every plausible status
    field is checked and an explicit failure state always wins over a success
    one — being slow to grant access is recoverable, granting it for a failed
    payment is not.
    """
    if not isinstance(data, dict):
        return False
    node = data.get("data") if isinstance(data.get("data"), dict) else data
    values = set()
    for key in ("status", "payment_status", "state", "payment_state", "collection_status"):
        v = node.get(key)
        if isinstance(v, str):
            values.add(v.strip().lower())
    if values & UNPAID_STATES:
        return False
    if values & PAID_STATES:
        return True
    # Some APIs report a boolean instead of a status string.
    return bool(node.get("paid") is True or node.get("is_paid") is True)
