"""Actively look for the tracking snippet on a customer's live page.

The passive "verify" only knew whether an event had ever arrived. It could not
tell "the snippet isn't on the page" from "the snippet is there but nobody has
visited yet" — so a customer who pasted the tag into the wrong file (a backup,
the staging copy, a page that isn't the one being served) had no way to find
out, and just saw "waiting" forever.

This fetches the page the customer's visitors actually get and looks for the
snippet in the returned HTML, so the answer can be specific: not there, there
but quiet, or unreachable.

It reuses the Bot Check fetcher, which is already SSRF-hardened (scheme/port
allow-list, private-IP rejection, redirect re-validation). We only read the
homepage HTML — nothing is scanned or stored.
"""
from urllib.parse import urlparse

from apps.intelligence.botcheck import _fetch, _validate

# Outcomes the caller turns into a message. Kept as plain strings so the API
# shape is obvious and testable.
FOUND = "found"                 # snippet is in the served HTML
MISSING = "missing"             # page loaded, snippet not in it
UNREACHABLE = "unreachable"     # couldn't load the page at all
NO_URL = "no_url"               # we don't know which URL to check


def _candidate_url(website) -> str:
    """The address a real visitor would open. Prefer the explicit url; fall back
    to the domain. Returns "" when we have neither."""
    raw = (website.url or "").strip()
    if not raw:
        domain = (website.domain or "").strip()
        if not domain:
            return ""
        raw = domain
    if not raw.startswith(("http://", "https://")):
        raw = "https://" + raw
    return raw


def _snippet_present(html: str, tracking_id: str) -> bool:
    """True when the page carries our tag for THIS site.

    The reliable marker is the site id in a data-site-id attribute — the script
    src differs between dev/staging/prod, and matching the id avoids reporting
    'installed' when the customer pasted some other workspace's snippet.
    """
    if not tracking_id:
        return False
    body = html.lower()
    tid = tracking_id.lower()
    return (f'data-site-id="{tid}"' in body) or (f"data-site-id='{tid}'" in body)


def check(website) -> dict:
    """Return {state, url, checked_url, status_code?} for the site's live page."""
    url = _candidate_url(website)
    if not url:
        return {"state": NO_URL, "url": ""}

    ok, err = _validate(url)
    if err:
        # A bad/blocked address is, from the customer's point of view, a page we
        # can't reach — same next step (fix the URL), so don't leak SSRF detail.
        return {"state": UNREACHABLE, "url": url, "reason": err}

    try:
        status_code, _headers, body, final_url = _fetch(url)
    except Exception:
        return {"state": UNREACHABLE, "url": url}

    present = _snippet_present(body, website.tracking_id)
    return {
        "state": FOUND if present else MISSING,
        "url": url,
        "checked_url": final_url,
        "status_code": status_code,
    }
