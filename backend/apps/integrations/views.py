from rest_framework import viewsets, views, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from apps.organizations.models import OrganizationMember
from apps.websites.models import Website
from apps.traffic.models import Visitor, Conversion
from django.utils import timezone

from .models import APIKey, Webhook, WEBHOOK_EVENTS
from .serializers import APIKeySerializer, WebhookSerializer, DeliverySerializer
from .auth import APIKeyAuthentication
from .dispatch import dispatch


def _member_org_ids(user):
    return OrganizationMember.objects.filter(user=user).values_list("organization_id", flat=True)


def _require_manager(user, org_id):
    m = OrganizationMember.objects.filter(organization_id=org_id, user=user).first()
    if not m or not m.can_manage:
        raise PermissionDenied("Only Owners and Admins can manage developer settings.")


class APIKeyViewSet(viewsets.ModelViewSet):
    serializer_class = APIKeySerializer

    def get_queryset(self):
        qs = APIKey.objects.filter(organization_id__in=_member_org_ids(self.request.user))
        if org := self.request.query_params.get("organization"):
            qs = qs.filter(organization_id=org)
        return qs

    def create(self, request, *args, **kwargs):
        org_id = request.data.get("organization")
        _require_manager(request.user, org_id)
        raw, prefix, key_hash = APIKey.generate()
        key = APIKey.objects.create(organization_id=org_id, name=request.data.get("name", "API key"),
                                    prefix=prefix, key_hash=key_hash)
        from .shield import publish_key
        publish_key(key)  # let the server-side shield authenticate this key
        data = APIKeySerializer(key).data
        data["key"] = raw  # shown ONCE
        return Response(data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        key = self.get_object()
        _require_manager(request.user, key.organization_id)
        key.revoked = True
        key.save(update_fields=["revoked"])
        from .shield import unpublish_key
        unpublish_key(key.key_hash)  # revoked keys stop working on the shield too
        return Response(status=status.HTTP_204_NO_CONTENT)


class WebhookViewSet(viewsets.ModelViewSet):
    serializer_class = WebhookSerializer

    def get_queryset(self):
        qs = Webhook.objects.filter(organization_id__in=_member_org_ids(self.request.user))
        if org := self.request.query_params.get("organization"):
            qs = qs.filter(organization_id=org)
        return qs

    def perform_create(self, serializer):
        _require_manager(self.request.user, serializer.validated_data["organization"].id)
        serializer.save()

    def perform_update(self, serializer):
        _require_manager(self.request.user, serializer.instance.organization_id)
        serializer.save()

    def perform_destroy(self, instance):
        _require_manager(self.request.user, instance.organization_id)
        instance.delete()

    @action(detail=True, methods=["get"])
    def deliveries(self, request, pk=None):
        hook = self.get_object()
        return Response(DeliverySerializer(hook.deliveries.all()[:50], many=True).data)

    @action(detail=True, methods=["post"])
    def test(self, request, pk=None):
        hook = self.get_object()
        dispatch(hook.organization_id, hook.events[0] if hook.events else "traffic.classified",
                 {"test": True, "message": "This is a test delivery from TrackAudit."})
        return Response({"detail": "Test delivery sent."})


class EventsMetaView(views.APIView):
    def get(self, request):
        return Response({"events": WEBHOOK_EVENTS})


# ---- public server-side API (API-key auth) ----
class PublicConversionView(views.APIView):
    authentication_classes = [APIKeyAuthentication]
    permission_classes = [AllowAny]  # APIKeyAuthentication enforces identity

    def post(self, request):
        principal = request.user
        if not getattr(principal, "organization_id", None):
            return Response({"detail": "API key required."}, status=401)

        site_id = request.data.get("site_id")
        site = Website.objects.filter(tracking_id=site_id, organization_id=principal.organization_id).first()
        if not site:
            return Response({"detail": "Unknown site_id for this API key."}, status=400)

        visitor_ref = request.data.get("visitor_id", "")
        visitor, _ = Visitor.objects.get_or_create(website=site, visitor_id=visitor_ref[:64] or "server")
        try:
            revenue = float(request.data.get("revenue", 0) or 0)
        except (TypeError, ValueError):
            revenue = 0
        conv = Conversion.objects.create(
            website=site, visitor=visitor, event_name=request.data.get("event", "conversion"),
            revenue=revenue, currency=request.data.get("currency", "USD"),
            utm_source=request.data.get("utm_source", ""), utm_campaign=request.data.get("utm_campaign", ""),
            created_at=timezone.now(),
        )
        dispatch(site.organization_id, "conversion.created", {
            "id": conv.id, "site_id": site_id, "visitor_id": visitor_ref,
            "event": conv.event_name, "revenue": float(conv.revenue), "currency": conv.currency,
        })
        return Response({"id": conv.id, "status": "recorded"}, status=201)
