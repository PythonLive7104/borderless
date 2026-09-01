from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()

DEFAULT_PREFS = {"email": True, "high_risk": True, "usage": True, "conversions": False}


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "password"]

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value.lower()

    def create(self, validated_data):
        email = validated_data["email"]
        return User.objects.create_user(
            username=email, email=email, password=validated_data["password"],
            first_name=validated_data.get("first_name", ""), last_name=validated_data.get("last_name", ""),
        )


class UserSerializer(serializers.ModelSerializer):
    notification_prefs = serializers.JSONField(required=False)

    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "is_verified", "is_staff",
                  "timezone", "language", "notification_prefs"]
        read_only_fields = ["email", "is_verified", "is_staff"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["notification_prefs"] = {**DEFAULT_PREFS, **(data.get("notification_prefs") or {})}
        return data
