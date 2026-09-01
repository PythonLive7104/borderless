"""Publishes campaign config into Redis for the Go decision service to read.

This is Django's side of the Redis contract (see docs/redis-contract.md).
Django is the ONLY writer of config keys.
"""
import json
import redis
from django.conf import settings

CONTRACT_VERSION = 1

_client = None


def client() -> redis.Redis:
    global _client
    if _client is None:
        _client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _client


def campaign_key(public_id: str) -> str:
    return f"campaign:{public_id}"


def ipblock_key(public_id: str) -> str:
    return f"campaign:{public_id}:ipblock"


def build_config(campaign) -> dict:
    return {
        "v": CONTRACT_VERSION,
        "public_id": campaign.public_id,
        "active": campaign.active,
        "money": {"mode": campaign.money_mode, "value": campaign.money_value},
        "white": {"mode": campaign.white_mode, "value": campaign.white_value},
        "rules": {
            "geo_allow": campaign.geo_allow or [],
            "geo_deny": campaign.geo_deny or [],
            "device_allow": campaign.device_allow or [],
            "block_headless": campaign.block_headless,
            "block_datacenter_ip": campaign.block_datacenter_ip,
            "ip_blocklist_ref": ipblock_key(campaign.public_id),
            "ua_deny_substrings": campaign.ua_deny_substrings or [],
        },
    }


def push_campaign(campaign):
    """Write (or refresh) a campaign's config in Redis."""
    c = client()
    c.set(campaign_key(campaign.public_id), json.dumps(build_config(campaign)))
    # sync IP blocklist set
    bkey = ipblock_key(campaign.public_id)
    c.delete(bkey)
    if campaign.ip_blocklist:
        c.sadd(bkey, *campaign.ip_blocklist)


def remove_campaign(public_id: str):
    c = client()
    c.delete(campaign_key(public_id), ipblock_key(public_id))
