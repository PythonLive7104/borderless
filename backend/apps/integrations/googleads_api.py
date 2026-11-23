"""Thin REST client for the Google Ads API — just the calls the IP-exclusion
push needs, built on the standard library like the rest of this integration.

Scope, on purpose: this is not a general Google Ads SDK. It does three things —
mint an access token, find existing IP exclusions on a campaign, and write the
add/remove operations — because that is the entire surface the exclusion push
touches. A full client library would be a heavy dependency for four endpoints.

The request-BUILDING is pure and unit-tested (build_operations, the resource
names, the search query). The request-SENDING needs a live account and is
exercised by the operator against a Google *test* account with
GOOGLE_ADS_LIVE_PUSH on, before any real campaign — so those paths are marked
no-cover rather than mocked into a false sense of safety.
"""
import json
import urllib.error
import urllib.request

from django.conf import settings

from . import googleads

BASE = "https://googleads.googleapis.com"


def api_version() -> str:
    # Overridable without a code change: Google ships a new version every few
    # months and retires old ones, and a version error is the likeliest first
    # failure. Bump GOOGLE_ADS_API_VERSION rather than editing this.
    return (getattr(settings, "GOOGLE_ADS_API_VERSION", "") or "v21").strip()


def developer_token() -> str:
    return (getattr(settings, "GOOGLE_ADS_DEVELOPER_TOKEN", "") or "").strip()


def login_customer_id() -> str:
    return googleads.normalize_customer_id(
        getattr(settings, "GOOGLE_ADS_LOGIN_CUSTOMER_ID", "") or "")


# --- resource names & request bodies (pure, tested) --------------------------

def campaign_resource(customer_id: str, campaign_id: str) -> str:
    return f"customers/{customer_id}/campaigns/{campaign_id}"


def build_operations(customer_id: str, campaign_id: str, add, remove_resource_names):
    """The mutate operations list for one campaign.

    `add` is a list of IP strings (single address or a "1.2.3.*" wildcard range,
    both of which Google Ads IP exclusions accept). `remove_resource_names` are
    full campaignCriterion resource names already on the account — resolving a
    value back to its resource name is the caller's job (see existing_ip_blocks),
    because a remove is addressed by resource name, not by value.

    An IP exclusion is a campaign criterion with negative=true and an ipBlock.
    """
    ops = []
    campaign = campaign_resource(customer_id, campaign_id)
    for ip in add:
        ops.append({"create": {
            "campaign": campaign,
            "negative": True,
            "ipBlock": {"ipAddress": ip},
        }})
    for rn in remove_resource_names:
        ops.append({"remove": rn})
    return ops


def existing_ip_query(campaign_id: str) -> str:
    """GAQL to read the IP exclusions already on a campaign, so the diff's
    removals can be mapped to resource names and the adds can skip duplicates."""
    return (
        "SELECT campaign_criterion.resource_name, campaign_criterion.ip_block.ip_address "
        "FROM campaign_criterion "
        "WHERE campaign_criterion.type = 'IP_BLOCK' "
        f"AND campaign.id = {int(campaign_id)}")


# --- HTTP (live; needs real credentials) -------------------------------------

def _headers(access_token: str) -> dict:  # pragma: no cover - live only
    h = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "User-Agent": "TryNoBot/1.0 (+https://trynobot.com)",
    }
    # Sunset Sept 2026 and now ignored by the servers, but harmless to send and
    # required by older API versions — so include it when one is configured.
    if developer_token():
        h["developer-token"] = developer_token()
    if login_customer_id():
        h["login-customer-id"] = login_customer_id()
    return h


def _request(method, url, access_token, body=None):  # pragma: no cover - live only
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method,
                                 headers=_headers(access_token))
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")
        raise RuntimeError(f"Google Ads API {e.code}: {detail[:500]}") from e


def access_token_for(account) -> str:  # pragma: no cover - live only
    """A fresh access token from the account's stored refresh token."""
    tok = googleads.refresh_access_token(account.refresh_token)
    at = tok.get("access_token")
    if not at:
        raise RuntimeError("Could not refresh the Google access token.")
    return at


def list_accessible_customers(access_token) -> list:  # pragma: no cover - live only
    """The Ads accounts this OAuth grant can act on, as bare customer ids."""
    url = f"{BASE}/{api_version()}/customers:listAccessibleCustomers"
    data = _request("GET", url, access_token)
    return [rn.split("/")[-1] for rn in data.get("resourceNames", [])]


def existing_ip_blocks(access_token, customer_id, campaign_id) -> dict:  # pragma: no cover
    """{ip_address: resource_name} for the campaign's current IP exclusions."""
    url = f"{BASE}/{api_version()}/customers/{customer_id}/googleAds:search"
    data = _request("POST", url, access_token, {"query": existing_ip_query(campaign_id)})
    out = {}
    for row in data.get("results", []):
        cc = row.get("campaignCriterion", {})
        ip = (cc.get("ipBlock") or {}).get("ipAddress")
        rn = cc.get("resourceName")
        if ip and rn:
            out[ip] = rn
    return out


def mutate_campaign_criteria(access_token, customer_id, operations) -> dict:  # pragma: no cover
    url = f"{BASE}/{api_version()}/customers/{customer_id}/campaignCriteria:mutate"
    return _request("POST", url, access_token, {"operations": operations})
