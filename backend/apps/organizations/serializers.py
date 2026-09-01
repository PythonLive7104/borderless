from rest_framework import serializers
from .models import Organization, OrganizationMember, Invitation, Role


class OrganizationSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = ["id", "name", "slug", "role", "member_count", "created_at"]
        read_only_fields = ["slug", "created_at"]

    def get_role(self, obj):
        m = getattr(obj, "_member", None)
        return m.role if m else None

    def get_member_count(self, obj):
        return obj.members.count()


class MemberSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)

    class Meta:
        model = OrganizationMember
        fields = ["id", "email", "first_name", "last_name", "role", "created_at"]


class InvitationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invitation
        fields = ["id", "email", "role", "created_at", "accepted_at", "pending"]
        read_only_fields = ["created_at", "accepted_at", "pending"]

    def validate_role(self, value):
        if value == Role.OWNER:
            raise serializers.ValidationError("You cannot invite someone as Owner.")
        return value
