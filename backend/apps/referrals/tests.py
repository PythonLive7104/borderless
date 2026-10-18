from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import TestCase

from apps.billing.models import Plan
from apps.referrals.models import REWARD_CENTS, CreditEntry, Referral, Wallet, wallet_for
from apps.referrals.service import (RedeemError, attach_referral, award_for_payment,
                                    can_cover, redeem, summary)

User = get_user_model()


def make_user(email):
    return User.objects.create_user(username=email, email=email, password="testpass123")


class AttachReferralTest(TestCase):
    def setUp(self):
        self.alice = make_user("alice@example.com")
        self.bob = make_user("bob@example.com")
        self.code = wallet_for(self.alice).code

    def test_attaches_a_valid_code(self):
        r = attach_referral(self.bob, self.code)
        self.assertIsNotNone(r)
        self.assertEqual(r.referrer, self.alice)

    def test_code_is_case_insensitive_and_trimmed(self):
        self.assertIsNotNone(attach_referral(self.bob, f"  {self.code.lower()} "))

    def test_unknown_code_is_ignored_not_an_error(self):
        """A stale or mistyped referral link must never block a signup."""
        self.assertIsNone(attach_referral(self.bob, "NOTACODE"))
        self.assertIsNone(attach_referral(self.bob, ""))

    def test_cannot_refer_yourself(self):
        self.assertIsNone(attach_referral(self.alice, self.code))

    def test_self_referral_is_refused_by_the_database_too(self):
        """The service checks it; this proves the constraint behind it."""
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Referral.objects.create(referrer=self.alice, referred=self.alice, code=self.code)

    def test_a_person_can_only_be_referred_once(self):
        carol = make_user("carol@example.com")
        attach_referral(self.bob, self.code)
        self.assertIsNone(attach_referral(self.bob, wallet_for(carol).code))
        self.assertEqual(Referral.objects.filter(referred=self.bob).count(), 1)


class AwardTest(TestCase):
    def setUp(self):
        self.alice = make_user("alice@example.com")
        self.bob = make_user("bob@example.com")
        attach_referral(self.bob, wallet_for(self.alice).code)

    def test_payment_credits_the_referrer(self):
        entry = award_for_payment(self.bob, "bachs:sess_1")
        self.assertIsNotNone(entry)
        w = wallet_for(self.alice)
        self.assertEqual(w.balance_cents, REWARD_CENTS)
        self.assertEqual(w.earned_cents, REWARD_CENTS)

    def test_every_payment_earns_again(self):
        award_for_payment(self.bob, "bachs:sess_1")
        award_for_payment(self.bob, "bachs:sess_2")
        self.assertEqual(wallet_for(self.alice).balance_cents, 2 * REWARD_CENTS)
        self.assertEqual(Referral.objects.get(referred=self.bob).reward_count, 2)

    def test_the_same_payment_never_pays_twice(self):
        """The webhook and the settle-on-return poll both activate a paid
        subscription by design. Exactly one of them may pay out."""
        self.assertIsNotNone(award_for_payment(self.bob, "bachs:sess_1"))
        self.assertIsNone(award_for_payment(self.bob, "bachs:sess_1"))
        self.assertEqual(wallet_for(self.alice).balance_cents, REWARD_CENTS)

    def test_a_payment_by_an_unreferred_user_pays_nobody(self):
        dave = make_user("dave@example.com")
        self.assertIsNone(award_for_payment(dave, "bachs:sess_9"))
        self.assertEqual(CreditEntry.objects.count(), 0)

    def test_first_reward_at_is_set_once(self):
        award_for_payment(self.bob, "bachs:sess_1")
        first = Referral.objects.get(referred=self.bob).first_reward_at
        award_for_payment(self.bob, "bachs:sess_2")
        self.assertEqual(Referral.objects.get(referred=self.bob).first_reward_at, first)


