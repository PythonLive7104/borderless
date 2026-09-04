from rest_framework import serializers
from .models import Plan, Subscription


class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = ["id", "slug", "name", "price", "price_monthly", "monthly_events",
                  "retention_days", "team_members", "max_websites", "max_redirects"]


class SubscriptionSerializer(serializers.ModelSerializer):
    plan = PlanSerializer(read_only=True)
    period_end = serializers.SerializerMethodField()
    access = serializers.SerializerMethodField()

    class Meta:
        model = Subscription
        fields = ["id", "plan", "status", "interval", "period_start", "period_end",
                  "trial_end", "access", "created_at"]

    def get_period_end(self, obj):
        return obj.current_period()[1]

    def get_access(self, obj):
        return obj.access_state()
