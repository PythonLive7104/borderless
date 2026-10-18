"""Referral dashboard endpoints.

Redemption lives in apps.billing.views alongside the rest of checkout, because
spending credit has to activate a subscription and that machinery belongs there.
This module only reads.
"""
from rest_framework import permissions, views
from rest_framework.response import Response

from .models import CreditEntry, wallet_for
from .service import summary


class MyReferralsView(views.APIView):
    """GET — code, balance, and who they've referred."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(summary(request.user))


class MyCreditLedgerView(views.APIView):
    """GET — the movements behind the balance.

    Shown because a balance nobody can account for is a support ticket. Every
    earn names the referral it came from; every spend names the plan.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        wallet = wallet_for(request.user)
        entries = (CreditEntry.objects
                   .filter(wallet=wallet)
                   .select_related("referral__referred")
                   .order_by("-created_at")[:200])
        return Response([{
            "amount_cents": e.amount_cents,
            "kind": e.kind,
            "note": e.note,
            "created_at": e.created_at,
        } for e in entries])
