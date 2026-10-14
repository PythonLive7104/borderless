from django.utils import timezone
from rest_framework import serializers

from .models import CONSENT_TEXT, Testimonial


class TestimonialSubmitSerializer(serializers.ModelSerializer):
    """What a customer sends from the dashboard.

    Consent is write-required rather than merely a model default: a client that
    omits the field must be refused, not silently recorded as not-consenting
    and then quietly un-approvable later.
    """
    consent = serializers.BooleanField(required=True)

    class Meta:
        model = Testimonial
        fields = ["id", "quote", "author_name", "author_role", "author_company",
                  "country", "rating", "consent", "status", "created_at"]
        read_only_fields = ["id", "status", "created_at"]

    def validate_consent(self, value):
        if not value:
            raise serializers.ValidationError(
                "We can only publish a testimonial with your permission.")
        return value

    def validate_rating(self, value):
        if not 1 <= value <= 5:
            raise serializers.ValidationError("Rating must be between 1 and 5.")
        return value

    def validate_quote(self, value):
        text = (value or "").strip()
        if len(text) < 40:
            raise serializers.ValidationError(
                "Please write a little more - at least 40 characters.")
        return text

    def create(self, validated):
        validated["consent_text"] = CONSENT_TEXT
        validated["consent_at"] = timezone.now()
        return super().create(validated)

    def update(self, instance, validated):
        # Re-consent on every edit: the wording they agreed to is tied to the
        # text they wrote, so a rewritten quote needs permission of its own.
        validated["consent_text"] = CONSENT_TEXT
        validated["consent_at"] = timezone.now()
        return super().update(instance, validated)


class TestimonialAdminSerializer(serializers.ModelSerializer):
    """Full row for the staff moderation screen."""
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    author_email = serializers.EmailField(source="author.email", read_only=True, default="")

    class Meta:
        model = Testimonial
        fields = ["id", "quote", "author_name", "author_role", "author_company",
                  "country", "rating", "consent", "consent_text", "consent_at",
                  "status", "featured", "sort", "review_note", "reviewed_at",
                  "organization_name", "author_email", "created_at"]
        read_only_fields = ["id", "consent", "consent_text", "consent_at",
                            "organization_name", "author_email", "created_at", "reviewed_at"]
