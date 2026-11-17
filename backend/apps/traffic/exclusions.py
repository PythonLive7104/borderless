"""Choosing which IPs to exclude in the ad platform, under a hard cap.

Blocking a visitor at the website stops them seeing the page. It does not stop
the advertiser being charged for the click that brought them — the money is
spent before our code runs. Writing the address back into the ad account as a
campaign exclusion is what stops the charge, and it is the one thing every
competitor does that we do not.

The reason it is not simply "push every blocked IP" is that Google Ads caps IP
exclusions at roughly **500 per campaign**. A busy advertiser can see that many
bad addresses in a week, so the feature is not a sync — it is an allocation
problem. Five hundred slots, far more candidates, and the wrong choice costs
real money twice over: a wasted slot is a click still being paid for, and an
over-broad slot turns away customers.

That is where this module earns its place, and where a naive implementation
(most-recent-500, or first-500-seen) does badly:

**Cost, not count.** A slot should go to the address most likely to cost money
again, which is not the same as the noisiest one. An address that produced ten
paid ad clicks is worth ten times one that produced ten organic visits, because
only the paid ones were ever billed. Scoring is therefore driven by paid clicks
and falls back to flagged traffic only to break ties.

**Ranges, not addresses.** One `203.0.113.*` entry covers 256 addresses and
costs a single slot. A datacenter range that keeps producing fresh addresses
will exhaust 500 individual slots and still be spending the customer's money;
collapsed into one entry it costs a 500th of the budget. This is the single
biggest win available, so the collapse threshold is deliberately low.

**Decay, not history.** A residential address that was abusive in March is
probably someone's home connection now. Score decays with age so stale entries
lose their slot to current offenders, and the allocation is recomputed rather
than accumulated.

**Never the customer's own traffic.** Private, loopback and reserved ranges can
never be the source of a paid click, and excluding one would be a self-inflicted
outage. They are dropped before scoring rather than ranked low.

Everything here is pure computation over rows we already store. It makes no
network calls and needs no credentials, so it can be built, tested and shown to
a customer as a dry run long before a Google developer token exists.
"""
import ipaddress
from collections import defaultdict
from dataclasses import dataclass
from datetime import timedelta

from django.utils import timezone

# Google Ads allows about this many IP exclusions per campaign. Verify against
# current documentation before raising it — the cap has moved before, and
# exceeding it makes the whole mutate fail rather than truncating politely.
CAMPAIGN_IP_LIMIT = 500

# A /24 is collapsed once this many distinct addresses in it have offended.
# Low on purpose: three fresh addresses out of the same /24 is the signature of
# a datacenter range cycling its pool, and spending three slots on it rather
# than one wastes the budget that makes this feature work at all.
RANGE_COLLAPSE_AT = 3

# How far back to consider, and the half-life of an offence inside that window.
LOOKBACK_DAYS = 30
HALF_LIFE_DAYS = 7

# A paid click is what actually costs money, so it dominates the score. Flagged
# non-paid traffic still counts for something — it is evidence the address is
# automated — but it must never outrank a address that is billing the customer.
PAID_CLICK_WEIGHT = 10.0
FLAGGED_WEIGHT = 1.0


@dataclass
class Candidate:
    """One address or range proposed for exclusion."""
    value: str                 # "203.0.113.4" or "203.0.113.*"
    is_range: bool
    score: float
    paid_clicks: int
    flagged_events: int
    addresses: int             # how many distinct addresses this entry covers
    last_seen: object

    def as_dict(self):
        return {
            "value": self.value, "is_range": self.is_range,
            "score": round(self.score, 2), "paid_clicks": self.paid_clicks,
            "flagged_events": self.flagged_events, "addresses": self.addresses,
            "last_seen": self.last_seen,
        }

    @property
    def reason(self) -> str:
        """Why this entry earned a slot, in words an advertiser can check.

        The customer is handing us control of their ad account. "Trust the
        score" is not good enough — every exclusion we propose has to be
        defensible, because a wrong one costs them a real customer.
        """
        bits = []
        if self.paid_clicks:
            bits.append(f"{self.paid_clicks} paid ad click"
                        f"{'s' if self.paid_clicks != 1 else ''}")
        if self.flagged_events:
            bits.append(f"{self.flagged_events} flagged visit"
                        f"{'s' if self.flagged_events != 1 else ''}")
        if self.is_range:
            bits.append(f"{self.addresses} addresses in the same range")
        return ", ".join(bits) or "no activity"


def _usable(ip: str) -> bool:
    """False for anything that cannot legitimately be a paid ad click.

    Excluding a private or reserved range in a live ad account would be a
    self-inflicted outage, so these are dropped here rather than scored low —
    no amount of apparent abuse should ever let one through.
    """
    if not ip:
        return False
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    if addr.version != 4:
        # Google Ads IP exclusions are IPv4 (and v6 in some surfaces). Kept out
        # until it can be tested against the real API rather than assumed.
        return False
    return not (addr.is_private or addr.is_loopback or addr.is_link_local
                or addr.is_reserved or addr.is_multicast or addr.is_unspecified)


def _decay(age_days: float) -> float:
    """Weight of an offence that happened `age_days` ago. 1.0 today."""
    return 0.5 ** (max(0.0, age_days) / HALF_LIFE_DAYS)


def _slash24(ip: str) -> str:
    return ip.rsplit(".", 1)[0]


