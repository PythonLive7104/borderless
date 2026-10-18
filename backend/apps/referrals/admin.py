from django.contrib import admin

from .models import CreditEntry, Referral, Wallet


@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = ("user", "code", "balance_cents", "earned_cents", "created_at")
    search_fields = ("user__email", "code")
    # The balance is a running total of the ledger, maintained transactionally.
    # Typing a new number here would desynchronise it from the entries that
    # explain it — adjust by adding a CreditEntry instead.
    readonly_fields = ("balance_cents", "earned_cents", "code", "user", "created_at")


@admin.register(Referral)
class ReferralAdmin(admin.ModelAdmin):
    list_display = ("referrer", "referred", "code", "reward_count", "first_reward_at", "created_at")
    search_fields = ("referrer__email", "referred__email", "code")
    readonly_fields = ("referrer", "referred", "code", "created_at")


@admin.register(CreditEntry)
class CreditEntryAdmin(admin.ModelAdmin):
    list_display = ("wallet", "amount_cents", "kind", "source_ref", "created_at")
    list_filter = ("kind",)
    search_fields = ("wallet__user__email", "source_ref", "note")
    readonly_fields = ("wallet", "amount_cents", "kind", "referral", "source_ref", "created_at")
