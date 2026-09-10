"""Buying exclusive use of a short domain.

Payment and fulfilment are deliberately separate. Someone can pay when we have
no stock in hand; the money is recorded as PAID and the domain is handed over
the moment one exists. That's better than refusing the sale, and far better than
taking payment and silently doing nothing.
"""
import logging
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

# One payment buys this much time on the domain.
PERIOD_DAYS = 30

from .models import PrivateDomainPurchase, ShortDomain

log = logging.getLogger("bachs")


@transaction.atomic
def assign_domain(purchase: PrivateDomainPurchase) -> ShortDomain | None:
    """Hand the buyer a domain from stock, if there is one.

    Locked with skip_locked so two buyers checking out at the same moment can't
    be sold the same domain — the whole point of the purchase is exclusivity.
    """
    if purchase.domain_id:
        return purchase.domain

    domain = (ShortDomain.private_stock()
              .select_for_update(skip_locked=True)
              .order_by("sort", "host")
              .first())
    if not domain:
        return None

    domain.organization_id = purchase.organization_id
    domain.is_shared = False
    domain.is_default = False
    domain.private_until = timezone.now() + timedelta(days=PERIOD_DAYS)
    domain.save(update_fields=["organization", "is_shared", "is_default", "private_until"])

    purchase.domain = domain
    purchase.status = PrivateDomainPurchase.Status.FULFILLED
    purchase.fulfilled_at = timezone.now()
    purchase.save(update_fields=["domain", "status", "fulfilled_at"])
    return domain


def renew(purchase: PrivateDomainPurchase) -> ShortDomain | None:
    """Extend an existing private domain by another period.

    Extends from whichever is later — the current expiry or now — so renewing
    early never loses time, and renewing after a lapse doesn't back-date into
    an already-expired window.
    """
    domain = ShortDomain.private_for(purchase.organization_id).first()
    if not domain:
        return None
    base = max(domain.private_until or timezone.now(), timezone.now())
    domain.private_until = base + timedelta(days=PERIOD_DAYS)
    domain.save(update_fields=["private_until"])
    purchase.domain = domain
    purchase.status = PrivateDomainPurchase.Status.FULFILLED
    purchase.fulfilled_at = timezone.now()
    purchase.save(update_fields=["domain", "status", "fulfilled_at"])
    return domain


def mark_paid(purchase: PrivateDomainPurchase) -> ShortDomain | None:
    """Record the payment, then fulfil if stock allows."""
    if purchase.status == PrivateDomainPurchase.Status.FULFILLED:
        return purchase.domain
    # Already has one? This payment is a renewal, not a second domain.
    if ShortDomain.private_for(purchase.organization_id).exists():
        purchase.status = PrivateDomainPurchase.Status.PAID
        purchase.paid_at = timezone.now()
        purchase.save(update_fields=["status", "paid_at"])
        return renew(purchase)
    if purchase.status != PrivateDomainPurchase.Status.PAID:
        purchase.status = PrivateDomainPurchase.Status.PAID
        purchase.paid_at = timezone.now()
        purchase.save(update_fields=["status", "paid_at"])
    domain = assign_domain(purchase)
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
