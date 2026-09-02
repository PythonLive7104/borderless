from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.organizations.models import OrganizationMember, Role
from .models import Website
from .serializers import WebsiteSerializer


class WebsiteViewSet(viewsets.ModelViewSet):
    serializer_class = WebsiteSerializer

    def _member_org_ids(self):
        return OrganizationMember.objects.filter(user=self.request.user).values_list("organization_id", flat=True)

    def get_queryset(self):
        qs = Website.objects.filter(organization_id__in=self._member_org_ids())
        org = self.request.query_params.get("organization")
        if org:
            qs = qs.filter(organization_id=org)
        return qs

    def _require_manager(self, org_id):
        m = OrganizationMember.objects.filter(organization_id=org_id, user=self.request.user).first()
        if not m or not m.can_manage:
            raise PermissionDenied("Only Owners and Admins can modify websites.")

    def perform_create(self, serializer):
        org = serializer.validated_data["organization"]
        self._require_manager(org.id)
        from apps.billing.models import website_limit, is_on_trial
        from rest_framework.exceptions import ValidationError
        limit = website_limit(org.id)  # 0 = unlimited
        if limit and Website.objects.filter(organization=org).count() >= limit:
            where = "free trial" if is_on_trial(org.id) else "current plan"
            raise ValidationError(
                f"Your {where} can protect {limit} website{'s' if limit != 1 else ''}. "
                "Upgrade to a higher plan on the Billing page to add more.")
        website = serializer.save()
        from apps.rules.sync import publish_org
        publish_org(website.organization_id)

    def perform_update(self, serializer):
        self._require_manager(serializer.instance.organization_id)
        serializer.save()

    def perform_destroy(self, instance):
        self._require_manager(instance.organization_id)
        instance.delete()

    @action(detail=True, methods=["get"])
    def snippet(self, request, pk=None):
        w = self.get_object()
        return Response({"tracking_id": w.tracking_id,
                         "snippet": WebsiteSerializer(w, context={"request": request}).data["snippet"]})

    @action(detail=True, methods=["post"])
    def verify(self, request, pk=None):
        """Report installation status. Active once the tracker has sent an event."""
        w = self.get_object()
        installed = w.last_event_at is not None
        return Response({
            "status": w.status,
            "installed": installed,
            "last_event_at": w.last_event_at,
            "message": "Installation detected — you're receiving traffic." if installed
                       else "No events received yet. Make sure the snippet is on your site.",
        })

    @action(detail=True, methods=["post"], url_path="verify-shield")
    def verify_shield(self, request, pk=None):
        """Report server-side Shield status. Active once the site's server/edge has
        called /v1/decide or /v1/guard (those emit type='server_check' events)."""
        w = self.get_object()
        from apps.traffic.models import TrafficEvent
        ev = TrafficEvent.objects.filter(website=w, type="server_check").order_by("-created_at").first()
        active = ev is not None
        return Response({
            "active": active,
            "last_check_at": ev.created_at if ev else None,
            "message": "Shield is working — we're receiving server-side checks from your site." if active
                       else "No server-side checks yet. Make sure the Shield snippet (not just the tracking snippet) is installed, then open a page on your site.",
        })
