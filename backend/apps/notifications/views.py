"""Dashboard-facing management: channels, the feed, and the quota read.

Channel writes go through HasWorkspaceAccess (the same paid/trial gate the API
keys and webhooks use) and are limited to workspace managers. The publish
endpoint itself lives in ingest.py and is public — the key is the auth.
"""
from django.utils import timezone
from rest_framework import status, views, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.billing.permissions import HasWorkspaceAccess
from apps.organizations.models import OrganizationMember

from . import quota
from .models import Notification, NotifyChannel
from .serializers import NotificationSerializer, NotifyChannelSerializer


def _member_org_ids(user):
    return OrganizationMember.objects.filter(user=user).values_list("organization_id", flat=True)


def _require_manager(user, org_id):
    from rest_framework.exceptions import PermissionDenied
    m = OrganizationMember.objects.filter(organization_id=org_id, user=user).first()
    if not m or not m.can_manage:
        raise PermissionDenied("Only Owners and Admins can manage notification channels.")


def _org_from_request(request):
    return request.data.get("organization") or request.query_params.get("organization")


class NotifyChannelViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasWorkspaceAccess]
    serializer_class = NotifyChannelSerializer

    def get_queryset(self):
        qs = NotifyChannel.objects.filter(organization_id__in=_member_org_ids(self.request.user))
        if org := self.request.query_params.get("organization"):
            qs = qs.filter(organization_id=org)
        return qs

    def create(self, request, *args, **kwargs):
        org_id = request.data.get("organization")
        _require_manager(request.user, org_id)
        raw, prefix, key_hash = NotifyChannel.generate()
        ch = NotifyChannel.objects.create(
            organization_id=org_id, name=request.data.get("name", "Notifications")[:120],
            prefix=prefix, key_hash=key_hash)
        data = NotifyChannelSerializer(ch).data
        data["key"] = raw  # shown ONCE — never retrievable again
        return Response(data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        ch = self.get_object()
        _require_manager(request.user, ch.organization_id)
        # Only the on/off toggle is editable; name is set at creation like a key.
        if "active" in request.data:
            ch.active = bool(request.data["active"])
            ch.save(update_fields=["active"])
        return Response(NotifyChannelSerializer(ch).data)

    def destroy(self, request, *args, **kwargs):
        ch = self.get_object()
        _require_manager(request.user, ch.organization_id)
        ch.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class FeedView(views.APIView):
    """Recent notifications for the workspace, newest first."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org_id = _org_from_request(request)
        if org_id is None or int(org_id) not in set(_member_org_ids(request.user)):
            return Response({"detail": "Not a member."}, status=403)
        notes = (Notification.objects
                 .filter(channel__organization_id=org_id)
                 .select_related("channel")[:100])
        return Response({
            "results": NotificationSerializer(notes, many=True).data,
            "unread": Notification.objects.filter(
                channel__organization_id=org_id, read=False).count(),
            "quota": quota.status(org_id),
        })


class UnreadCountView(views.APIView):
    """Just the number, for the nav bell — cheap enough to poll."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org_id = _org_from_request(request)
        if org_id is None or int(org_id) not in set(_member_org_ids(request.user)):
            return Response({"unread": 0})
        return Response({"unread": Notification.objects.filter(
            channel__organization_id=org_id, read=False).count()})


class MarkReadView(views.APIView):
    """Mark some or all of the workspace's notifications read."""
    permission_classes = [IsAuthenticated, HasWorkspaceAccess]

    def post(self, request):
        org_id = _org_from_request(request)
        if org_id is None or int(org_id) not in set(_member_org_ids(request.user)):
            return Response({"detail": "Not a member."}, status=403)
        qs = Notification.objects.filter(channel__organization_id=org_id, read=False)
        ids = request.data.get("ids")
        if ids:
            qs = qs.filter(id__in=ids)
        updated = qs.update(read=True)
        return Response({"marked": updated})
