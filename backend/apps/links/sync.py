"""Publish short links to Redis (read by the Go engine redirect) and scan
their destinations for threats."""
import json
from django.conf import settings
from django.utils import timezone
from apps.rules.sync import _r


def _bot_base() -> str:
    return (getattr(settings, "SHORTLINK_BASE", "") or settings.FRONTEND_URL).rstrip("/")


def _payload(link) -> str:
    tid = link.website.tracking_id if link.website_id else ""
    return json.dumps({
        "destination": link.destination_url,
        "tid": tid,
        "slug": link.slug,
        "bot_action": link.bot_action,          # off | decoy | notfound | blank
        "decoy_url": _bot_base() + "/decoy.html",
        "challenge": bool(link.challenge),      # human click-to-continue check
        "forward_params": bool(link.forward_params),
        "forward_keys": link.forward_keys(),
        # a link that's inactive OR flagged unsafe stops redirecting
        "active": bool(link.active and link.url_safe is not False),
    })


def publish_link(link):
    try:
        _r().set(f"shortlink:{link.slug}", _payload(link))
    except Exception:
        pass


def unpublish_link(slug: str):
    try:
        _r().delete(f"shortlink:{slug}")
    except Exception:
        pass


def scan_and_flag(link):
    """Scan the destination for malware/phishing; auto-disable if unsafe."""
    from apps.intelligence.threatscan import scan_url, is_enabled
    if not is_enabled() or not link.destination_url:
        return
    try:
        result = scan_url(link.destination_url)
    except Exception:
        return
    link.url_safe = result.get("safe")
    link.url_threats = result.get("threats", []) or []
    link.url_scanned_at = timezone.now()
    if link.url_safe is False:
        link.active = False  # kill malicious links automatically
    link.save(update_fields=["url_safe", "url_threats", "url_scanned_at", "active"])
