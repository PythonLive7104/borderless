from django.conf import settings
from rest_framework import serializers
from apps.organizations.models import OrganizationMember
from .models import Website


class WebsiteSerializer(serializers.ModelSerializer):
    snippet = serializers.SerializerMethodField()

    class Meta:
        model = Website
        fields = ["id", "organization", "name", "domain", "url", "tracking_id",
                  "status", "last_event_at", "created_at", "strict_mode", "snippet"]
        read_only_fields = ["tracking_id", "status", "last_event_at", "created_at"]

    def get_snippet(self, obj) -> str:
        # Strict mode drops `async`: an async script can't hide the page before
        # it paints, which is the whole point of strict.
        if obj.strict_mode:
            return (
                f'<script src="{settings.TRACKER_URL}" '
                f'data-site-id="{obj.tracking_id}" data-strict="1"></script>'
            )
        return (
            f'<script async src="{settings.TRACKER_URL}" '
            f'data-site-id="{obj.tracking_id}"></script>'
        )

    def validate_organization(self, org):
        user = self.context["request"].user
        if not OrganizationMember.objects.filter(organization=org, user=user).exists():
            raise serializers.ValidationError("You are not a member of this workspace.")
        return org
