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
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from concurrent.futures import TimeoutError as FuturesTimeout
from urllib.parse import urlparse

from apps.intelligence.botcheck import _fetch

# How long a verification may take.
#
# The Bot Check report can afford to be patient: someone asked for a scan and
# expects to wait. Verification is a button on the install page, pressed by
# someone who just pasted a snippet, so the costs are reversed — an answer in
# two seconds that is occasionally "we could not reach your site, try again"
# beats a correct answer after a minute.
#
# What it used to cost, worst case: four candidate URLs, each allowed three
# redirect hops, each hop allowed eight seconds, and the alternatives only
# started after the first had finished — about a minute of spinner before the
# page said anything, which is the "verifying takes forever" complaint. The
# numbers below bound it at PROBE_BUDGET no matter how slow the site is.
PROBE_TIMEOUT = 4          # seconds per HTTP request
PROBE_MAX_REDIRECTS = 2    # a site needing more than two hops to its homepage is broken
PROBE_MAX_BYTES = 262_144  # the tag is in the head; 256KB is already generous
PROBE_BUDGET = 7.0         # total wall clock for the whole check
# How long the most likely URL gets to answer on its own before the
# alternatives are tried as well. A correct install on a healthy site answers
# inside this, so it still costs exactly one request to the customer's server;
# past it, latency matters more than tidiness and they all go out together.
HEDGE_DELAY = 0.7

# Outcomes the caller turns into a message. Kept as plain strings so the API
# shape is obvious and testable.
FOUND = "found"                 # snippet is in the served HTML
MISSING = "missing"             # page loaded, snippet not in it
UNREACHABLE = "unreachable"     # couldn't load the page at all
NO_URL = "no_url"               # we don't know which URL to check

# How the tag on the page compares with what strict mode needs. Strict mode
# lives in OUR database but is enforced by an attribute in THEIR HTML, so the
# two drift apart silently: a customer turns strict mode on, we start claiming
# blocked visitors never see the page, and the old async tag is still sitting
# on their site doing none of it. Nothing used to detect that — verify()
# short-circuited on "we're receiving traffic", which an async tag does
# perfectly well. This is how that mismatch becomes visible.
STRICT_OK = "ok"                # tag has data-strict="1" and is not async
STRICT_ASYNC = "async"          # tag is async: it cannot hide the page in time
STRICT_MISSING = "missing_attr"  # tag has no data-strict="1" at all
STRICT_NA = "not_applicable"    # strict mode is off for this website
STRICT_UNKNOWN = "unknown"      # we could not read the page to tell

_SCRIPT_TAG = re.compile(r"<script\b[^>]*>", re.IGNORECASE)


def tag_for(html: str, tracking_id: str) -> str:
    """The opening <script> tag on the page that carries THIS site's id."""
    if not tracking_id or not html:
        return ""
    tid = tracking_id.lower()
    for tag in _SCRIPT_TAG.findall(html):
        low = tag.lower()
        if f'data-site-id="{tid}"' in low or f"data-site-id='{tid}'" in low:
            return tag
    return ""


def strict_state(html: str, tracking_id: str, strict_enabled: bool) -> str:
    """Whether the tag actually on the page can deliver strict mode."""
    if not strict_enabled:
        return STRICT_NA
    tag = tag_for(html, tracking_id)
    if not tag:
        return STRICT_UNKNOWN
    low = tag.lower()
    # `async` as its own attribute, not the letters appearing inside a URL.
    if re.search(r"[\s\"']async(?=[\s=>/])", low) or re.search(r"\sasync\b", low):
        return STRICT_ASYNC
    if 'data-strict="1"' not in low and "data-strict='1'" not in low:
        return STRICT_MISSING
    return STRICT_OK


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


def _candidate_urls(website) -> list:
    """Every address worth trying, best first.

    One URL was not enough in practice. The two addresses that burned the most
    verification attempts:

      * www vs apex. A customer types "example.com" and the snippet is on
        "www.example.com" (or the reverse). We fetched one, got MISSING or
        UNREACHABLE, and told them the snippet wasn't on their page — while it
        was, on the host their visitors actually use.
      * a URL with a path. "example.com/landing" is what they gave us, but the
        tag may only be in the site-wide template reached at the root.

    Neither is a mistake worth a failed check, so we try the alternatives
    ourselves instead of making the customer guess and press the button again.
    """
    first = _candidate_url(website)
    if not first:
        return []

    out = [first]

    def add(u):
        if u and u not in out:
            out.append(u)

    p = urlparse(first)
    host, scheme = p.hostname or "", p.scheme or "https"
    if host:
        # The other half of the www/apex pair.
        alt = host[4:] if host.startswith("www.") else "www." + host
        port = f":{p.port}" if p.port else ""
        if p.path not in ("", "/"):
            add(f"{scheme}://{host}{port}/")        # same host, site root
        add(f"{scheme}://{alt}{port}{p.path or '/'}")
        if p.path not in ("", "/"):
            add(f"{scheme}://{alt}{port}/")

    return out[:4]   # a ceiling, so a weird URL can't fan out


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


