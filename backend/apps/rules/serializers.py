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
        fields = ["id", "organization", "website", "short_link", "name", "priority", "match", "action", "tag", "redirect_url",
                  "active", "conditions", "created_at"]
        read_only_fields = ["created_at"]

    def validate_organization(self, org):
        user = self.context["request"].user
        from apps.organizations.models import ensure_membership
        m = ensure_membership(user, org)
        if not m:
            raise serializers.ValidationError("You are not a member of this workspace.")
        if not m.can_manage:
            raise serializers.ValidationError("Only Owners and Admins can manage rules.")
        return org

    def validate_conditions(self, conditions):
        if not conditions:
            raise serializers.ValidationError("A rule needs at least one condition.")
        return conditions

    def validate_short_link(self, link):
        """A rule may only be attached to a redirect in the same workspace."""
        org = self.initial_data.get("organization") or getattr(self.instance, "organization_id", None)
        if link and org and str(link.organization_id) != str(org):
            raise serializers.ValidationError("That redirect isn't in this workspace.")
        return link

    def validate(self, attrs):
        website = attrs.get("website")
        org = attrs.get("organization") or getattr(self.instance, "organization", None)
        if website and org and website.organization_id != org.id:
            raise serializers.ValidationError({"website": "That website isn't in this workspace."})

        # An action that cannot be carried out is worse than no rule at all: it
        # LOOKS active in the dashboard and silently does nothing.
        #
        # The engine returns the rule's redirect URL and the tracker only acts
        # on it `if (d.action === 'redirect' && d.redirect)` — so a redirect
        # rule saved without a URL falls through and shows the page, exactly as
        # if the visitor had been allowed. On a short link it is worse: the
        # empty URL fails to override the link's own refusal handling, so the
        # visitor gets that link's bot_action instead — which is a 404 page
        # whenever bot_action is "send them to the destination too". That is
        # the "I set it to redirect to google.com and it just 404s" report.
        action = attrs.get("action") or getattr(self.instance, "action", "")
        if action == "redirect":
            url = attrs.get("redirect_url", getattr(self.instance, "redirect_url", ""))
            if not (url or "").strip():
                raise serializers.ValidationError({
                    "redirect_url": "Choose where to send this traffic — a redirect "
                                    "rule with no destination does nothing."})
        if action == "tag":
            tag = attrs.get("tag", getattr(self.instance, "tag", ""))
            if not (tag or "").strip():
                raise serializers.ValidationError({
                    "tag": "Enter the label to attach."})
        return attrs

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
        from apps.organizations.models import ensure_membership
        m = ensure_membership(user, org)
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
