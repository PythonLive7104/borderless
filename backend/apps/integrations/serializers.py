from rest_framework import serializers
from .models import APIKey, Webhook, WebhookDelivery, WEBHOOK_EVENTS


class APIKeySerializer(serializers.ModelSerializer):
    class Meta:
        model = APIKey
        fields = ["id", "organization", "name", "prefix", "last_used", "revoked", "created_at"]
        read_only_fields = ["prefix", "last_used", "revoked", "created_at"]


class WebhookSerializer(serializers.ModelSerializer):
    class Meta:
        model = Webhook
        fields = ["id", "organization", "url", "events", "active", "secret", "created_at"]
        read_only_fields = ["secret", "created_at"]

    def validate_events(self, events):
        bad = [e for e in events if e not in WEBHOOK_EVENTS]
        if bad:
            raise serializers.ValidationError(f"Unknown events: {', '.join(bad)}")
        if not events:
            raise serializers.ValidationError("Select at least one event.")
        return events


class DeliverySerializer(serializers.ModelSerializer):
    class Meta:
        model = WebhookDelivery
        fields = ["id", "event", "success", "status_code", "attempts", "created_at"]