def _stop_when(tracking_id: str):
    """A predicate for _fetch that ends the read once the answer is settled.

    Stops only after the site-id attribute AND the `>` that closes its tag have
    arrived, because strict_state() has to read the whole opening tag. Stopping
    at `</head>` would have been simpler and wrong: plenty of customers paste
    the snippet before `</body>`, and we would have reported their working
    install as missing.
    """
    tid = (tracking_id or "").lower().encode()
    if not tid:
        return None
    needles = (b'data-site-id="' + tid + b'"', b"data-site-id='" + tid + b"'")

    def stop(buf: bytes) -> bool:
        low = buf.lower()
        for n in needles:
            i = low.find(n)
            if i >= 0 and low.find(b">", i) >= 0:
                return True
        return False

    return stop


def _probe_one(website, url: str) -> dict:
    """Fetch one address and report what the snippet looks like on it."""
    try:
        # _fetch validates every hop itself and raises ValueError with the same
        # message _validate would have returned, so calling _validate here as
        # well only bought a second DNS lookup per probe.
        status_code, _headers, body, final_url = _fetch(
            url, timeout=PROBE_TIMEOUT, max_bytes=PROBE_MAX_BYTES,
            max_redirects=PROBE_MAX_REDIRECTS,
            stop_when=_stop_when(website.tracking_id))
    except ValueError as e:
        # A bad/blocked address is, from the customer's point of view, a page we
        # can't reach — same next step (fix the URL), so don't leak SSRF detail.
        return {"state": UNREACHABLE, "url": url, "reason": str(e)}
    except Exception:
        return {"state": UNREACHABLE, "url": url}

    present = _snippet_present(body, website.tracking_id)
    return {
        "state": FOUND if present else MISSING,
        "url": url,
        "checked_url": final_url,
        "status_code": status_code,
        "strict_state": strict_state(body, website.tracking_id,
                                     bool(getattr(website, "strict_mode", False))),
        "tag": tag_for(body, website.tracking_id),
    }


def check(website) -> dict:
    """Return {state, url, checked_url, status_code?} for the site's live page.

    The most likely address gets a head start on its own, so a correct install
    on a healthy site still costs exactly one request to the customer's server.
    If it has not answered within HEDGE_DELAY the alternatives (www/apex, site
    root) go out alongside it rather than after it, and the first address that
    carries the tag wins — so a wrong guess about www costs one page-load of
    latency instead of two rounds of them.

    The whole thing is bounded by PROBE_BUDGET. Past that we answer with the
    best result in hand, because a customer watching a spinner is better served
    by "we could not reach your site" than by a correct answer they have
    already given up on. This is what the old version could not do: it waited
    on every probe to completion, and its `with ThreadPoolExecutor` block
    blocked on exit even when an early FOUND had already been returned.
    """
    urls = _candidate_urls(website)
    if not urls:
        return {"state": NO_URL, "url": ""}
    if len(urls) == 1:
        return _probe_one(website, urls[0])

    # Rank: a page carrying the tag always wins; a page that loaded without it
    # beats one we couldn't reach, because "it's not on this page" is a real
    # answer and "couldn't connect" usually just means that host doesn't exist.
    rank = {FOUND: 3, MISSING: 2, UNREACHABLE: 1, NO_URL: 0}
    order = {u: i for i, u in enumerate(urls)}

    def better(candidate, incumbent) -> bool:
        if incumbent is None:
            return True
        cr, ir = rank.get(candidate["state"], 0), rank.get(incumbent["state"], 0)
        if cr != ir:
            return cr > ir
        # Same quality of answer: report the address we considered most likely,
        # not whichever thread happened to finish first, so the "we loaded X but
        # the snippet isn't in it" message names the URL they expect.
        return order.get(candidate["url"], 99) < order.get(incumbent["url"], 99)

    deadline = time.monotonic() + PROBE_BUDGET
    best = None
    pool = ThreadPoolExecutor(max_workers=len(urls))
    try:
        primary = pool.submit(_probe_one, website, urls[0])
        try:
            r = primary.result(timeout=HEDGE_DELAY)
            if r["state"] == FOUND:
                return r
            best, primary = r, None
        except FuturesTimeout:
            pass                      # still running; it joins the fan-out below

        pending = [pool.submit(_probe_one, website, u) for u in urls[1:]]
        if primary is not None:
            pending.append(primary)

        try:
            for fut in as_completed(pending,
                                    timeout=max(0.05, deadline - time.monotonic())):
                try:
                    r = fut.result()
                except Exception:
                    continue
                if r["state"] == FOUND:
                    return r
                if better(r, best):
                    best = r
        except FuturesTimeout:
            pass                      # out of budget: answer with what we have
    finally:
        # wait=False so returning early actually returns early, and
        # cancel_futures so probes that never started are dropped rather than
        # run for nobody.
        pool.shutdown(wait=False, cancel_futures=True)

    return best or {"state": UNREACHABLE, "url": urls[0]}
