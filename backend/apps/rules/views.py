from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied

from apps.organizations.models import OrganizationMember
from .models import TrafficRule
from .serializers import RuleSerializer
from .sync import publish_org
from rest_framework.permissions import IsAuthenticated
from apps.billing.permissions import HasWorkspaceAccess


class RuleViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasWorkspaceAccess]
    serializer_class = RuleSerializer

    def _member_org_ids(self):
        return OrganizationMember.objects.filter(user=self.request.user).values_list("organization_id", flat=True)

    def get_queryset(self):
        qs = TrafficRule.objects.filter(organization_id__in=self._member_org_ids()).prefetch_related("conditions")
        org = self.request.query_params.get("organization")
        return qs.filter(organization_id=org) if org else qs

    def _require_manager(self, org_id):
        m = OrganizationMember.objects.filter(organization_id=org_id, user=self.request.user).first()
        if not m or not m.can_manage:
            raise PermissionDenied("Only Owners and Admins can modify rules.")

    def perform_create(self, serializer):
        rule = serializer.save()
        publish_org(rule.organization_id)

    def perform_update(self, serializer):
        self._require_manager(serializer.instance.organization_id)
        rule = serializer.save()
        publish_org(rule.organization_id)

    def perform_destroy(self, instance):
        self._require_manager(instance.organization_id)
        org_id = instance.organization_id
        instance.delete()
        publish_org(org_id)


from .models import IPListEntry
from .serializers import IPListEntrySerializer


class IPListEntryViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasWorkspaceAccess]
    serializer_class = IPListEntrySerializer

    def _member_org_ids(self):
        return OrganizationMember.objects.filter(user=self.request.user).values_list("organization_id", flat=True)

    def get_queryset(self):
        qs = IPListEntry.objects.filter(organization_id__in=self._member_org_ids())
        org = self.request.query_params.get("organization")
        kind = self.request.query_params.get("kind")
        if org:
            qs = qs.filter(organization_id=org)
        if kind:
            qs = qs.filter(kind=kind)
        return qs

    def _require_manager(self, org_id):
        m = OrganizationMember.objects.filter(organization_id=org_id, user=self.request.user).first()
        if not m or not m.can_manage:
            raise PermissionDenied("Only Owners and Admins can modify IP filters.")

    def perform_create(self, serializer):
        entry = serializer.save()
        publish_org(entry.organization_id)

    def perform_update(self, serializer):
        self._require_manager(serializer.instance.organization_id)
        entry = serializer.save()
        publish_org(entry.organization_id)

    def perform_destroy(self, instance):
        self._require_manager(instance.organization_id)
        org_id = instance.organization_id
        instance.delete()
        publish_org(org_id)
