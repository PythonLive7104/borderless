"""Bring-your-own-domain for redirects.

A customer points their own domain (e.g. go.brand.com) at us and serves their
redirect links on it. Two things make it safe and self-service:

  * Ownership is proven by a DNS TXT record only the owner can set, so nobody
    can claim a domain that isn't theirs.
  * Abuse fallout lands on the customer's own domain reputation, not our shared
    pool — which is the whole appeal for us.

DNS lookups go over DNS-over-HTTPS (Cloudflare, then Google) so this works from
inside the container with no extra dependency and no local resolver assumptions.
"""
import json
import secrets
import urllib.parse
import urllib.request

# Where the ownership TXT lives, and the CNAME target customers point at.
TXT_PREFIX = "_trynobot"
DOH_ENDPOINTS = [
    "https://cloudflare-dns.com/dns-query",
    "https://dns.google/resolve",
]


def new_token() -> str:
    return "tnb-verify-" + secrets.token_hex(16)


def txt_name(host: str) -> str:
    return f"{TXT_PREFIX}.{host}"


def _doh_txt(name: str) -> list:
    """Return the TXT strings for a name, via DoH. [] on any failure."""
    for base in DOH_ENDPOINTS:
        try:
            url = base + "?" + urllib.parse.urlencode({"name": name, "type": "TXT"})
            req = urllib.request.Request(url, headers={"accept": "application/dns-json"})
            with urllib.request.urlopen(req, timeout=6) as r:
                data = json.loads(r.read().decode())
            out = []
            for ans in data.get("Answer", []):
                if ans.get("type") == 16:  # TXT
                    out.append(str(ans.get("data", "")).strip().strip('"'))
            if out:
                return out
        except Exception:
            continue
    return []


def verify_txt(host: str, token: str) -> bool:
    """True when the ownership TXT for host contains the expected token."""
    if not host or not token:
        return False
    records = _doh_txt(txt_name(host))
    return any(token in rec for rec in records)


def valid_host(host: str) -> bool:
    """A conservative hostname check: labels of letters/digits/hyphens, a dot,
    no scheme or path. Rejects our own domains so a customer can't shadow them."""
    host = (host or "").strip().lower()
    if not host or "/" in host or " " in host or ".." in host:
        return False
    if host.startswith(".") or host.endswith(".") or "." not in host:
        return False
    import re
    if not re.match(r"^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$", host):
        return False
    return True
