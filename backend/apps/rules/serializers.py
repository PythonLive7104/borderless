from rest_framework import serializers
from apps.organizations.models import OrganizationMember
from .models import TrafficRule, RuleCondition


class ConditionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RuleCondition
        fields = ["id", "field", "operator", "value"]


class RuleSerializer(serializers.ModelSerializer):
    conditions = ConditionSerializer(many=True)

    class Meta:
        model = TrafficRule
        fields = ["id", "organization", "name", "priority", "action", "tag", "redirect_url",
                  "active", "conditions", "created_at"]
        read_only_fields = ["created_at"]

    def validate_organization(self, org):
        user = self.context["request"].user
        m = OrganizationMember.objects.filter(organization=org, user=user).first()
        if not m:
            raise serializers.ValidationError("You are not a member of this workspace.")
        if not m.can_manage:
            raise serializers.ValidationError("Only Owners and Admins can manage rules.")
        return org

    def validate_conditions(self, conditions):
        if not conditions:
            raise serializers.ValidationError("A rule needs at least one condition.")
        return conditions

    def create(self, validated_data):
        conditions = validated_data.pop("conditions")
        rule = TrafficRule.objects.create(**validated_data)
        RuleCondition.objects.bulk_create([RuleCondition(rule=rule, **c) for c in conditions])
        return rule

    def update(self, instance, validated_data):
        conditions = validated_data.pop("conditions", None)
        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()
        if conditions is not None:
            instance.conditions.all().delete()
            RuleCondition.objects.bulk_create([RuleCondition(rule=instance, **c) for c in conditions])
        return instance


import ipaddress
from .models import IPListEntry


class IPListEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = IPListEntry
        fields = ["id", "organization", "value", "kind", "note", "active", "created_at"]
        read_only_fields = ["created_at"]

    def validate_organization(self, org):
        user = self.context["request"].user
        m = OrganizationMember.objects.filter(organization=org, user=user).first()
        if not m:
            raise serializers.ValidationError("You are not a member of this workspace.")
        if not m.can_manage:
            raise serializers.ValidationError("Only Owners and Admins can manage IP filters.")
        return org

    def validate_value(self, v):
        v = v.strip()
        try:
            if "/" in v:
                ipaddress.ip_network(v, strict=False)
            else:
                ipaddress.ip_address(v)
        except ValueError:
            raise serializers.ValidationError("Enter a valid IP address or CIDR range (e.g. 1.2.3.4 or 10.0.0.0/8).")
        return v
