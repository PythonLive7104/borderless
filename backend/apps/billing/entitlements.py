"""Enforce the weekly access window across every surface, not just the dashboard.

Access used to be checked only by the React AccessGate, which meant an expired
workspace lost the UI but kept everything that actually costs us money: the REST
API answered normally, and the Go engine kept scoring traffic and serving short
links because it reads Redis and Redis knew nothing about billing.

Entitlement is therefore enforced in two places:

  * the API, via HasWorkspaceAccess (below), and
  * Redis, by withdrawing the keys the engine reads — revoke_org()/restore_org().

Revocation deliberately makes the engine fail OPEN: /v1/decide answers
"allow" and /v1/guard returns 204 once site:{tid} is gone. We stop providing
protection; we never take a customer's own website down over billing.

Expiry is a moment in time with no request behind it, so `enforce_access`
(management command, hourly cron) is what actually applies this at the 7-day
mark. Everything here is idempotent and safe to run repeatedly.
"""
from apps.rules.sync import _r
from apps.websites.models import Website

from .models import Subscription


def workspace_locked(organization_id) -> bool:
    """True when this workspace is outside its paid/trial window."""
    sub = (Subscription.objects.filter(organization_id=organization_id)
           .select_related("plan").first())
    if not sub:
        return False   # no subscription row yet — don't lock a half-created org
    return bool(sub.access_state()["locked"])


def _site_ids(organization_id):
    return list(Website.objects.filter(organization_id=organization_id)
                .values_list("tracking_id", flat=True))


def revoke_org(organization_id) -> int:
    """Withdraw everything the Go engine reads for this org. Returns keys removed."""
    from apps.integrations.models import APIKey
    from apps.links.models import ShortLink
    removed = 0
    try:
        c = _r()
        for tid in _site_ids(organization_id):
            removed += c.delete(f"rules:{tid}", f"ipfilter:{tid}", f"site:{tid}")
        for slug in ShortLink.objects.filter(organization_id=organization_id).values_list("slug", flat=True):
            removed += c.delete(f"shortlink:{slug}")
        for kh in APIKey.objects.filter(organization_id=organization_id, revoked=False).values_list("key_hash", flat=True):
            removed += c.delete(f"apikey:{kh}")
    except Exception:
        pass  # a Redis outage must never break billing
    return removed


def restore_org(organization_id) -> int:
    """Republish everything revoke_org() withdrew. Returns keys written."""
    from apps.integrations.models import APIKey
    from apps.links.models import ShortLink
    from apps.links.sync import publish_link
    from apps.rules.sync import publish_org
    written = 0
    try:
        publish_org(organization_id)          # rules:, ipfilter:, site:
        written += len(_site_ids(organization_id)) * 3
        c = _r()
        for kh in APIKey.objects.filter(organization_id=organization_id, revoked=False).values_list("key_hash", flat=True):
            c.set(f"apikey:{kh}", str(organization_id))
            written += 1
        # Only links that are themselves live — never resurrect one abuse disabled.
        for link in ShortLink.objects.filter(organization_id=organization_id, active=True):
            publish_link(link)
            written += 1
    except Exception:
        pass
    return written


def sync_org(organization_id) -> str:
    """Bring Redis in line with this org's current entitlement. Returns what it did."""
    if workspace_locked(organization_id):
        revoke_org(organization_id)
        return "revoked"
    restore_org(organization_id)
    return "restored"
