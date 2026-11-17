"""Is this short domain on the blocklists that mail servers consult?

The existing health check asks whether a short domain resolves, whether it
serves, and whether a browser-safety vendor has flagged it. None of those
catches the failure that costs customers the most, because it happens entirely
inside other people's mail servers:

A receiving MTA extracts every URL from a message and looks each hostname up in
a URI blocklist — Spamhaus DBL, SURBL, URIBL. A hit is treated as near-certain
spam, so the message is refused at SMTP rather than delivered to junk. The
sender gets a bounce; the recipient sees nothing at all.

That is invisible from here. The domain resolves, serves a perfect 302, passes
every browser-safety scan, and the admin list says "Serving normally" — while
every campaign carrying a link on it silently fails to arrive. The giveaway is
that it fails for every sender and every sending platform at once, and that the
same letter arrives the moment the customer pastes their own long URL instead.

Shared short domains earn this quickly, and the category they earn it under is
usually "abused spammed redirector" — which is, from a blocklist's point of
view, an accurate description of a link shortener that a spammer has used. The
pool exists so one listing cannot take every customer down at once, but that
only helps if we know which domain is listed, and a listing is not something
the app can fix: the domain has to be retired or delisted.

The lookup is plain DNS (an A record for "<domain>.<zone>"), so there is no API
key and no vendor account. Two consequences worth knowing:

  * These zones refuse queries from open resolvers and from high-volume public
    DNS. Asking 8.8.8.8 returns 127.255.255.254 ("blocked"), NOT a listing.
    Reading that as a hit would retire perfectly healthy domains, so the error
    codes are decoded explicitly and an inconclusive answer is reported as
    inconclusive. Run this from a host with its own resolver.
  * It answers for the domain, not for a path. That is the right granularity:
    blocklists list hostnames, and so does the MTA doing the lookup.
"""
import socket

# zone -> human name, in the order a report should mention them.
LISTS = [
    ("dbl.spamhaus.org", "Spamhaus DBL"),
    ("multi.surbl.org", "SURBL"),
    ("multi.uribl.com", "URIBL"),
]

# Spamhaus DBL publishes a reason per return code. Worth decoding rather than
# reporting a bare "listed": the operator's next step is completely different
# for "we are a spam domain" (retire it) and "a spammer used our shortener"
# (request delisting, then tighten abuse handling).
DBL_CODES = {
    "127.0.1.2": "spam domain",
    "127.0.1.4": "phishing domain",
    "127.0.1.5": "malware domain",
    "127.0.1.6": "botnet C&C domain",
    "127.0.1.102": "abused legit spam",
    "127.0.1.103": "abused spammed redirector",
    "127.0.1.104": "abused legit phishing",
    "127.0.1.105": "abused legit malware",
    "127.0.1.106": "abused legit botnet C&C",
}

URIBL_CODES = {
    "127.0.0.2": "black",
    "127.0.0.4": "grey",
    "127.0.0.8": "red",
}

SURBL_BITS = [
    (8, "phishing"),
    (16, "malware"),
    (64, "abuse"),
    (128, "cracked"),
]

TIMEOUT = 4


def _resolve(name: str):
    """A records for `name`, or None when the lookup gave no answer.

    NXDOMAIN is the normal, overwhelmingly common reply and means "not listed",
    so it is not an error worth distinguishing here.
    """
    try:
        infos = socket.getaddrinfo(name, None, family=socket.AF_INET,
                                   proto=socket.IPPROTO_TCP)
    except socket.gaierror:
        return None
    except Exception:
        return None
    return sorted({i[4][0] for i in infos})


def _hit_reason(zone: str, addr: str):
    """The listing `addr` represents on `zone`, or None if it is not a listing.

    Deliberately an allow-list of the codes each zone documents as a hit.
    Anything else is treated as "no answer": 127.255.255.x (refused, rate
    limited, open resolver), DBL's 127.0.1.255 (prohibited query), URIBL's
    127.0.0.1 (blocked), and any code a zone invents in future.

    The two mistakes here are not symmetric. Missing a listing leaves a domain
    in service one more day. Inventing one marks a healthy domain as burned and
    moves every customer off it for nothing — and the first run of this module
    against the existing health tests did exactly that, because URIBL answers
    127.0.0.1 for a refused query and an earlier version of this function read
    any unrecognised 127.x as a hit. Hence the allow-list.
    """
    # 127.255.255.x is the universal "refused / rate limited / queried from an
    # open resolver" family, and it has to be rejected before anything decodes
    # the address: SURBL encodes its reasons as bits in the last octet, and
    # 127.255.255.252 has most of those bits set, so a plain refusal would
    # otherwise decode as a confident four-way listing.
    if addr.startswith("127.255.255."):
        return None
    if zone == "dbl.spamhaus.org":
        return DBL_CODES.get(addr)
    if zone == "multi.uribl.com":
        return URIBL_CODES.get(addr)
    if zone == "multi.surbl.org":
        try:
            last = int(addr.rsplit(".", 1)[1])
        except (ValueError, IndexError):
            return None
        bits = [name for bit, name in SURBL_BITS if last & bit]
        return ", ".join(bits) if bits else None
    return None


def check_domain(host: str) -> dict:
    """Look `host` up in every list.

    Returns:
        listed:      any list gave a real hit
        listed_on:   ["Spamhaus DBL: abused spammed redirector", ...]
        unavailable: lists that refused to answer (NOT evidence either way)
        checked:     at least one list answered conclusively
        detail:      a one-line summary for the health column
    """
    host = (host or "").strip().lower().rstrip(".")
    if not host:
        return {"listed": False, "listed_on": [], "unavailable": [],
                "checked": False, "detail": "no host to check"}

    listed_on, unavailable, answered = [], [], 0
    for zone, label in LISTS:
        addrs = _resolve(f"{host}.{zone}")
        if addrs is None:
            answered += 1          # NXDOMAIN: a conclusive "not listed"
            continue
        reasons = [r for r in (_hit_reason(zone, a) for a in addrs) if r]
        if reasons:
            answered += 1
            # Stable order, no duplicates, so the stored detail does not churn
            # between runs and trigger a pointless "it changed" notification.
            listed_on.append(f"{label}: " + ", ".join(sorted(set(reasons))))
        else:
            # It answered, but with nothing this zone documents as a listing —
            # a refusal or rate-limit code. That is not evidence either way.
            unavailable.append(label)

    if listed_on:
        detail = "email blocklist — " + "; ".join(listed_on)
    elif unavailable and not answered:
        detail = "email blocklist check unavailable (" + ", ".join(unavailable) + ")"
    elif unavailable:
        detail = "not on " + str(answered) + " list(s); no answer from " + \
                 ", ".join(unavailable)
    else:
        detail = "not on any email blocklist"

    return {
        "listed": bool(listed_on),
        "listed_on": listed_on,
        "unavailable": unavailable,
        "checked": answered > 0,
        "detail": detail[:300],
    }
