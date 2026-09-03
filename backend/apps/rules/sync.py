"""Publish active rules to Redis, keyed per website tracking_id, for the Go engine."""
import json
import redis
from django.conf import settings
from apps.websites.models import Website
from .models import TrafficRule, IPListEntry

_client = None


def _r():
    global _client
    if _client is None:
        _client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _client


def build_payload(org_id, website_id=None) -> str:
    """Rules that apply to one website: its own rules PLUS workspace-wide rules
    (website is null), ordered by priority."""
    from django.db.models import Q
    rules = (TrafficRule.objects.filter(organization_id=org_id, active=True)
             .filter(Q(website__isnull=True) | Q(website_id=website_id))
             .prefetch_related("conditions").order_by("priority", "id"))
    out = []
    for r in rules:
        out.append({
            "action": r.action, "tag": r.tag, "redirect_url": r.redirect_url,
            "conditions": [{"field": c.field, "operator": c.operator, "value": c.value}
                           for c in r.conditions.all()],
        })
    return json.dumps(out)


def build_ipfilter_payload(org_id) -> str:
    entries = IPListEntry.objects.filter(organization_id=org_id, active=True)
    allow, deny = [], []
    for e in entries:
        (allow if e.kind == "allow" else deny).append(e.value)
    return json.dumps({"allow": allow, "deny": deny})


def publish_org(org_id):
    """Write the org's active rules + IP filter to every website it owns."""
    try:
        ip_data = build_ipfilter_payload(org_id)
        c = _r()
        for wid, tid in Website.objects.filter(organization_id=org_id).values_list("id", "tracking_id"):
            c.set(f"rules:{tid}", build_payload(org_id, wid))  # per-website: global + its own
            c.set(f"ipfilter:{tid}", ip_data)
            c.set(f"site:{tid}", str(org_id))  # binds API keys to this site on the shield
    except Exception:
        pass  # Redis outage must not break the control plane
