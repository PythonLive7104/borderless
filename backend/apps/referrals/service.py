"""Operations that move credit. Everything here is transactional.

The views are deliberately thin over this module so that the rules — who may
earn, when, how much, and whether a balance can cover a plan — live in one place
and are testable without HTTP.
"""
import logging

from django.db import IntegrityError, transaction
from django.utils import timezone

from .models import REWARD_CENTS, CreditEntry, Referral, Wallet, wallet_for

log = logging.getLogger("referrals")


class RedeemError(Exception):
    """Redemption refused — the message is safe to show the user."""


def attach_referral(referred_user, code: str) -> Referral | None:
    """Record that `referred_user` signed up through `code`.

    Returns the Referral, or None when the code is unusable. Never raises on a
    bad code: a mistyped or stale referral link must not be able to block
    somebody from creating an account.
    """
    code = (code or "").strip().upper()
    if not code:
        return None

    wallet = Wallet.objects.filter(code=code).select_related("user").first()
    if not wallet:
        log.info("referral: unknown code %r at signup", code)
        return None

    # You cannot refer yourself. Same account is the obvious case; the model has
    # a check constraint as a backstop.
    if wallet.user_id == referred_user.id:
        return None

    # One referrer per person, ever. If they already have one, the first stands.
    if Referral.objects.filter(referred=referred_user).exists():
        return None

    try:
        return Referral.objects.create(
            referrer=wallet.user, referred=referred_user, code=code)
    except IntegrityError:
        return None


@transaction.atomic
def award_for_payment(payer, source_ref: str, note: str = "") -> CreditEntry | None:
    """Credit whoever referred `payer`, once per payment.

    `source_ref` identifies the payment (the Bachs session id). It is unique on
    CreditEntry, so the two paths that can activate a subscription — the webhook
    and our settle-on-return poll — cannot both pay out. Whichever arrives
    second hits the constraint and returns None.

    Returns the entry, or None when there is nothing to pay (no referrer, or
    already paid for this payment).
    """
    referral = (Referral.objects
                .select_related("referrer")
                .filter(referred=payer)
                .first())
    if not referral:
        return None

    wallet = wallet_for(referral.referrer)
    # Lock before touching the running total.
    wallet = Wallet.objects.select_for_update().get(pk=wallet.pk)

    try:
        entry = CreditEntry.objects.create(
            wallet=wallet,
            amount_cents=REWARD_CENTS,
            kind=CreditEntry.Kind.EARNED,
            referral=referral,
            source_ref=source_ref or None,
            note=note[:200],
        )
    except IntegrityError:
        # Already credited for this payment — the other activation path won.
        log.info("referral: duplicate payout suppressed for %r", source_ref)
        return None

    wallet.balance_cents += REWARD_CENTS
    wallet.earned_cents += REWARD_CENTS
    wallet.save(update_fields=["balance_cents", "earned_cents"])

    referral.reward_count += 1
    if referral.first_reward_at is None:
        referral.first_reward_at = timezone.now()
    referral.save(update_fields=["reward_count", "first_reward_at"])

    log.info("referral: credited user=%s %d cents for payment by user=%s",
             referral.referrer_id, REWARD_CENTS, payer.id)
    return entry


def price_cents(plan, interval: str) -> int:
    return int(plan.price_for(interval)) * 100


def can_cover(user, plan, interval: str) -> bool:
    """Whether this user's balance covers one period of plan+interval."""
    wallet = wallet_for(user)
    cost = price_cents(plan, interval)
    return cost > 0 and wallet.balance_cents >= cost


@transaction.atomic
def redeem(user, plan, interval: str, organization_id) -> CreditEntry:
    """Spend credit on one period of plan+interval.

    Locks the wallet, re-reads the balance inside the lock, and refuses if it no
    longer covers the price — so two tabs clicking redeem at the same moment
    cannot both succeed. The caller activates the subscription; this function
    only moves the money, and raises RedeemError if it cannot.
    """
    cost = price_cents(plan, interval)
    if cost <= 0:
        raise RedeemError("That plan isn't available on that billing period.")

    wallet = wallet_for(user)
    wallet = Wallet.objects.select_for_update().get(pk=wallet.pk)

    if wallet.balance_cents < cost:
        raise RedeemError(
            f"You have ${wallet.balance_cents / 100:.2f} in credit, "
            f"and {plan.name} on {interval} billing costs ${cost / 100:.2f}.")

    entry = CreditEntry.objects.create(
        wallet=wallet,
        amount_cents=-cost,
        kind=CreditEntry.Kind.REDEEMED,
        note=f"{plan.name} ({interval}) for workspace {organization_id}"[:200],
    )
    wallet.balance_cents -= cost
    wallet.save(update_fields=["balance_cents"])

    log.info("referral: user=%s redeemed %d cents for %s (%s)",
             user.id, cost, plan.slug, interval)
    return entry


def summary(user) -> dict:
    """Everything the dashboard referral page needs, in one query set."""
    wallet = wallet_for(user)
    referrals = (Referral.objects
                 .filter(referrer=user)
                 .select_related("referred")
                 .order_by("-created_at")[:100])
    return {
        "code": wallet.code,
        "balance_cents": wallet.balance_cents,
        "earned_cents": wallet.earned_cents,
        "reward_cents": REWARD_CENTS,
        "referred_count": Referral.objects.filter(referrer=user).count(),
        "paying_count": Referral.objects.filter(
            referrer=user, first_reward_at__isnull=False).count(),
        "referrals": [{
            # Deliberately not the full email: the referrer is owed credit, not
            # the personal details of someone who merely clicked their link.
            "masked_email": _mask(r.referred.email),
            "joined_at": r.created_at,
            "has_paid": r.first_reward_at is not None,
            "rewards": r.reward_count,
        } for r in referrals],
    }


def _mask(email: str) -> str:
    name, _, domain = (email or "").partition("@")
    if not domain:
        return "—"
    head = name[:2] if len(name) > 2 else name[:1]
    return f"{head}{'*' * max(3, len(name) - len(head))}@{domain}"
