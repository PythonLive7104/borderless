from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()

DEFAULT_PREFS = {"email": True, "high_risk": True, "usage": True, "conversions": False}


# Acquisition keys the marketing site is allowed to report at signup. Anything
# else in the payload is dropped: this is an unauthenticated endpoint, so
# storing the object as sent would let anyone write arbitrary JSON of any size
# into a user row.
ATTRIBUTION_KEYS = frozenset({
    "gclid", "msclkid", "utm_source", "utm_medium", "utm_campaign",
    "utm_term", "utm_content", "referrer", "landing_path", "first_seen",
})
ATTRIBUTION_MAX_LEN = 200


def clean_attribution(raw) -> dict:
    """Whitelist, stringify and bound a reported first touch."""
    if not isinstance(raw, dict):
        return {}
    out = {}
    for key in ATTRIBUTION_KEYS:
        val = raw.get(key)
        if val is None or isinstance(val, (dict, list, bool)):
            continue
        text = str(val).strip()[:ATTRIBUTION_MAX_LEN]
        if text:
            out[key] = text
    return out


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    # Optional, and never required: a visitor with blocked storage or an ad
    # blocker sends nothing here and must still be able to register.
    attribution = serializers.JSONField(required=False, write_only=True)
    # A friend's referral code, if they arrived through one. Never validated
    # here: a stale or mistyped code must not be able to block a signup, so it
    # is attached on a best-effort basis after the account exists.
    referral_code = serializers.CharField(required=False, allow_blank=True,
                                          max_length=16, write_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "password",
                  "attribution", "referral_code"]

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value.lower()

    def validate_attribution(self, value):
        return clean_attribution(value)

    def create(self, validated_data):
        email = validated_data["email"]
        user = User.objects.create_user(
            username=email, email=email, password=validated_data["password"],
            first_name=validated_data.get("first_name", ""), last_name=validated_data.get("last_name", ""),
        )
        attribution = validated_data.get("attribution") or {}
        if attribution:
            user.attribution = attribution
            user.save(update_fields=["attribution"])

        code = (validated_data.get("referral_code") or "").strip()
        if code:
            # Best effort by design. An unknown code, a self-referral or a
            # database hiccup must never cost somebody their account, so this
            # cannot be allowed to raise out of registration.
            try:
                from apps.referrals.service import attach_referral
                attach_referral(user, code)
            except Exception:  # pragma: no cover - defensive
                import logging
                logging.getLogger("referrals").exception(
                    "could not attach referral %r for user %s", code, user.id)
        return user


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
