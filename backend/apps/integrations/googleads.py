"""Google Ads OAuth + the push boundary, standard library only.

This is the credential half of the IP-exclusion feature. The allocator that
decides WHICH addresses to exclude lives in apps.traffic.exclusions and needs
nothing from Google; this module is only about getting, and later using, the
customer's permission to write those exclusions into their ad account.

Three deliberate safety properties, because this touches someone's ad spend:

  * **Inert when unconfigured.** Without GOOGLE_ADS_CLIENT_ID/SECRET/REDIRECT the
    whole feature is off — is_enabled() is false, no URL is built, nothing is
    called. Ships dark and stays dark until the operator sets the credentials.

  * **State is signed, not stored.** The OAuth `state` carries the workspace and
    user, signed with the Django secret and time-limited, so the callback can
    trust who began the flow without a server-side session table — and a tampered
    or replayed state is rejected.

  * **Live push is double-gated.** Even with credentials present and an account
    connected, the actual mutate that changes the ad account does nothing unless
    GOOGLE_ADS_LIVE_PUSH is explicitly on. Until then every push is a dry run
    that reports what it *would* do. An untested integration cannot alter a
    customer's campaigns by accident.
"""
import json
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings
from django.core import signing

# The one scope the Ads API needs. Sensitive — Google reviews it before any
# account outside the test list can grant it (hence the demo video).
SCOPE = "https://www.googleapis.com/auth/adwords"

AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke"

# How the state token is namespaced and how long it stays valid. Ten minutes is
# plenty to complete a consent screen and short enough that a leaked URL is not
# useful later.
_STATE_SALT = "integrations.googleads.oauth-state"
STATE_MAX_AGE = 600


def is_enabled() -> bool:
    """True only when the OAuth client is fully configured."""
    return bool(_client_id() and _client_secret() and _redirect_uri())


def live_push_enabled() -> bool:
    """Whether the real mutate may fire. Off by default; see module docstring."""
    return is_enabled() and bool(getattr(settings, "GOOGLE_ADS_LIVE_PUSH", False))


def _client_id():
    return getattr(settings, "GOOGLE_ADS_CLIENT_ID", "") or ""


def _client_secret():
    return getattr(settings, "GOOGLE_ADS_CLIENT_SECRET", "") or ""


def _redirect_uri():
    return getattr(settings, "GOOGLE_ADS_REDIRECT_URI", "") or ""


# --- state: who started this flow, signed so the callback can trust it --------

def make_state(organization_id, user_id) -> str:
    return signing.dumps({"org": int(organization_id), "uid": int(user_id)},
                         salt=_STATE_SALT)


def read_state(state: str):
    """Return (organization_id, user_id) or None if forged/expired."""
    try:
        data = signing.loads(state, salt=_STATE_SALT, max_age=STATE_MAX_AGE)
        return int(data["org"]), int(data["uid"])
    except (signing.BadSignature, signing.SignatureExpired, KeyError, ValueError, TypeError):
        return None


# --- the authorization URL ----------------------------------------------------

def authorize_url(state: str) -> str:
    """The Google consent URL to send the customer to.

    access_type=offline + prompt=consent is what makes Google return a refresh
    token (the long-lived credential we actually need); without them we would
    get only a one-hour access token and no way to act later.
    """
    params = {
        "client_id": _client_id(),
        "redirect_uri": _redirect_uri(),
        "response_type": "code",
        "scope": SCOPE,
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
        "state": state,
    }
    return f"{AUTH_ENDPOINT}?{urllib.parse.urlencode(params)}"


# --- token exchange / refresh (live network; feature-gated callers) ----------

def _post_form(url: str, fields: dict) -> dict:
    data = urllib.parse.urlencode(fields).encode()
    req = urllib.request.Request(
        url, data=data, method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded",
                 "Accept": "application/json",
                 "User-Agent": "TryNoBot/1.0 (+https://trynobot.com)"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode())


def exchange_code(code: str) -> dict:
    """Swap an authorization code for tokens. Raises on failure."""
    return _post_form(TOKEN_ENDPOINT, {
        "code": code,
        "client_id": _client_id(),
        "client_secret": _client_secret(),
        "redirect_uri": _redirect_uri(),
        "grant_type": "authorization_code",
    })


def refresh_access_token(refresh_token: str) -> dict:
    """Mint a fresh access token from the stored refresh token."""
    return _post_form(TOKEN_ENDPOINT, {
        "refresh_token": refresh_token,
        "client_id": _client_id(),
        "client_secret": _client_secret(),
        "grant_type": "refresh_token",
    })


def revoke(token: str) -> bool:
    """Best-effort revoke at Google. Never raises — a local disconnect must
    succeed even if Google is unreachable."""
    try:
        _post_form(REVOKE_ENDPOINT, {"token": token})
        return True
    except Exception:
        return False


def normalize_customer_id(raw: str) -> str:
    """"123-456-7890" -> "1234567890". Google wants it without dashes."""
    return "".join(ch for ch in (raw or "") if ch.isdigit())[:20]
