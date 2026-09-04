from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied

from apps.organizations.models import OrganizationMember
from .models import ShortLink
from .serializers import ShortLinkSerializer
from .sync import publish_link, unpublish_link, scan_and_flag


class ShortLinkViewSet(viewsets.ModelViewSet):
    serializer_class = ShortLinkSerializer

    def _member_org_ids(self):
        return OrganizationMember.objects.filter(user=self.request.user).values_list("organization_id", flat=True)

    def get_queryset(self):
        qs = ShortLink.objects.filter(organization_id__in=self._member_org_ids()).select_related("website")
        org = self.request.query_params.get("organization")
        return qs.filter(organization_id=org) if org else qs

    def _require_manager(self, org_id):
        m = OrganizationMember.objects.filter(organization_id=org_id, user=self.request.user).first()
        if not m or not m.can_manage:
            raise PermissionDenied("Only Owners and Admins can manage links.")

    def perform_create(self, serializer):
        org = serializer.validated_data["organization"]
        from apps.billing.models import link_shortener_enabled, redirect_limit
        if not link_shortener_enabled(org.id):
            raise PermissionDenied(
                "Short links are a paid feature. Start a plan on the Billing page to create them.")
        limit = redirect_limit(org.id)
        if limit and ShortLink.objects.filter(organization_id=org.id).count() >= limit:
            raise PermissionDenied(
                f"You've reached your plan's short-link limit ({limit}). "
                "Upgrade your plan on the Billing page for more redirects.")
        link = serializer.save()
        scan_and_flag(link)   # threat scan; auto-disables if the destination is unsafe
        publish_link(link)

    def perform_update(self, serializer):
        self._require_manager(serializer.instance.organization_id)
        link = serializer.save()
        scan_and_flag(link)
        publish_link(link)

    def perform_destroy(self, instance):
        self._require_manager(instance.organization_id)
        slug = instance.slug
        instance.delete()
        unpublish_link(slug)
