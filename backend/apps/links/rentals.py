"""Where a private-domain rental stands, and how it goes back on sale.

A private domain is rented, not sold. When the rental lapses the links on it
keep working through a grace period and the owner is reminded; only after that
does the domain return to stock for somebody else to buy.

Both of those live here rather than inside the nightly command, because there
are two legitimate ways a domain is released — the scheduled job, and an admin
releasing a specific one from the Short domains page — and they have to do the
same thing. Releasing is several steps that are only correct together:

    clear the owner, clear the term, put it back as sellable stock (NOT the
    shared pool), withdraw its links from the engine, and tell the former owner.

Miss the withdrawal and the previous owner's links keep redirecting on a domain
somebody else has since bought. Put it in the shared pool instead of stock and a
domain that was sold as exclusive starts serving everyone's links. Neither is
recoverable by the person it happens to, so there is one implementation.
"""
from datetime import timedelta

from django.utils import timezone

# What state a domain's rental is in. Plain strings so they can be used as admin
# filter values and compared in templates without importing an enum.
UNOWNED = "unowned"          # nobody rents it: shared pool, or stock on the shelf
NO_TERM = "no_term"          # owned, but no end date was ever recorded
PAID = "paid"                # paid up; hands off
GRACE = "grace"              # lapsed, but the links still work for now
RELEASABLE = "releasable"    # lapsed and out of grace: free to put back on sale

LABELS = {
    UNOWNED: "Not rented to anyone",
    NO_TERM: "Owned, no end date",
    PAID: "Paid up",
    GRACE: "Lapsed — still in grace",
    RELEASABLE: "Lapsed — ready to release",
}


def rental_state(domain, now=None) -> str:
    """Which of the five states above this domain is in.

    Deliberately the same comparisons the nightly job makes, in the same order,
    so the admin column can never say "ready to release" about a domain the job
    would leave alone.
    """
    now = now or timezone.now()
    if domain.organization_id is None:
        return UNOWNED
    if not domain.private_until:
        return NO_TERM
    if now <= domain.private_until:
        return PAID
    if now < domain.private_grace_ends:
        return GRACE
    return RELEASABLE


def releasable_filter(qs, state, now=None):
    """Narrow `qs` to one rental state, in SQL.

    rental_state() answers for one row in Python; this answers for a queryset,
    so the admin can filter a list of hundreds without loading them. The two are
    kept equivalent by test_rentals.py, which checks them against each other
    rather than trusting that they were written to match.
    """
    now = now or timezone.now()
    grace_cutoff = now - timedelta(days=domain_grace_days())

    if state == UNOWNED:
        return qs.filter(organization__isnull=True)
    owned = qs.filter(organization__isnull=False)
    if state == NO_TERM:
        return owned.filter(private_until__isnull=True)
    dated = owned.filter(private_until__isnull=False)
    if state == PAID:
        return dated.filter(private_until__gte=now)
    if state == GRACE:
        # Lapsed, but the grace period has not run out yet.
        return dated.filter(private_until__lt=now, private_until__gt=grace_cutoff)
    if state == RELEASABLE:
        return dated.filter(private_until__lte=grace_cutoff)
    return qs


def domain_grace_days() -> int:
    from .models import ShortDomain
    return ShortDomain.PRIVATE_GRACE_DAYS


def release_to_stock(domain, *, notify=True) -> int:
    """Take a lapsed domain back and put it on sale. Returns links withdrawn.

    The caller decides whether the domain SHOULD be released — the nightly job
    knows it reached the end of grace, and the admin action checks
    rental_state() first. This function does not re-check, so that an operator
    dealing with something unusual is not fought by it; what it guarantees is
    that whoever releases a domain releases it completely.
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
        tell_former_owner(org, domain.host, len(links))
    return len(links)


def tell_former_owner(org, host: str, link_count: int):
    """Email and a dashboard notice. Never raises.

    Both, not either. The email can be filtered, sent to an address nobody
    reads, or land in spam — and if it does, the first thing the owner learns is
    that their links are broken, with nothing saying why. Equally the bell
    notice is only seen by someone who logs in, which a lapsed customer may not
    do. Telling them is also the one step here with no effect on data, so a
    failure to deliver must never roll back the release itself.
    """
    from django.conf import settings

    front = getattr(settings, "FRONTEND_URL", "").rstrip("/")
    body = (
        f"The rental on {host} was not renewed, so the domain has been released "
        f"and the {link_count} link(s) on it no longer resolve.\n\n"
        f"Your links and their click history are still in your account — point "
        f"new ones at a shared domain, or buy another private domain, whenever "
        f"you like."
    )

    try:
        from django.core.mail import send_mail
        email = getattr(getattr(org, "owner", None), "email", "")
        if email:
            send_mail(f"{host} has been released",
                      body + (f"\n\n{front}/dashboard/links" if front else ""),
                      settings.DEFAULT_FROM_EMAIL, [email], fail_silently=True)
    except Exception:  # pragma: no cover - defensive
        pass

    try:
        from apps.notifications.system import notify_workspace
        notify_workspace(org, f"{host} has been released", body)
    except Exception:  # pragma: no cover - defensive
        pass
