"""Customer-facing endpoints for direct Bitcoin payment.

Starting a payment records a pending request and returns the address and amount;
it never activates anything. Activation is an admin action (see admin.py). The
status endpoint lets the billing page show "awaiting confirmation" until then.
"""
from rest_framework import permissions, views
from rest_framework.response import Response

from . import btcpay, payment_methods
from .models import INTERVAL_DAYS, Plan, WEEKLY
from .serializers import BtcPaymentSerializer
from .views import _get_subscription, _membership


class BtcInfoView(views.APIView):
    """Is direct BTC payment available, and at what address."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response({"enabled": btcpay.is_enabled(), "address": btcpay.address()})


class BtcStartView(views.APIView):
    """Begin a direct BTC payment: record the intent, return address + amount."""

    def post(self, request):
        org_id = request.data.get("organization")
        m = _membership(request.user, org_id)
        if not m or not m.can_manage:
            return Response({"detail": "Only Owners and Admins can pay."}, status=403)
        if not btcpay.is_enabled():
            return Response({"detail": "Bitcoin payment isn't available right now."}, status=404)

        plan = Plan.objects.filter(slug=request.data.get("plan")).first()
        if not plan:
            return Response({"detail": "Unknown plan."}, status=400)
        interval = (request.data.get("interval") or WEEKLY).lower()
        if interval not in INTERVAL_DAYS:
            return Response({"detail": "Interval must be 'weekly', 'monthly' or 'yearly'."}, status=400)
        if not plan.offers(interval):
            return Response({"detail": f"{plan.name} isn't available on {interval} billing."}, status=400)

        amount = plan.price_for(interval)
        fee = payment_methods.fee_for(amount)
        total = round(float(amount) + float(fee), 2)

        sub = _get_subscription(org_id)
        payment = btcpay.create_request(sub.organization, plan, interval, request.user, total)
        return Response(BtcPaymentSerializer(payment).data, status=201)


class BtcStatusView(views.APIView):
    """The latest BTC payment for this workspace, for the billing page to poll."""

    def get(self, request):
        org_id = request.query_params.get("organization")
        if not _membership(request.user, org_id):
            return Response({"detail": "Not a member."}, status=403)
        from .models import BtcPayment
        payment = BtcPayment.objects.filter(organization_id=org_id).first()  # newest (ordering)
        if not payment:
            return Response({"payment": None})
        return Response({"payment": BtcPaymentSerializer(payment).data})
