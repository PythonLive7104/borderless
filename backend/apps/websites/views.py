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
        from apps.billing.models import is_on_trial, TRIAL_MAX_WEBSITES
        from rest_framework.exceptions import ValidationError
        if is_on_trial(org.id) and Website.objects.filter(organization=org).count() >= TRIAL_MAX_WEBSITES:
            raise ValidationError(
                f"Your free trial can protect {TRIAL_MAX_WEBSITES} website. "
                "Upgrade to a paid plan to add more.")
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
