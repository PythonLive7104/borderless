from django.contrib import admin
from .models import BtcPayment, Plan, Subscription
from . import btcpay


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ("name", "price", "monthly_events", "retention_days", "team_members")


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ("organization", "plan", "status", "period_start")
    list_filter = ("status",)


@admin.register(BtcPayment)
class BtcPaymentAdmin(admin.ModelAdmin):
    """Direct Bitcoin payments awaiting confirmation.

    The default view is the pending queue, newest first — the list to work.
    'Confirm' is the only step that activates a plan, and it runs the same
    activation as every other paid path, so a BTC-paid workspace is identical
    afterwards. Both actions are idempotent: re-running on an already-decided
    payment does nothing, so a double-click can't double-activate.
    """
    list_display = ("created_at", "organization", "plan", "interval", "amount_usd",
                    "status", "tx_reference", "reviewed_by", "reviewed_at")
    list_filter = ("status", "interval")
    search_fields = ("organization__name", "organization__slug", "tx_reference", "address")
    readonly_fields = ("organization", "plan", "interval", "amount_usd", "address",
                       "created_by", "created_at", "reviewed_by", "reviewed_at")
    # status leads the filters so the pending queue is one click away.
    actions = ("confirm_payments", "reject_payments")

    @admin.action(description="Confirm payment — activates the plan")
    def confirm_payments(self, request, queryset):
        done = skipped = 0
        for p in queryset:
            if btcpay.confirm(p, admin_user=request.user):
                done += 1
            else:
                skipped += 1
        msg = f"{done} payment(s) confirmed and the plan activated."
        if skipped:
            msg += f" {skipped} skipped — not pending (already decided)."
        self.message_user(request, msg)

    @admin.action(description="Reject payment — no plan change")
    def reject_payments(self, request, queryset):
        n = sum(1 for p in queryset if btcpay.reject(p, admin_user=request.user,
                                                      reason="Rejected by admin."))
        self.message_user(request, f"{n} payment(s) rejected.")
