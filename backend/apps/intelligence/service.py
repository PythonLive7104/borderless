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


#: How long a coarse proxy/datacenter flag is trusted. Must match
#: intelFlagTTL() in decision/main.go — both services read each other's flags.
INTEL_FLAG_TTL = 7 * 24 * 3600


def intel_flag_key(kind: str, ip: str) -> str:
    return f"ipintel:flag:{kind}:{ip}"


def enrich(ip: str) -> dict:
    """Look up an IP (cached). Sets the shared ipintel:flag:* keys."""
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
    # Share the coarse verdict with the Go engine.
    #
    # Per-IP keys with a TTL, not members of a permanent set. The sets these
    # replace had no expiry, so an address stayed flagged forever while the
    # detailed record beside it expired after a day — and a residential IP that
    # once hosted a VPN exit went on turning away whichever real customer was
    # assigned it next. Redis cannot expire a set member individually, so the
    # membership has to be a key of its own.
    if data:
        if data.get("datacenter"):
            r.setex(intel_flag_key("datacenter", ip), INTEL_FLAG_TTL, "1")
        if data.get("proxy") or data.get("vpn"):
            r.setex(intel_flag_key("proxy", ip), INTEL_FLAG_TTL, "1")
    return data
