from rest_framework import serializers
from .models import BtcPayment, Plan, Subscription


class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = ["id", "slug", "name", "price", "price_monthly", "price_yearly",
                  "monthly_events", "monthly_ad_clicks",
                  "retention_days", "team_members", "max_websites", "max_redirects",
                  "max_websites_monthly", "max_redirects_monthly",
                  "max_websites_yearly", "max_redirects_yearly"]


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


class BtcPaymentSerializer(serializers.ModelSerializer):
    plan_slug = serializers.CharField(source="plan.slug", read_only=True)
    plan_name = serializers.CharField(source="plan.name", read_only=True)

    class Meta:
        model = BtcPayment
        fields = ["id", "plan_slug", "plan_name", "interval", "amount_usd",
                  "address", "status", "tx_reference", "created_at", "reviewed_at"]
        read_only_fields = fields
