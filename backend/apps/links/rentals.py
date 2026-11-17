"""Where a private-domain rental stands, and how it goes back on sale.

A private domain is rented, not sold, and it is an add-on to a live plan rather
than a substitute for one. So "is this domain idle?" has two halves, and the
obvious one is the less reliable:

  * the rental term (`private_until`). Weaker than it looks. When the term moved
    from 30 days to a year in October 2026, `extend_private_domains` topped every
    existing domain up to a full year at no charge — so a customer who stopped
    paying months ago still shows a term running into late 2027. A date in the
    future is not evidence that anybody is paying.

  * the workspace's subscription. This is the one that tells the truth. When the
    plan lapses the engine stops serving that workspace's links entirely
    (`enforce_access` / `revoke_org`), so the domain is already doing nothing for
    anyone — it is simply reserved against a customer who left.

Both are given a grace period before anything is taken away, because a redirect
may be printed on an ad or sitting in an inbox, and someone who renews a few
days late should not find their domain sold.

Releasing lives here rather than in the nightly command, because there are three
legitimate ways it happens — the scheduled job, an admin releasing an idle
domain, and an admin taking one back deliberately — and they must all do the
same thing. It is several steps that are only correct together:

    clear the owner, clear the term, put it back as sellable stock (NOT the
    shared pool), withdraw its links from the engine, and tell the former owner.

Miss the withdrawal and the previous owner's links keep redirecting on a domain
somebody else has since bought. Put it in the shared pool instead of stock and a
domain sold as exclusive starts serving everyone's links.
"""
from datetime import timedelta

from django.utils import timezone

# What state a domain's rental is in. Plain strings so they can be used as admin
# filter values and compared without importing an enum.
UNOWNED = "unowned"          # nobody rents it: shared pool, or stock on the shelf
NO_TERM = "no_term"          # owned by a live workspace, but no end date recorded
PAID = "paid"                # live plan and a term in hand; hands off
GRACE = "grace"              # term lapsed, but the links still work for now
RELEASABLE = "releasable"    # term lapsed and out of grace: free to put back on sale
IDLE_PLAN = "idle_plan"      # the workspace stopped paying; its links do not serve

LABELS = {
    UNOWNED: "Not rented to anyone",
    NO_TERM: "Owned, no end date",
    PAID: "Paid up",
    GRACE: "Lapsed — still in grace",
    RELEASABLE: "Lapsed — ready to release",
    IDLE_PLAN: "Subscription lapsed — idle, ready to release",
}

# The states an admin may release without overriding anything.
IDLE_STATES = (RELEASABLE, IDLE_PLAN)


def domain_grace_days() -> int:
    from .models import ShortDomain
    return ShortDomain.PRIVATE_GRACE_DAYS


def plan_lapsed_at(organization_id):
    """When this workspace's access ran out, or None if it still has access.

    Deliberately asks Subscription.access_state() rather than comparing dates
    here: it is the same answer the rest of the app locks the workspace on, and
    it already knows the difference between a trial, a paid period and a
    cancellation. A workspace with no subscription row at all is treated as
    having access, exactly as billing treats it — a half-created org must not
    have its domain sold out from under it.
    """
    from apps.billing.models import Subscription

    sub = Subscription.objects.filter(organization_id=organization_id).first()
    if sub is None:
        return None
    state = sub.access_state()
    if not state["locked"]:
        return None
    # A cancellation with no period end cannot be dated, so it is not counted as
    # idle. Better to leave a domain reserved than to sell one on a guess.
    return state.get("deadline")


def plan_idle(organization_id, now=None) -> bool:
    """True when the plan has been lapsed for longer than the grace period."""
    lapsed = plan_lapsed_at(organization_id)
    if lapsed is None:
        return False
    now = now or timezone.now()
    return now >= lapsed + timedelta(days=domain_grace_days())


def rental_state(domain, now=None) -> str:
    """Which of the six states above this domain is in.

    The term is checked the same way, in the same order, as the nightly job, so
    the admin column can never say "ready to release" about a domain the job
    would leave alone. The subscription is then consulted for anything the term
    says is still current, because that is the case the term gets wrong.
    """
    now = now or timezone.now()
    if domain.organization_id is None:
        return UNOWNED
    if not domain.private_until:
        return IDLE_PLAN if plan_idle(domain.organization_id, now) else NO_TERM
    if now <= domain.private_until:
        return IDLE_PLAN if plan_idle(domain.organization_id, now) else PAID
    if now < domain.private_grace_ends:
        return GRACE
    return RELEASABLE


