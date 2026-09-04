from rest_framework import serializers
from apps.traffic.models import Visitor, TrafficEvent


class EventSerializer(serializers.ModelSerializer):
    utm_campaign = serializers.CharField(source="session.utm_campaign", read_only=True)
    visitor_ref = serializers.CharField(source="visitor.visitor_id", read_only=True)

    class Meta:
        model = TrafficEvent
        fields = ["id", "type", "visitor_ref", "ip", "country", "device", "browser", "os",
                  "url", "referrer", "risk_score", "classification", "action", "tag",
                  "fingerprint", "fp_signals", "ja3", "utm_campaign", "created_at"]


class VisitorSerializer(serializers.ModelSerializer):
    events = serializers.IntegerField(source="event_count", read_only=True)
    max_risk = serializers.IntegerField(read_only=True)

    class Meta:
        model = Visitor
        fields = ["id", "visitor_id", "ip", "country", "device", "browser", "os", "fingerprint",
                  "first_seen", "last_seen", "events", "max_risk"]
