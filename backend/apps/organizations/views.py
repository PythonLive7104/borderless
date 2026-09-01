from django.core.mail import send_mail
from django.utils import timezone
from rest_framework import generics, status, views
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from .models import (
    Organization, OrganizationMember, Invitation, Role, create_workspace,
)
from .permissions import IsOrgMember, IsOrgManager, membership
from .serializers import (
    OrganizationSerializer, MemberSerializer, InvitationSerializer,
)

FRONTEND_URL = "http://localhost:5173"


class OrganizationListCreateView(generics.ListCreateAPIView):
    serializer_class = OrganizationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        members = {m.organization_id: m for m in
                   OrganizationMember.objects.filter(user=self.request.user).select_related("organization")}
        orgs = list(Organization.objects.filter(id__in=members.keys()))
        for o in orgs:
            o._member = members[o.id]
        return orgs

    def perform_create(self, serializer):
        org = create_workspace(self.request.user, serializer.validated_data["name"])
        org._member = org.members.get(user=self.request.user)
        serializer.instance = org


class MemberListView(generics.ListAPIView):
    serializer_class = MemberSerializer
    permission_classes = [IsOrgMember]

    def get_queryset(self):
        return OrganizationMember.objects.filter(organization_id=self.kwargs["org_id"]).select_related("user")


class MemberDetailView(views.APIView):
    permission_classes = [IsOrgManager]

    def _get(self, org_id, member_id):
        return OrganizationMember.objects.filter(organization_id=org_id, id=member_id).first()

    def patch(self, request, org_id, member_id):
        m = self._get(org_id, member_id)
        if not m:
            return Response(status=status.HTTP_404_NOT_FOUND)
        role = request.data.get("role")
        if role not in (Role.ADMIN, Role.ANALYST):
            return Response({"detail": "Role must be admin or analyst."}, status=400)
        if m.role == Role.OWNER:
            return Response({"detail": "The owner's role cannot be changed."}, status=400)
        m.role = role
        m.save(update_fields=["role"])
        return Response(MemberSerializer(m).data)

    def delete(self, request, org_id, member_id):
        m = self._get(org_id, member_id)
        if not m:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if m.role == Role.OWNER:
            return Response({"detail": "The owner cannot be removed."}, status=400)
        m.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class InvitationListCreateView(generics.ListCreateAPIView):
    serializer_class = InvitationSerializer
    permission_classes = [IsOrgManager]

    def get_queryset(self):
        return Invitation.objects.filter(organization_id=self.kwargs["org_id"], accepted_at__isnull=True)

    def perform_create(self, serializer):
        org_id = self.kwargs["org_id"]
        email = serializer.validated_data["email"].lower()
        if OrganizationMember.objects.filter(organization_id=org_id, user__email__iexact=email).exists():
            raise ValidationError({"detail": "That person is already a member."})
        inv = serializer.save(organization_id=org_id, invited_by=self.request.user, email=email)
        send_mail(
            "You've been invited to a TrackAudit workspace",
            f"Accept your invitation: {FRONTEND_URL}/accept-invite?token={inv.token}",
            "no-reply@borderless.local", [email], fail_silently=True,
        )


class AcceptInvitationView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = request.data.get("token")
        inv = Invitation.objects.filter(token=token, accepted_at__isnull=True).first()
        if not inv:
            return Response({"detail": "This invitation is invalid or already used."}, status=400)
        if inv.email.lower() != request.user.email.lower():
            return Response({"detail": "This invitation was sent to a different email."}, status=403)
        OrganizationMember.objects.get_or_create(
            organization=inv.organization, user=request.user, defaults={"role": inv.role})
        inv.accepted_at = timezone.now()
        inv.save(update_fields=["accepted_at"])
        return Response({"detail": "Invitation accepted.", "organization": inv.organization.name})
