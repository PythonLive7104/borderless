from rest_framework import serializers
from django.conf import settings
from apps.organizations.models import OrganizationMember
from .models import RESERVED_SLUGS, ShortLink, gen_slug


class ShortLinkSerializer(serializers.ModelSerializer):
    short_url = serializers.SerializerMethodField()
    quality = serializers.SerializerMethodField()
    slug = serializers.SlugField(max_length=64, required=False)

    class Meta:
        model = ShortLink
        fields = ["id", "organization", "website", "slug", "destination_url", "title",
                  "active", "bot_action", "clicks", "human_clicks", "bot_clicks", "url_safe",
                  "url_threats", "url_scanned_at", "short_url", "quality", "created_at"]
        read_only_fields = ["clicks", "human_clicks", "bot_clicks", "url_safe", "url_threats",
                            "url_scanned_at", "created_at"]

    def get_short_url(self, obj) -> str:
        # A dedicated short domain serves bare-slug links at the root
        # (nobot.link/<slug>). Without one, fall back to the main app domain,
        # which only routes /l/ to the engine — so keep the /l/ prefix there.
        base = getattr(settings, "SHORTLINK_BASE", "").rstrip("/")
        if base:
            return f"{base}/{obj.slug}"
        return f"{settings.FRONTEND_URL.rstrip('/')}/l/{obj.slug}"

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

    def validate_slug(self, slug):
        # The short domain serves /report and the bot pages itself; a link with
        # one of those slugs would shadow the page a complainant needs.
        if slug.lower() in RESERVED_SLUGS:
            raise serializers.ValidationError(f'"{slug}" is reserved — pick another.')
        return slug

    def validate(self, attrs):
        website = attrs.get("website")
        org = attrs.get("organization") or getattr(self.instance, "organization", None)
        if website and org and website.organization_id != org.id:
            raise serializers.ValidationError({"website": "That website isn't in this workspace."})
        return attrs

    def create(self, validated_data):
        if not validated_data.get("slug"):
            validated_data["slug"] = gen_slug()
        return super().create(validated_data)
