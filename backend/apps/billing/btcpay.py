"""Direct Bitcoin payment with manual admin confirmation.

The flow, and why each step is where it is:

  * **Request** (create_request) records what the customer intends to buy and
    shows them the address and the USD amount. It changes nothing about their
    plan. A request is a claim, not a payment.

  * **Confirm** (confirm) is the only step that grants access, and only an admin
    runs it, after checking the coins arrived. It calls the SAME activation the
    card and crypto paths use, so a BTC-paid plan behaves identically afterwards
    — including the referral payout, which is keyed on this payment's id so it
    can never be paid twice.

  * **Reject** (reject) closes a request that didn't pay, with a reason.

Everything is gated on BTC_PAYMENT_ADDRESS being set: with no wallet configured
the feature does not exist. Nothing here ever moves coins or talks to a chain —
confirmation is a human asserting receipt, which is the whole point of a manual
settlement path.
"""
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import BtcPayment, INTERVAL_DAYS, Subscription, WEEKLY


def is_enabled() -> bool:
    return bool(address())


def address() -> str:
    return (getattr(settings, "BTC_PAYMENT_ADDRESS", "") or "").strip()


def create_request(organization, plan, interval, user, amount_usd) -> BtcPayment:
    """Record a pending BTC payment. Does not touch the subscription."""
    interval = (interval or WEEKLY).lower()
    if interval not in INTERVAL_DAYS:
        interval = WEEKLY
    return BtcPayment.objects.create(
        organization=organization,
        plan=plan,
        interval=interval,
        amount_usd=Decimal(str(amount_usd)),
        address=address(),
        created_by=user,
        status=BtcPayment.Status.PENDING,
    )


@transaction.atomic
def confirm(payment: BtcPayment, admin_user=None) -> bool:
    """Confirm receipt and activate the plan. Returns True if it activated now.

    Idempotent by construction: the row is locked and re-read, so a double-click
    or a retried admin action confirms once. Anything not PENDING is a no-op,
    which is what stops a second confirm re-activating or paying the referral
    again.
    """
    payment = BtcPayment.objects.select_for_update().get(pk=payment.pk)
    if payment.status != BtcPayment.Status.PENDING:
        return False

    sub = Subscription.objects.filter(organization_id=payment.organization_id).first()
    if sub is None:
        # Every workspace has a subscription row from signup; if somehow not,
        # refuse rather than invent one, so a billing anomaly is visible.
        payment.status = BtcPayment.Status.REJECTED
        payment.admin_note = "No subscription row for this workspace."
        payment.reviewed_by = admin_user
        payment.reviewed_at = timezone.now()
        payment.save(update_fields=["status", "admin_note", "reviewed_by", "reviewed_at"])
        return False

    # The one activation path, shared with card/crypto. paid_ref marks that real
    # money changed hands, so the referral payout fires — keyed on this payment's
    # id, so confirming the same payment twice can never pay a referrer twice.
    from apps.billing.views import _activate
    _activate(sub, payment.plan, payment.interval, paid_ref=f"btc:{payment.id}")

    payment.status = BtcPayment.Status.CONFIRMED
    payment.reviewed_by = admin_user
    payment.reviewed_at = timezone.now()
    payment.save(update_fields=["status", "reviewed_by", "reviewed_at"])
    return True


@transaction.atomic
def reject(payment: BtcPayment, admin_user=None, reason: str = "") -> bool:
    """Close a pending request without activating. Returns True if it changed."""
    payment = BtcPayment.objects.select_for_update().get(pk=payment.pk)
    if payment.status != BtcPayment.Status.PENDING:
        return False
    payment.status = BtcPayment.Status.REJECTED
    payment.admin_note = (reason or payment.admin_note)[:300]
    payment.reviewed_by = admin_user
    payment.reviewed_at = timezone.now()
    payment.save(update_fields=["status", "admin_note", "reviewed_by", "reviewed_at"])
    return True
