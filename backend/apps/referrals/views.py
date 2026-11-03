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


class WalletTopupView(views.APIView):
    """POST — start a wallet top-up. Returns a Bachs checkout URL.

    The amount is chosen on Bachs's own checkout page, because the product is
    "pay what you want". We therefore do NOT record an amount here: whatever we
    wrote would be a guess, and the only number that may ever reach a balance
    is the one Bachs confirms was paid.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from django.conf import settings
        from apps.billing import bachs
        from .models import WalletTopup

        product_id = getattr(settings, "BACHS_PRODUCT_WALLET_TOPUP", "")
        if not bachs.is_enabled() or not product_id:
            import logging
            logging.getLogger("referrals").error(
                "wallet topup blocked: bachs_enabled=%s product_id=%r",
                bachs.is_enabled(), product_id)
            return Response({"detail": "Wallet top-ups aren't available just yet."}, status=503)

        org_id = request.data.get("organization") or None
        topup = WalletTopup.objects.create(user=request.user, organization_id=org_id)

        front = settings.FRONTEND_URL.rstrip("/")
        data, err = bachs.create_checkout_session(
            product_id=product_id,
            email=request.user.email,
            return_url=f"{front}/dashboard/referrals?topup=success",
            cancel_url=f"{front}/dashboard/referrals?topup=cancelled",
            metadata={"kind": "wallet_topup", "topup_id": str(topup.id),
                      "user_id": str(request.user.id)},
        )
        if err:
            return Response({"detail": err}, status=502)

        from apps.billing.views import _find_session_id
        topup.bachs_session_id = _find_session_id(data)
        topup.save(update_fields=["bachs_session_id"])

        url = (data.get("checkout_url") or data.get("url") or data.get("redirect_url")
               or (data.get("data") or {}).get("checkout_url"))
        if not url:
            return Response({"detail": "Bachs did not return a checkout URL."}, status=502)
        return Response({"checkout_url": url})


class WalletTopupVerifyView(views.APIView):
    """POST — settle a top-up on return from checkout, by asking Bachs directly.

    The webhook cannot be the only path. A delivery that never arrives, or one
    rejected on signature, would mean money taken and no balance — so the
    browser polls this when it comes back, exactly as plan checkout does.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from apps.billing import bachs
        from .models import WalletTopup
        from .service import complete_topup

        pending = (WalletTopup.objects
                   .filter(user=request.user, status=WalletTopup.Status.PENDING)
                   .exclude(bachs_session_id="")
                   .first())
        if not pending:
            return Response({"paid": False})

        data, err = bachs.get_checkout_session(pending.bachs_session_id)
        if err or not bachs.session_is_paid(data):
            return Response({"paid": False})

        complete_topup(pending, data)
        pending.refresh_from_db()
        return Response({
            "paid": pending.status == WalletTopup.Status.CREDITED,
            "amount_cents": pending.amount_cents,
            "balance_cents": wallet_for(request.user).balance_cents,
        })
