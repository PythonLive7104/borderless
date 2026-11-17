"""How far a workspace has got towards seeing the product actually work.

The gap this fills is the one that decides whether a trial converts. A new
customer registers, lands on a dashboard with nothing in it, and has to work
out by themselves which of several setup paths they are on and what is still
missing. The existing first-run card (GetStarted) asks the fork question once
and then disappears the moment a website row exists — which is exactly the
point where the snippet is still uninstalled and the dashboard is still empty.
So the help vanishes precisely when it starts being needed.

Two deliberate design decisions, both about not making things worse:

**Nothing is recorded.** Every milestone here is already implied by data the
app stores: Website.snippet_seen_at, Website.last_event_at, TrafficEvent rows
and their classification/action. Writing a parallel set of "activation event"
rows would mean a second source of truth that can disagree with the first, and
the honest ones to record — first visitor, first detection — would land on the
traffic ingestion path, which processes every event from every customer. A
dashboard panel is not worth a database write per pageview. So this derives
state on demand instead.

**Nothing is invented.** A step appears here only if the codebase can actually
answer it. "First report viewed" is in the brief, but nothing records a report
being opened, and adding tracking for it is a bigger decision than a checklist
item deserves — so it is absent rather than guessed at. Likewise there is no
"configure your rules" step: create_default_rule() runs when a website is
added, so it would be ticked before the customer did anything, which teaches
them to ignore the list.
"""
from dataclasses import dataclass, field


@dataclass
class Step:
    key: str
    title: str
    # What the customer gets, not what the system does. "Add your website" is
    # an instruction; "we can start scoring your visitors" is a reason.
    detail: str
    done: bool = False
    at: object = None              # when it happened, if we can date it
    cta_label: str = ""
    cta_path: str = ""
    # Optional steps count towards neither the total nor the "what next"
    # prompt. The Shield is genuinely optional — the tracker alone is a
    # complete install — and listing it as outstanding work would make a
    # finished setup look unfinished forever.
    optional: bool = False
    meta: dict = field(default_factory=dict)

    def as_dict(self):
        return {
            "key": self.key, "title": self.title, "detail": self.detail,
            "done": self.done, "at": self.at, "optional": self.optional,
            "cta_label": self.cta_label, "cta_path": self.cta_path,
            "meta": self.meta,
        }


def _first(qs, field_name="created_at"):
    """The earliest value of `field_name`, or None. One indexed row, not a count."""
    return (qs.order_by(field_name).values_list(field_name, flat=True).first())


def activation_state(organization_id) -> dict:
    """The workspace's setup progress, derived from what it has actually done.

    Returns ordered steps plus the one thing to do next, so the dashboard can
    render a checklist without deciding any of this itself.
    """
    from apps.links.models import ShortLink
    from apps.traffic.models import TrafficEvent
    from apps.websites.models import Website

    # The internal redirect holder is not a site the customer added.
    sites = Website.objects.filter(organization_id=organization_id, is_system=False)
    site_ids = list(sites.values_list("id", flat=True))
    links = ShortLink.objects.filter(organization_id=organization_id)

    events = TrafficEvent.objects.filter(website_id__in=site_ids) if site_ids \
        else TrafficEvent.objects.none()

    first_site_at = _first(sites)
    first_link_at = _first(links)

    # Installed means "we have seen it working", by either proof: our tag in
    # the served page, or an event that arrived. Both are already recorded on
    # the Website row by the verify endpoint and the traffic consumer.
    installed_at = min(
        [t for t in (_first(sites.exclude(snippet_seen_at=None), "snippet_seen_at"),
                     _first(sites.exclude(last_event_at=None), "last_event_at"))
         if t is not None],
        default=None)

    first_event_at = _first(events)
    # "Suspicious" to a customer means anything we did not class as a human.
    first_detection_at = _first(
        events.filter(classification__in=("suspicious", "bot", "fraud")))
    # Protection doing something, rather than only reporting it.
    first_action_at = _first(events.exclude(action="allow").exclude(action=""))
    shield_at = _first(events.filter(type="server_check"))

    target_done = bool(first_site_at or first_link_at)
    target_at = min([t for t in (first_site_at, first_link_at) if t], default=None)

    steps = [
        Step(
            key="target",
            title="Add what you want to protect",
            detail="A website you own, or a short link you put in front of your ads. "
                   "You do not need both.",
            done=target_done, at=target_at,
            cta_label="Add a website", cta_path="/dashboard/websites",
        ),
        Step(
            key="install",
            title="Install your tracking snippet",
            detail="One script tag before </head>. We confirm it ourselves by reading "
                   "your page — you do not have to wait for a visitor.",
            done=installed_at is not None, at=installed_at,
            cta_label="Get my snippet", cta_path="/dashboard/websites",
        ),
        Step(
            key="traffic",
            title="See your first visitor scored",
            detail="Every visit gets a 0–100 risk score with the signals behind it.",
            done=first_event_at is not None, at=first_event_at,
            cta_label="Open live traffic", cta_path="/dashboard/visitors",
        ),
        Step(
            key="detection",
            title="Catch your first suspicious visitor",
            detail="Bots, datacenter IPs, proxies and automation, with the reason each "
                   "one was flagged.",
            done=first_detection_at is not None, at=first_detection_at,
            cta_label="Review flagged visitors", cta_path="/dashboard/visitors",
        ),
        Step(
            key="protection",
            title="Turn protection on",
            detail="Decide what happens to suspicious traffic — allow, review, tag or "
                   "block — and watch the rules act.",
            done=first_action_at is not None, at=first_action_at,
            cta_label="Set traffic rules", cta_path="/dashboard/rules",
        ),
        Step(
            key="shield",
            title="Add the server-side Shield",
            detail="Optional, and the strongest option: blocks automation before your "
                   "page loads, including bots that never run JavaScript.",
            done=shield_at is not None, at=shield_at, optional=True,
            cta_label="Install the Shield", cta_path="/dashboard/shield",
        ),
    ]

    required = [s for s in steps if not s.optional]
    done = [s for s in required if s.done]
    # The next thing to do is the first unfinished REQUIRED step. Optional work
    # is never presented as the next thing, or a complete setup would keep
    # nagging about the Shield.
    nxt = next((s for s in required if not s.done), None)

    return {
        "steps": [s.as_dict() for s in steps],
        "completed": len(done),
        "total": len(required),
        "percent": round(100 * len(done) / len(required)) if required else 0,
        "complete": nxt is None,
        "next": nxt.as_dict() if nxt else None,
        # Which path they took, so the dashboard can word things correctly for
        # someone who only ever uses redirects and has no website at all.
        "has_website": bool(first_site_at),
        "has_link": bool(first_link_at),
    }
