"""Public sticky A/B assignment: given a campaign and a visitor id, return the
variant that visitor should see. Deterministic, so it is safe to call from the
edge/tracker without any stored session."""
from rest_framework import permissions, views
from rest_framework.response import Response

from .models import Campaign
from .assignment import assign


class VariantAssignView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, campaign_id):
        visitor = request.query_params.get("visitor") or ""
        campaign = Campaign.objects.filter(id=campaign_id, status="active").first()
        if not campaign or not visitor:
            return Response({"variant": None, "url": campaign.destination_url if campaign else ""})
        variant = assign(campaign.id, visitor, list(campaign.variants.all()))
        if not variant:
            return Response({"variant": None, "url": campaign.destination_url})
        return Response({
            "variant": variant.id,
            "label": variant.label,
            "url": variant.destination_url,
        })