def filter_by_state(qs, state, now=None):
    """Narrow `qs` to one rental state.

    The term-only states are settled in SQL. The rest — paid, no-term, idle —
    all hinge on whether the workspace still has access, so they are settled by
    calling rental_state() per row instead. Re-expressing access_state() in SQL
    is exactly how the two would drift apart, and the failure mode of that drift
    is selling a paying customer's domain. An admin list is tens of rows, so the
    extra queries are the cheaper side of that trade.
    """
    now = now or timezone.now()
    grace_cutoff = now - timedelta(days=domain_grace_days())

    if state == UNOWNED:
        return qs.filter(organization__isnull=True)

    owned = qs.filter(organization__isnull=False)
    # `private_until < now` also excludes rows with no term, which is what we
    # want for both of these.
    if state == GRACE:
        return owned.filter(private_until__lt=now, private_until__gt=grace_cutoff)
    if state == RELEASABLE:
        return owned.filter(private_until__lte=grace_cutoff)

    ids = [d.pk for d in owned.select_related("organization")
           if rental_state(d, now) == state]
    return qs.filter(pk__in=ids)


def release_to_stock(domain, *, notify=True, reason=RELEASABLE) -> int:
    """Take a domain back and put it on sale. Returns the links withdrawn.

    The caller decides whether the domain SHOULD be released — the nightly job
    knows it reached the end of grace, and the admin actions check
    rental_state() or say explicitly that they are overriding it. This function
    does not re-check, so an operator handling something unusual is not fought
    by it; what it guarantees is that whoever releases a domain releases it
    completely.
    """
    from .sync import publish_link

    links = list(domain.links.all())
    org = domain.organization        # captured before it is cleared below
    domain.organization = None
    domain.private_until = None
    domain.is_shared = False         # sellable stock, NOT the public pool
    domain.save(update_fields=["organization", "private_until", "is_shared"])
    for link in links:
        publish_link(link)           # withdraws them — no longer entitled
    if notify and org is not None:
        tell_former_owner(org, domain.host, len(links), reason)
    return len(links)


def _body(host: str, link_count: int, reason: str) -> str:
    """What the former owner is told. The reason they lost it decides the words.

    Someone whose rental ran out, someone whose subscription lapsed and someone
    whose domain was withdrawn by hand have three different next steps, and
    being told the wrong one is worse than being told nothing — it sends them to
    renew something that was never the problem.
    """
    tail = ("Your links and their click history are still in your account — point "
            "new ones at a shared domain, or buy another private domain, whenever "
            "you like.")
    if reason == IDLE_PLAN:
        return (f"Your subscription has lapsed, so {host} has been released and is "
                f"available again, and the {link_count} link(s) on it no longer "
                f"resolve.\n\nIf you want it back, start a plan first — a private "
                f"domain runs alongside a live subscription. We cannot hold the "
                f"name, so it may be taken by someone else in the meantime.\n\n{tail}")
    if reason == "withdrawn":
        return (f"{host} has been withdrawn from your workspace, and the "
                f"{link_count} link(s) on it no longer resolve.\n\nIf you think "
                f"this is a mistake, reply to this notice and we will look "
                f"again.\n\n{tail}")
    return (f"The rental on {host} was not renewed, so the domain has been released "
            f"and the {link_count} link(s) on it no longer resolve.\n\n{tail}")


def tell_former_owner(org, host: str, link_count: int, reason: str = RELEASABLE):
    """Email and a dashboard notice. Never raises.

    Both, not either. The email can be filtered, sent to an address nobody
    reads, or land in spam — and if it does, the first thing the owner learns is
    that their links are broken, with nothing saying why. Equally the bell notice
    is only seen by someone who logs in, which a lapsed customer may not do.
    Telling them is also the one step with no effect on data, so a failure to
    deliver must never roll back the release itself.
    """
    from django.conf import settings

    front = getattr(settings, "FRONTEND_URL", "").rstrip("/")
    body = _body(host, link_count, reason)
    subject = (f"{host} has been withdrawn" if reason == "withdrawn"
               else f"{host} has been released")

    try:
        from django.core.mail import send_mail
        email = getattr(getattr(org, "owner", None), "email", "")
        if email:
            send_mail(subject, body + (f"\n\n{front}/dashboard/links" if front else ""),
                      settings.DEFAULT_FROM_EMAIL, [email], fail_silently=True)
    except Exception:  # pragma: no cover - defensive
        pass

    try:
        from apps.notifications.system import notify_workspace
        notify_workspace(org, subject, body)
    except Exception:  # pragma: no cover - defensive
        pass
