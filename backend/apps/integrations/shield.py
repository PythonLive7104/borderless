"""Publish the mappings the Go engine's server-side shield (/v1/decide) needs:

    apikey:{sha256}  -> organization id   (authenticates a decide call)
    site:{tracking_id} -> organization id (binds a key to the sites it may ask about)

Best-effort: a Redis outage must never break the control plane.
"""
from apps.rules.sync import _r
from apps.websites.models import Website
from .models import APIKey


def publish_key(key: "APIKey"):
    try:
        _r().set(f"apikey:{key.key_hash}", str(key.organization_id))
    except Exception:
        pass


def unpublish_key(key_hash: str):
    try:
        _r().delete(f"apikey:{key_hash}")
    except Exception:
        pass


def sync_all():
    """Backfill every active key + every site mapping (run once after deploy)."""
    c = _r()
    n_keys = n_sites = 0
    for k in APIKey.objects.filter(revoked=False):
        c.set(f"apikey:{k.key_hash}", str(k.organization_id))
        n_keys += 1
    for tid, org in Website.objects.values_list("tracking_id", "organization_id"):
        c.set(f"site:{tid}", str(org))
        n_sites += 1
    return n_keys, n_sites
