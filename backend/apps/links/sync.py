"""Publish short links to Redis (read by the Go engine redirect) and scan
their destinations for threats."""
import json
from django.conf import settings
from django.utils import timezone
from apps.rules.sync import _r


def _bot_base(link) -> str:
    """Where the decoy page lives: the link's OWN domain. Serving it from
    anywhere else would hand a bot a different domain of ours to report."""
    return link.domain.base if link.domain_id else ""


def _payload(link) -> str:
    tid = link.website.tracking_id if link.website_id else ""
    return json.dumps({
        "destination": link.destination_url,
        "tid": tid,
        "slug": link.slug,
        "bot_action": link.bot_action,          # off | decoy | notfound | blank
        "decoy_url": (_bot_base(link) + "/decoy.html") if link.domain_id else "",
        "challenge": bool(link.challenge),      # human check before redirecting
        "challenge_style": link.challenge_style or "hold",
        "forward_params": bool(link.forward_params),
        "forward_keys": link.forward_keys(),
        "block_vpn": bool(link.block_vpn),
        # a link that's inactive OR flagged unsafe stops redirecting
        "active": bool(link.active and link.url_safe is not False),
    })


def publish_link(link):
    """Publish under host+slug. A link with no domain, or on a retired one, is
    withdrawn instead — that is how a burned domain is switched off."""
    try:
        # A link may only be served on a domain its workspace is entitled to:
        # the shared pool, or one it owns privately. Anything else — reclaimed
        # stock, or a domain now rented by somebody else — must be withdrawn,
        # or one customer's links would keep resolving on another's domain.
        d = link.domain if link.domain_id else None
        entitled = bool(d and (
            (d.is_shared and d.organization_id is None)
            or d.organization_id == link.organization_id))
        if not (d and d.usable and entitled):
            unpublish_link(link.slug, link.host())
            return
        _r().set(f"shortlink:{link.host()}:{link.slug}", _payload(link))
    except Exception:
        pass


def unpublish_link(slug: str, host: str = ""):
    try:
        c = _r()
        if host:
            c.delete(f"shortlink:{host}:{slug}")
        else:
            # No host given (a delete where we only kept the slug): clear the
            # slug on every domain so nothing is left resolving anywhere.
            from .models import ShortDomain
            for h in ShortDomain.objects.values_list("host", flat=True):
                c.delete(f"shortlink:{h}:{slug}")
        c.delete(f"shortlink:{slug}")   # retire the old un-hosted key too
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