class RedeemTest(TestCase):
    def setUp(self):
        self.alice = make_user("alice@example.com")
        self.plan = Plan.objects.get(slug="basic")   # $25 weekly, $69 monthly

    def _give(self, cents):
        w = wallet_for(self.alice)
        CreditEntry.objects.create(wallet=w, amount_cents=cents,
                                   kind=CreditEntry.Kind.ADJUSTMENT)
        w.balance_cents += cents
        w.save(update_fields=["balance_cents"])

    def test_cannot_redeem_without_enough_credit(self):
        self._give(2400)  # $24 against a $25 weekly plan
        self.assertFalse(can_cover(self.alice, self.plan, "weekly"))
        with self.assertRaises(RedeemError):
            redeem(self.alice, self.plan, "weekly", organization_id=1)

    def test_redeeming_spends_exactly_the_price(self):
        self._give(3000)  # $30
        redeem(self.alice, self.plan, "weekly", organization_id=1)
        self.assertEqual(wallet_for(self.alice).balance_cents, 3000 - 2500)

    def test_redeeming_does_not_reduce_lifetime_earned(self):
        """Spending credit must not make someone's referral record shrink."""
        bob = make_user("bob@example.com")
        attach_referral(bob, wallet_for(self.alice).code)
        for i in range(13):  # 13 x $2 = $26, enough for a $25 week
            award_for_payment(bob, f"bachs:s{i}")
        earned_before = wallet_for(self.alice).earned_cents
        redeem(self.alice, self.plan, "weekly", organization_id=1)
        w = wallet_for(self.alice)
        self.assertEqual(w.earned_cents, earned_before)
        self.assertEqual(w.balance_cents, 2600 - 2500)

    def test_balance_always_equals_the_ledger(self):
        """The running total is a convenience; the entries are the record. If
        they ever disagree, the balance is wrong and someone is owed money."""
        bob = make_user("bob@example.com")
        attach_referral(bob, wallet_for(self.alice).code)
        for i in range(13):
            award_for_payment(bob, f"bachs:s{i}")
        redeem(self.alice, self.plan, "weekly", organization_id=1)
        w = wallet_for(self.alice)
        ledger = sum(e.amount_cents for e in CreditEntry.objects.filter(wallet=w))
        self.assertEqual(w.balance_cents, ledger)

    def test_yearly_costs_more_credit_than_weekly(self):
        self._give(100_000)
        redeem(self.alice, self.plan, "yearly", organization_id=1)
        self.assertEqual(wallet_for(self.alice).balance_cents,
                         100_000 - self.plan.price_yearly * 100)


class SummaryTest(TestCase):
    def test_masks_the_referred_email(self):
        """The referrer is owed credit, not the personal details of someone who
        clicked their link."""
        alice = make_user("alice@example.com")
        bob = make_user("bobbytables@example.com")
        attach_referral(bob, wallet_for(alice).code)
        data = summary(alice)
        shown = data["referrals"][0]["masked_email"]
        self.assertNotIn("bobbytables", shown)
        self.assertIn("@example.com", shown)
        self.assertEqual(data["referred_count"], 1)
        self.assertEqual(data["paying_count"], 0)

    def test_paying_count_follows_payment(self):
        alice = make_user("alice@example.com")
        bob = make_user("bob@example.com")
        attach_referral(bob, wallet_for(alice).code)
        award_for_payment(bob, "bachs:s1")
        self.assertEqual(summary(alice)["paying_count"], 1)


class WalletTest(TestCase):
    def test_wallet_is_created_once_per_user(self):
        alice = make_user("alice@example.com")
        self.assertEqual(wallet_for(alice).pk, wallet_for(alice).pk)
        self.assertEqual(Wallet.objects.filter(user=alice).count(), 1)

    def test_codes_are_unique(self):
        codes = {wallet_for(make_user(f"u{i}@example.com")).code for i in range(25)}
        self.assertEqual(len(codes), 25)
