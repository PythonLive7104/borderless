"""Enrich IPs with intelligence, cache in Redis, and populate the shared
datacenter/proxy sets the Go engine reads on every request."""
import ipaddress
import json

import redis
from django.conf import settings

from .providers import get_provider

_client = None
_provider = None
CACHE_TTL = 60 * 60 * 24  # 24h


def _r():
    global _client
    if _client is None:
        _client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _client


def _prov():
    global _provider
    if _provider is None:
        _provider = get_provider()
    return _provider


def _skip(ip: str) -> bool:
    if not ip:
        return True
    try:
        a = ipaddress.ip_address(ip)
        return a.is_private or a.is_loopback or a.is_reserved
    except ValueError:
        return True


def enrich(ip: str) -> dict:
    """Look up an IP (cached). Populates ipintel:datacenter / ipintel:proxy sets."""
    if _skip(ip):
        return {}
    r = _r()
    ckey = f"ipintel:cache:{ip}"
    cached = r.get(ckey)
    if cached is not None:
        data = json.loads(cached)
    else:
        data = _prov().lookup(ip)
        r.setex(ckey, CACHE_TTL, json.dumps(data))
    # always keep the shared sets populated (idempotent, cheap)
    if data:
        if data.get("datacenter"):
            r.sadd("ipintel:datacenter", ip)
        if data.get("proxy") or data.get("vpn"):
            r.sadd("ipintel:proxy", ip)
    return data
