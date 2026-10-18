from django.urls import path

from .views import MyCreditLedgerView, MyReferralsView

urlpatterns = [
    path("me/", MyReferralsView.as_view(), name="referrals-me"),
    path("ledger/", MyCreditLedgerView.as_view(), name="referrals-ledger"),
]
