"""Cloudflare KV sync for edge-served redirects.

The Cloudflare Worker (edge/worker.js) serves a redirect at the edge — in the
visitor's own city — only for links that filter NOBODY: bots and humans alike
go to the destination, so an edge 302 is provably identical to what the origin
would do. Those links are mirrored here into a Cloudflare KV namespace the
Worker reads. Anything that filters (bot handling, challenge, geo/device/OS,
risk cap, rules) is deliberately NOT mirrored, so the Worker passes it through
to the origin for a full scored decision. Getting edge-safety wrong would let a
bot skip filtering, so the check is conservative: any doubt -> not edge-safe.

All network calls are best-effort and no-op unless CF_API_TOKEN, CF_ACCOUNT_ID
and CF_KV_NAMESPACE_ID are set — so nothing here can break a save, and it stays
inert until you deploy the Worker.
"""
import json
import logging
import os
import urllib.error
import urllib.parse
import urllib.request

log = logging.getLogger("bachs")


def edge_simple(link) -> bool:
    """True only when serving this link at the edge is identical to the origin:
    it filters no one. Conservative by construction."""
    if not link.active or link.url_safe is False:
        return False
    if link.bot_action != "off":            # bots would be routed elsewhere
        return False
    if link.challenge or link.deep_check or link.block_vpn or link.block_datacenter:
        return False
    if (link.country_mode or "off") != "off":
        return False
    if (link.device_mode or "off") != "off":
        return False
    if (link.os_mode or "off") != "off":
        return False
    if int(link.max_risk or 0) != 0:
        return False
    # Rules filter too, and a redirect inherits its website's rules when it has
    # none of its own — so both must be empty for the edge to be safe.
    from apps.rules.sync import build_link_payload, build_payload
    if link.pk and build_link_payload(link) != "[]":
        return False
    if link.website_id and build_payload(link.organization_id, link.website_id) != "[]":
        return False
    return True


def kv_key(host: str, slug: str) -> str:
    return f"{host}:{slug}"


def kv_value(link) -> dict:
    """Only what the Worker needs to serve the 302 and report the click back."""
    return {
        "dest": link.destination_url,
        "forward_params": bool(link.forward_params),
        "forward_keys": link.forward_keys(),
        "tid": link.website.tracking_id if link.website_id else "",
        "org": str(link.organization_id),
    }


def _cf():
    tok = os.getenv("CF_API_TOKEN", "")
    acct = os.getenv("CF_ACCOUNT_ID", "")
    ns = os.getenv("CF_KV_NAMESPACE_ID", "")
    return (tok, acct, ns) if (tok and acct and ns) else None


def _cf_call(method: str, key: str, body: bytes | None):
    conf = _cf()
    if not conf:
        return  # not configured -> inert
    tok, acct, ns = conf
    url = (f"https://api.cloudflare.com/client/v4/accounts/{acct}"
           f"/storage/kv/namespaces/{ns}/values/{urllib.parse.quote(key, safe='')}")
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("Authorization", f"Bearer {tok}")
    if body is not None:
        req.add_header("Content-Type", "text/plain")
    try:
        urllib.request.urlopen(req, timeout=6).read()
    except urllib.error.HTTPError as e:
        if not (method == "DELETE" and e.code == 404):  # already gone is fine
            log.warning("edge KV %s %s failed: %s", method, key, e)
    except Exception as e:  # never let edge sync break a link operation
        log.warning("edge KV %s %s error: %s", method, key, e)


def sync_link_kv(link):
    """Mirror an edge-safe link to KV; remove it if it isn't (or no longer is)."""
    if not link.domain_id:
        return
    key = kv_key(link.domain.host, link.slug)
    if edge_simple(link):
        _cf_call("PUT", key, json.dumps(kv_value(link)).encode())
    else:
        _cf_call("DELETE", key, None)


def delete_link_kv(host: str, slug: str):
    if host and slug:
        _cf_call("DELETE", kv_key(host, slug), None)
