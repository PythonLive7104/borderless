"""API-key authentication for the public /api/v1 endpoints."""
from django.utils import timezone
from rest_framework import authentication, exceptions
from .models import APIKey, sha256


class APIKeyUser:
    """Lightweight principal carrying the key's organization."""
    is_authenticated = True

    def __init__(self, api_key: APIKey):
        self.api_key = api_key
        self.organization_id = api_key.organization_id


class APIKeyAuthentication(authentication.BaseAuthentication):
    def authenticate(self, request):
        header = request.META.get("HTTP_AUTHORIZATION", "")
        if not header.startswith("Bearer blk_"):
            return None
        raw = header.split(" ", 1)[1].strip()
        key = APIKey.objects.filter(key_hash=sha256(raw), revoked=False).first()
        if not key:
            raise exceptions.AuthenticationFailed("Invalid API key.")
        APIKey.objects.filter(pk=key.pk).update(last_used=timezone.now())
        return (APIKeyUser(key), None)

    def authenticate_header(self, request):
        return "Bearer"
