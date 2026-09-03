from rest_framework import serializers
from django.conf import settings
from apps.organizations.models import OrganizationMember
from .models import ShortLink, gen_slug


class ShortLinkSerializer(serializers.ModelSerializer):
    short_url = serializers.SerializerMethodField()
    quality = serializers.SerializerMethodField()
    slug = serializers.SlugField(max_length=16, required=False)

    class Meta:
        model = ShortLink
        fields = ["id", "organization", "website", "slug", "destination_url", "title",
                  "active", "clicks", "human_clicks", "bot_clicks", "url_safe", "url_threats",
                  "url_scanned_at", "short_url", "quality", "created_at"]
        read_only_fields = ["clicks", "human_clicks", "bot_clicks", "url_safe", "url_threats",
                            "url_scanned_at", "created_at"]

    def get_short_url(self, obj) -> str:
        base = (getattr(settings, "SHORTLINK_BASE", "") or settings.FRONTEND_URL).rstrip("/")
        return f"{base}/l/{obj.slug}"

    def get_quality(self, obj) -> float:
        return round(obj.human_clicks / obj.clicks, 4) if obj.clicks else 0.0

    def validate_organization(self, org):
        user = self.context["request"].user
        m = OrganizationMember.objects.filter(organization=org, user=user).first()
        if not m:
            raise serializers.ValidationError("You are not a member of this workspace.")
        if not m.can_manage:
            raise serializers.ValidationError("Only Owners and Admins can manage links.")
        return org

    def create(self, validated_data):
        if not validated_data.get("slug"):
            validated_data["slug"] = gen_slug()
        return super().create(validated_data)
