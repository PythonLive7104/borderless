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


def build_payload(org_id) -> str:
    rules = (TrafficRule.objects.filter(organization_id=org_id, active=True)
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
        rules_data = build_payload(org_id)
        ip_data = build_ipfilter_payload(org_id)
        c = _r()
        for tid in Website.objects.filter(organization_id=org_id).values_list("tracking_id", flat=True):
            c.set(f"rules:{tid}", rules_data)
            c.set(f"ipfilter:{tid}", ip_data)
    except Exception:
        pass  # Redis outage must not break the control plane