def score_candidates(rows, now=None) -> list:
    """Rank exclusion candidates from scored traffic rows.

    `rows` is an iterable of dicts with: ip, is_paid_click, flagged, created_at.
    Kept as plain dicts rather than model instances so the ranking can be
    tested, and later fed from an aggregate query, without touching the ORM.
    """
    now = now or timezone.now()
    cutoff = now - timedelta(days=LOOKBACK_DAYS)

    per_ip = defaultdict(lambda: {"score": 0.0, "paid": 0, "flagged": 0, "last": None})

    for row in rows:
        ip = (row.get("ip") or "").strip()
        if not _usable(ip):
            continue
        at = row.get("created_at")
        if at is None or at < cutoff:
            continue

        # Being flagged is what makes an address a candidate. Being paid only
        # changes how much a slot is worth — it is never, on its own, a reason
        # to exclude anybody.
        #
        # Getting this the other way round is the most expensive mistake in the
        # file, and it is an easy one to make, because "paid clicks are what
        # cost money" is true and sounds like the whole story. It is not: a
        # paid click that we scored as human and let through is a REAL CUSTOMER
        # who arrived from the ad the advertiser is paying for. Excluding their
        # address stops that customer ever seeing the ad again. That is worse
        # than any fraud this feature prevents, and it would look like the
        # product working.
        if not row.get("flagged"):
            continue
        weight = PAID_CLICK_WEIGHT if row.get("is_paid_click") else FLAGGED_WEIGHT

        entry = per_ip[ip]
        entry["score"] += weight * _decay((now - at).total_seconds() / 86400.0)
        if row.get("is_paid_click"):
            entry["paid"] += 1
        if row.get("flagged"):
            entry["flagged"] += 1
        if entry["last"] is None or at > entry["last"]:
            entry["last"] = at

    return _collapse(per_ip)


def _collapse(per_ip: dict) -> list:
    """Fold busy /24s into one wildcard entry, then rank everything together.

    A range entry inherits the sum of its members, so a collapsed range
    outranks any single address inside it — which is the point. One slot that
    covers 256 addresses should beat one slot that covers one.
    """
    by_net = defaultdict(list)
    for ip, data in per_ip.items():
        by_net[_slash24(ip)].append((ip, data))

    out = []
    for net, members in by_net.items():
        if len(members) >= RANGE_COLLAPSE_AT:
            out.append(Candidate(
                value=f"{net}.*", is_range=True,
                score=sum(d["score"] for _, d in members),
                paid_clicks=sum(d["paid"] for _, d in members),
                flagged_events=sum(d["flagged"] for _, d in members),
                addresses=len(members),
                last_seen=max(d["last"] for _, d in members),
            ))
            continue
        for ip, d in members:
            out.append(Candidate(
                value=ip, is_range=False, score=d["score"],
                paid_clicks=d["paid"], flagged_events=d["flagged"],
                addresses=1, last_seen=d["last"],
            ))

    # Highest score first; ties broken by recency, then by covering more
    # addresses, then by value so the order is stable between runs. A stable
    # order matters: an unstable one would churn the ad account, mutating
    # exclusions every cycle for no reason.
    out.sort(key=lambda c: (-c.score, -(c.last_seen.timestamp() if c.last_seen else 0),
                            -c.addresses, c.value))
    return out


def allocate(candidates, limit=CAMPAIGN_IP_LIMIT, existing=None) -> dict:
    """Fit the best candidates into the campaign's slots.

    Returns {keep, add, remove, skipped} as lists of exclusion values.

    `existing` is what the ad account already holds. The result is expressed as
    a diff rather than a target list because that is what the API takes and,
    more importantly, because leaving an unchanged exclusion alone is free
    while removing and re-adding it is two mutations and a window where the
    customer is paying again.
    """
    existing = list(existing or [])
    winners = [c.value for c in candidates[:limit]]
    winner_set = set(winners)

    keep = [e for e in existing if e in winner_set]
    remove = [e for e in existing if e not in winner_set]
    add = [v for v in winners if v not in set(existing)]
    skipped = [c.value for c in candidates[limit:]]

    return {"keep": keep, "add": add, "remove": remove, "skipped": skipped,
            "limit": limit, "used": len(winners)}


def plan_for_campaign(website_ids, ad_campaign_id, now=None, limit=CAMPAIGN_IP_LIMIT,
                      existing=None) -> dict:
    """The full dry-run plan for one ad campaign, straight from stored traffic.

    This is the screen a customer can be shown before any Google credentials
    exist: here is exactly what we would exclude, here is why each one, and
    here is what did not fit.
    """
    from apps.traffic.models import TrafficEvent

    now = now or timezone.now()
    events = (TrafficEvent.objects
              .filter(website_id__in=list(website_ids),
                      created_at__gte=now - timedelta(days=LOOKBACK_DAYS))
              .filter(session__ad_campaign_id=ad_campaign_id)
              .exclude(ip=None)
              # A verified search or ad-review crawler is not fraud, and
              # excluding one would hide the advertiser's own landing page from
              # the network reviewing it.
              .exclude(is_reviewer=True)
              .values_list("ip", "session__is_paid_click", "classification",
                           "action", "created_at"))

    rows = [{"ip": ip, "is_paid_click": paid,
             "flagged": classification in ("suspicious", "bot", "fraud")
                        or (action or "allow") != "allow",
             "created_at": at}
            for ip, paid, classification, action, at in events.iterator()]

    candidates = score_candidates(rows, now=now)
    plan = allocate(candidates, limit=limit, existing=existing)
    plan["candidates"] = [c.as_dict() | {"reason": c.reason} for c in candidates[:limit]]
    plan["campaign_id"] = ad_campaign_id
    return plan
