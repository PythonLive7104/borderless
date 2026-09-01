from rest_framework.permissions import BasePermission
from .models import OrganizationMember, Role


def membership(user, org_id):
    return OrganizationMember.objects.filter(organization_id=org_id, user=user).first()


class IsOrgMember(BasePermission):
    """User must belong to the organization in the URL."""
    def has_permission(self, request, view):
        m = membership(request.user, view.kwargs.get("org_id"))
        if not m:
            return False
        request.org_member = m
        return True


class IsOrgManager(IsOrgMember):
    """Owner or Admin only (write operations on members/invites)."""
    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.org_member.can_manage
