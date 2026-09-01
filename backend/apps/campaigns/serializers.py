from rest_framework import serializers
from apps.organizations.models import OrganizationMember
from apps.websites.models import Website
from .models import Campaign, CampaignVariant


class CampaignSerializer(serializers.ModelSerializer):
    website_name = serializers.CharField(source="website.name", read_only=True)
    organization = serializers.IntegerField(source="website.organization_id", read_only=True)

    class Meta:
        model = Campaign
        fields = [
            "id", "website", "website_name", "organization", "name", "destination_url",
            "traffic_source", "country", "utm_source", "utm_medium", "utm_campaign",
            "risk_threshold", "status", "url_safe", "url_threats", "url_scanned_at",
            "created_at", "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at", "url_safe", "url_threats", "url_scanned_at"]

    def validate_website(self, website: Website):
        user = self.context["request"].user
        m = OrganizationMember.objects.filter(organization=website.organization, user=user).first()
        if not m:
            raise serializers.ValidationError("You are not a member of this website's workspace.")
        if not m.can_manage:
            raise serializers.ValidationError("Only Owners and Admins can manage campaigns.")
        return website

    def validate_risk_threshold(self, v):
        if not (0 <= v <= 100):
            raise serializers.ValidationError("Risk threshold must be between 0 and 100.")
        return v


class CampaignVariantSerializer(serializers.ModelSerializer):
    class Meta:
        model = CampaignVariant
        fields = ["id", "campaign", "label", "destination_url", "weight", "active", "created_at"]
        read_only_fields = ["created_at"]

    def validate_campaign(self, campaign: Campaign):
        user = self.context["request"].user
        m = OrganizationMember.objects.filter(
            organization=campaign.website.organization, user=user
        ).first()
        if not m:
            raise serializers.ValidationError("You are not a member of this campaign's workspace.")
        if not m.can_manage:
            raise serializers.ValidationError("Only Owners and Admins can manage variants.")
        return campaign

    def validate_weight(self, v):
        if v < 0:
            raise serializers.ValidationError("Weight cannot be negative.")
        return v
