"""Referral rewards: refer a friend, earn credit when they pay.

The shape of the thing:

  * Every user has a Wallet. It carries their referral code, their credit
    balance, and — importantly — it is the row we lock when money moves.
  * A Referral records that one user signed up through another's code. It is
    one-per-referred-user and permanent: you can be referred once, ever.
  * A CreditEntry is a single movement, positive (earned) or negative (spent).
    The ledger is the record; Wallet.balance_cents is a running total kept in
    the same transaction so a balance check can take a row lock instead of
    summing the ledger under concurrency.

Two things this design is deliberately strict about, because the failure modes
cost real money:

  1. **Earning is idempotent.** A payment can reach us twice — the Bachs webhook
     and our own settle-on-return poll both activate a subscription, by design,
     because either one can be the only one that arrives. `source_ref` is unique,
     so the second attempt to pay out for the same payment hits a database
     constraint rather than crediting twice.
  2. **Spending is atomic.** Redemption locks the wallet row, re-reads the
     balance inside the lock, and refuses if it no longer covers the price. Two
     tabs clicking "redeem" at once cannot both succeed.

Amounts are in CENTS throughout. Plan prices are whole dollars in this codebase,
but a reward is $2 and part-dollar adjustments are the kind of thing that turns
up later; integer cents avoids ever having a float near money.
"""
import secrets
import string

from django.conf import settings
from django.db import models, transaction

#: What a referrer earns each time someone they referred pays. $2.00.
REWARD_CENTS = 200

# No vowels, no 0/O/1/I/L — these get read aloud and typed by hand.
_ALPHABET = "23456789BCDFGHJKMNPQRSTVWXYZ"
CODE_LEN = 8


def _new_code() -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(CODE_LEN))


class Wallet(models.Model):
    """One per user: their referral code, their balance, and the lock target."""
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                related_name="wallet")
    code = models.CharField(max_length=16, unique=True, db_index=True, default=_new_code)
    # Running total of the ledger, maintained in the same transaction as the
    # entries. Never write this without a select_for_update on the row.
    balance_cents = models.IntegerField(default=0)
    # Lifetime earned, for display. Separate from balance so spending credit
    # doesn't make someone's referral record appear to shrink.
    earned_cents = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user_id}: {self.code} (${self.balance_cents / 100:.2f})"

    @property
    def balance_usd(self) -> float:
        return self.balance_cents / 100


class Referral(models.Model):
    """`referred` signed up through `referrer`'s code."""
    referrer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                 related_name="referrals_made")
    # OneToOne: a person is referred once and only once. Re-signing up under a
    # different code must not create a second earning relationship.
    referred = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                    related_name="referred_by")
    code = models.CharField(max_length=16)
    # Set the first time this referral pays out, so the UI can show "converted"
    # without scanning the ledger.
    first_reward_at = models.DateTimeField(null=True, blank=True)
    reward_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            # Self-referral is the first thing anyone tries. The service layer
            # checks it too; this is the backstop that survives a careless
            # caller or a shell session.
            models.CheckConstraint(
                check=~models.Q(referrer=models.F("referred")),
                name="referral_not_self",
            ),
        ]

    def __str__(self):
        return f"{self.referrer_id} -> {self.referred_id}"


class CreditEntry(models.Model):
    """One movement on a wallet. Positive earns, negative spends."""

    class Kind(models.TextChoices):
        EARNED = "earned", "Earned from a referral"
        REDEEMED = "redeemed", "Redeemed against a plan"
        ADJUSTMENT = "adjustment", "Manual adjustment"

    wallet = models.ForeignKey(Wallet, on_delete=models.CASCADE, related_name="entries")
    amount_cents = models.IntegerField(help_text="Positive = earned, negative = spent.")
    kind = models.CharField(max_length=12, choices=Kind.choices)
    referral = models.ForeignKey(Referral, on_delete=models.SET_NULL, null=True, blank=True,
                                 related_name="entries")
    # Idempotency key for earnings: "bachs:<session_id>" or similar. Unique, so
    # the webhook and the settle-on-return poll cannot both pay out for one
    # payment. Null for redemptions and manual adjustments, which have no
    # external event to deduplicate against.
    source_ref = models.CharField(max_length=160, null=True, blank=True, unique=True)
    note = models.CharField(max_length=200, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [models.Index(fields=["wallet", "-created_at"])]

    def __str__(self):
        return f"{self.wallet_id} {self.amount_cents:+d} ({self.kind})"


def wallet_for(user) -> Wallet:
    """The user's wallet, created on first use.

    Lazy rather than created at signup: most users never look at this, and a
    signal on user creation is one more thing that can fail during registration.
    """
    wallet, _ = Wallet.objects.get_or_create(user=user)
    return wallet


def _unique_wallet(user) -> Wallet:
    """get_or_create, retrying once on a code collision.

    An 8-character code from a 28-symbol alphabet collides at a rate nobody will
    ever observe, but `code` is unique and a collision would otherwise surface
    as a failed signup rather than a retry.
    """
    for _ in range(3):
        try:
            with transaction.atomic():
                return wallet_for(user)
        except Exception:
            continue
    return wallet_for(user)
