"""Buying exclusive use of a short domain.

Payment and fulfilment are deliberately separate. Someone can pay when we have
no stock in hand; the money is recorded as PAID and the domain is handed over
the moment one exists. That's better than refusing the sale, and far better than
taking payment and silently doing nothing.

Everything that can hand over a domain does it under a row lock on the purchase.
Three different callers can fulfil the same purchase at the same moment — the
Bachs webhook, the browser polling PrivateDomainVerifyView every two seconds on
return from checkout, and the reconcile cron — and each arrives holding a copy
of the purchase it read seconds earlier. Guarding on that stale copy is not a
guard at all: two callers both saw status=PENDING, both called assign_domain,
and because the stock query uses skip_locked the second one was handed a
DIFFERENT domain rather than being made to wait. One payment, two domains. The
lock below is what makes the second caller re-read and stop.
"""
import logging
from datetime import timedelta

from django.db import transaction
from django.utils import timezone


def period_days() -> int:
    """How long one payment buys on a private domain.

    Read at call time rather than frozen at import, so the term can be changed
    by configuration and so tests can override it. Yearly since October 2026;
    it was 30 days before that.
    """
    from django.conf import settings
    return int(getattr(settings, "PRIVATE_DOMAIN_PERIOD_DAYS", 365))


from .models import PrivateDomainPurchase, ShortDomain

log = logging.getLogger("bachs")


def _lock(purchase: PrivateDomainPurchase) -> PrivateDomainPurchase | None:
    """Re-read the purchase under a row lock.

    Must be called inside a transaction. Everything after it reads committed
    state rather than whatever the caller happened to load before it blocked.
    """
    return (PrivateDomainPurchase.objects
            .select_for_update()
            .filter(pk=purchase.pk)
            .first())


def _mirror(dst: PrivateDomainPurchase, src: PrivateDomainPurchase) -> None:
    """Copy the fulfilment result onto the caller's instance.

    Callers keep using the object they passed in — `_notify(p, p.domain)` in
    fulfil_backlog, for one — so leaving it holding pre-lock values would just
    move the stale-read problem one level up.
    """
    dst.status = src.status
    dst.domain_id = src.domain_id
    dst.paid_at = src.paid_at
    dst.fulfilled_at = src.fulfilled_at


@transaction.atomic
def assign_domain(purchase: PrivateDomainPurchase) -> ShortDomain | None:
    """Hand the buyer a domain from stock, if there is one.

    The purchase row is locked first, so a second fulfilment of the same
    purchase waits here and then sees the domain already assigned. The stock
    rows are locked with skip_locked so two DIFFERENT buyers checking out at the
    same moment can't be sold the same domain.
    """
    p = _lock(purchase)
    if p is None:
        return None
    # Re-read, not the caller's copy. This is the check that stops one payment
    # becoming two domains.
    if p.domain_id:
        _mirror(purchase, p)
        return p.domain
    if p.status == PrivateDomainPurchase.Status.FULFILLED:
        _mirror(purchase, p)
        return None

    stock = ShortDomain.private_stock().select_for_update(skip_locked=True)
    # Honour the buyer's pick when it is still unsold. Re-querying through
    # private_stock (rather than trusting the FK) is what makes the choice safe:
    # a domain sold between checkout and fulfilment simply isn't in stock, and
    # the row lock means two buyers racing for the same one can't both win.
    domain = None
    if p.requested_domain_id:
        domain = stock.filter(pk=p.requested_domain_id).first()
    if domain is None:
        domain = stock.order_by("sort", "host").first()
    if not domain:
        return None

    domain.organization_id = p.organization_id
    domain.is_shared = False
    domain.is_default = False
    domain.private_until = timezone.now() + timedelta(days=period_days())
    domain.save(update_fields=["organization", "is_shared", "is_default", "private_until"])

    p.domain = domain
    p.status = PrivateDomainPurchase.Status.FULFILLED
    p.fulfilled_at = timezone.now()
    p.save(update_fields=["domain", "status", "fulfilled_at"])
    _mirror(purchase, p)
    return domain


