import hashlib
import hmac
import ipaddress
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers

from .models import SignupIPLock

User = get_user_model()

DEFAULT_PREFS = {"email": True, "high_risk": True, "usage": True, "conversions": False}


# Acquisition keys the marketing site is allowed to report at signup. Anything
# else in the payload is dropped: this is an unauthenticated endpoint, so
# storing the object as sent would let anyone write arbitrary JSON of any size
# into a user row.
ATTRIBUTION_KEYS = frozenset({
    "gclid", "msclkid", "fbclid", "utm_source", "utm_medium", "utm_campaign",
    "utm_term", "utm_content", "referrer", "landing_path", "first_seen",
})
ATTRIBUTION_MAX_LEN = 200
SIGNUP_IP_WINDOW = timedelta(days=30)
MAX_SIGNUPS_PER_IP = 3
SIGNUP_IP_LIMIT_REACHED = (
    "Too many accounts have been created from this IP in the last 30 days. "
    "Please sign in or contact support if you believe this is an error."
)


def _signup_ip_hash(request) -> str | None:
    """Hash the trusted proxy IP header, falling back to the direct peer."""
    if request is None:
        return None
    raw_ip = request.META.get("HTTP_X_REAL_IP") or request.META.get("REMOTE_ADDR")
    try:
        address = ipaddress.ip_address(raw_ip.strip())
    except (AttributeError, ValueError):
        return None
    return hmac.new(
        settings.SECRET_KEY.encode(),
        address.packed,
        hashlib.sha256,
    ).hexdigest()


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

    def validate(self, attrs):
        attrs["_signup_ip_hash"] = _signup_ip_hash(self.context.get("request"))
        return attrs

    def create(self, validated_data):
        email = validated_data["email"]
        ip_hash = validated_data.pop("_signup_ip_hash", None)
        try:
            with transaction.atomic():
                if ip_hash:
                    lock, _ = SignupIPLock.objects.get_or_create(ip_hash=ip_hash)
                    SignupIPLock.objects.select_for_update().get(pk=lock.pk)
                    cutoff = timezone.now() - SIGNUP_IP_WINDOW
                    recent_signups = User.objects.filter(
                        signup_ip_hash=ip_hash,
                        date_joined__gte=cutoff,
                    ).count()
                    if recent_signups >= MAX_SIGNUPS_PER_IP:
                        raise serializers.ValidationError(
                            {"email": SIGNUP_IP_LIMIT_REACHED})
                user = User.objects.create_user(
                    username=email, email=email, password=validated_data["password"],
                    first_name=validated_data.get("first_name", ""),
                    last_name=validated_data.get("last_name", ""),
                    signup_ip_hash=ip_hash,
                )
        except IntegrityError:
                if ip_hash and User.objects.filter(
                        signup_ip_hash=ip_hash,
                        date_joined__gte=timezone.now() - SIGNUP_IP_WINDOW,
                ).count() >= MAX_SIGNUPS_PER_IP:
                    raise serializers.ValidationError(
                        {"email": SIGNUP_IP_LIMIT_REACHED})
                raise
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
