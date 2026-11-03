from django.urls import path

from .views import (MyCreditLedgerView, MyReferralsView,
                    WalletTopupVerifyView, WalletTopupView)

urlpatterns = [
    path("me/", MyReferralsView.as_view(), name="referrals-me"),
    path("ledger/", MyCreditLedgerView.as_view(), name="referrals-ledger"),
    path("topup/", WalletTopupView.as_view(), name="wallet-topup"),
    path("topup/verify/", WalletTopupVerifyView.as_view(), name="wallet-topup-verify"),
]