def renew(purchase: PrivateDomainPurchase) -> ShortDomain | None:
    """Extend an existing private domain by another period.

    Extends from whichever is later — the current expiry or now — so renewing
    early never loses time, and renewing after a lapse doesn't back-date into
    an already-expired window.
    """
    with transaction.atomic():
        p = _lock(purchase)
        if p is None:
            return None
        # A renewal that already ran must not run again: the browser polls
        # verify ten times, and each extra pass would silently add 30 free days.
        if p.status == PrivateDomainPurchase.Status.FULFILLED:
            _mirror(purchase, p)
            return p.domain

        # Renew the specific domain this purchase targets; fall back to the first
        # owned one for older purchases that predate targeted renewals.
        domain = p.renew_domain or ShortDomain.private_for(p.organization_id).first()
        if not domain or domain.organization_id != p.organization_id:
            return None
        base = max(domain.private_until or timezone.now(), timezone.now())
        domain.private_until = base + timedelta(days=period_days())
        domain.save(update_fields=["private_until"])
        p.domain = domain
        p.status = PrivateDomainPurchase.Status.FULFILLED
        p.fulfilled_at = timezone.now()
        p.save(update_fields=["domain", "status", "fulfilled_at"])
        _mirror(purchase, p)
        return domain


def mark_paid(purchase: PrivateDomainPurchase) -> ShortDomain | None:
    """Record the payment, then fulfil if stock allows.

    Safe to call repeatedly and concurrently for the same purchase — which it
    is, from the webhook, the verify poll and the reconcile cron at once.
    """
    with transaction.atomic():
        p = _lock(purchase)
        if p is None:
            return None
        if p.status == PrivateDomainPurchase.Status.FULFILLED:
            _mirror(purchase, p)
            return p.domain
        # A purchase that names a domain is a renewal of that one; otherwise it
        # buys a fresh domain from stock — so a workspace can own several.
        if p.renew_domain_id:
            if p.status != PrivateDomainPurchase.Status.PAID:
                p.status = PrivateDomainPurchase.Status.PAID
                p.paid_at = timezone.now()
                p.save(update_fields=["status", "paid_at"])
            _mirror(purchase, p)
            renewed = renew(p)
            _mirror(purchase, p)
            return renewed
        if p.status != PrivateDomainPurchase.Status.PAID:
            p.status = PrivateDomainPurchase.Status.PAID
            p.paid_at = timezone.now()
            p.save(update_fields=["status", "paid_at"])
        _mirror(purchase, p)
        domain = assign_domain(p)
        _mirror(purchase, p)

    if domain:
        _notify(purchase, domain)
    else:
        log.warning("private domain paid but NO STOCK: org=%s purchase=%s",
                    purchase.organization_id, purchase.id)
        _notify_operator_no_stock(purchase)
    return domain


def _notify(purchase, domain):
    from django.conf import settings
    from django.core.mail import send_mail
    email = getattr(getattr(purchase.organization, "owner", None), "email", "")
    if not email:
        return
    send_mail(
        "Your private domain is ready",
        f"{domain.host} is now yours alone.\n\n"
        f"It's available in the Domain picker when you create a redirect, and nobody "
        f"else can publish links on it.\n\n"
        f"{settings.FRONTEND_URL.rstrip('/')}/dashboard/links",
        settings.DEFAULT_FROM_EMAIL, [email], fail_silently=True,
    )


def _notify_operator_no_stock(purchase):
    """Paid, but nothing to give them — this needs a person, promptly."""
    from django.conf import settings
    from django.core.mail import send_mail
    to = getattr(settings, "ABUSE_NOTIFY_EMAIL", "") or getattr(settings, "ABUSE_EMAIL", "")
    if not to:
        return
    send_mail(
        "[action needed] Private domain paid for, no stock",
        f"{purchase.organization.name} paid ${purchase.amount} for a private domain and "
        f"there is none in stock.\n\n"
        f"Register one, point its DNS, issue the certificate, add it to SHORT_DOMAINS, run "
        f"sync_short_domains, then mark it as private stock. It will be assigned "
        f"automatically on the next reconcile, or use the admin action.\n\n"
        f"Purchase #{purchase.id}",
        settings.DEFAULT_FROM_EMAIL, [to], fail_silently=True,
    )


def fulfil_backlog() -> int:
    """Assign domains to anyone who paid before we had stock."""
    done = 0
    for p in PrivateDomainPurchase.objects.filter(status=PrivateDomainPurchase.Status.PAID):
        if assign_domain(p):
            _notify(p, p.domain)
            done += 1
    return done
