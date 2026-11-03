"""Operations that move credit. Everything here is transactional.

The views are deliberately thin over this module so that the rules — who may
earn, when, how much, and whether a balance can cover a plan — live in one place
and are testable without HTTP.
"""
import logging

from django.db import IntegrityError, transaction
from django.utils import timezone

from .models import REWARD_CENTS, CreditEntry, Referral, Wallet, WalletTopup, wallet_for

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


# --- money primitives -------------------------------------------------------
#
# credit() and debit() move a balance under a row lock, and every NEW path
# — top-ups, buying a domain, refunds — goes through them, so the locking
# discipline lives in one place rather than being re-implemented at each call
# site. In money code, duplicated locking is how balances drift.
#
# award_for_payment() and redeem() predate these and still do their own
# locking. They are correct and covered by tests, so they are left alone
# rather than refactored mid-feature; award_for_payment also maintains
# earned_cents and the Referral row, which is referral-specific bookkeeping
# these primitives deliberately know nothing about. Worth folding in later,
# with the existing tests as the safety net — not while adding behaviour.


@transaction.atomic
def credit(user, amount_cents: int, *, kind: str, source_ref: str | None = None,
           note: str = "") -> CreditEntry | None:
    """Add to a wallet. Returns None if `source_ref` was already credited.

    `source_ref` is the idempotency key — a Bachs session id, usually. It is
    unique on CreditEntry, so a payment that reaches us twice (the webhook and
    the settle-on-return poll both fire, by design) credits once.
    """
    if amount_cents <= 0:
        raise ValueError("credit amount must be positive")

    wallet = Wallet.objects.select_for_update().get(pk=wallet_for(user).pk)
    try:
        entry = CreditEntry.objects.create(
            wallet=wallet, amount_cents=amount_cents, kind=kind,
            source_ref=source_ref or None, note=note[:200])
    except IntegrityError:
        log.info("wallet: duplicate credit suppressed for %r", source_ref)
        return None

    wallet.balance_cents += amount_cents
    wallet.save(update_fields=["balance_cents"])
    log.info("wallet: user=%s credited %d cents (%s)", user.id, amount_cents, kind)
    return entry


@transaction.atomic
def debit(user, amount_cents: int, *, kind: str, note: str = "") -> CreditEntry:
    """Take from a wallet, or raise RedeemError if the balance will not cover it.

    Locks the row and re-reads the balance INSIDE the lock, so two tabs
    spending at the same moment cannot both succeed. The caller does whatever
    the money was for; this only moves it.
    """
    if amount_cents <= 0:
        raise ValueError("debit amount must be positive")

    wallet = Wallet.objects.select_for_update().get(pk=wallet_for(user).pk)
    if wallet.balance_cents < amount_cents:
        raise RedeemError(
            f"That costs ${amount_cents / 100:.2f} and your wallet holds "
            f"${wallet.balance_cents / 100:.2f}. Top up and try again.")

    entry = CreditEntry.objects.create(
        wallet=wallet, amount_cents=-amount_cents, kind=kind, note=note[:200])
    wallet.balance_cents -= amount_cents
    wallet.save(update_fields=["balance_cents"])
    log.info("wallet: user=%s debited %d cents (%s)", user.id, amount_cents, kind)
    return entry


def refund(user, amount_cents: int, *, note: str = "") -> CreditEntry:
    """Put money back — a domain we could not source, an order we cancelled.

    Deliberately NOT idempotent: a refund has no external event to deduplicate
    against, and silently swallowing a second one would leave a customer short.
    The caller decides whether a refund is owed.
    """
    return credit(user, amount_cents, kind=CreditEntry.Kind.REFUND, note=note)


def balance_cents(user) -> int:
    return wallet_for(user).balance_cents


def complete_topup(topup: WalletTopup, session_data) -> CreditEntry | None:
    """Credit a confirmed top-up with the amount Bachs says was actually paid.

    Returns the entry, or None when nothing was credited — already done, or the
    amount could not be read. The two are distinguishable in the log, and the
    second raises an operator alert, because money taken with no balance added
    is the one outcome here that must never pass quietly.

    Idempotent through CreditEntry.source_ref: the webhook and the browser's
    settle-on-return poll both call this, by design, since either may be the
    only one that arrives.
    """
    from apps.billing import bachs

    if topup.status == WalletTopup.Status.CREDITED:
        return None

    cents = bachs.amount_cents(session_data)
    if not cents or cents <= 0:
        # Deliberately NOT credited. Guessing an amount here either shortchanges
        # the customer or invents money; both are worse than a loud failure that
        # a person resolves from the Bachs record.
        log.error("wallet: PAID TOPUP WITH UNREADABLE AMOUNT — user=%s topup=%s session=%r. "
                  "Credit it by hand from the Bachs dashboard.",
                  topup.user_id, topup.id, topup.bachs_session_id)
        return None

    ref = f"bachs:topup:{topup.bachs_session_id or topup.id}"
    entry = credit(topup.user, cents, kind=CreditEntry.Kind.TOPUP, source_ref=ref,
                   note=f"Wallet top-up (${cents / 100:.2f})")
    if entry is None:
        # Another path got there first. Still settle the row so the dashboard
        # stops showing it as pending.
        WalletTopup.objects.filter(pk=topup.pk, status=WalletTopup.Status.PENDING).update(
            status=WalletTopup.Status.CREDITED, amount_cents=cents, credited_at=timezone.now())
        return None

    topup.amount_cents = cents
    topup.status = WalletTopup.Status.CREDITED
    topup.credited_at = timezone.now()
    topup.save(update_fields=["amount_cents", "status", "credited_at"])
    log.info("wallet: topup credited user=%s %d cents", topup.user_id, cents)
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
