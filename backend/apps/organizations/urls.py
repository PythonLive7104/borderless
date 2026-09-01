from django.urls import path
from .views import (
    OrganizationListCreateView, MemberListView, MemberDetailView,
    InvitationListCreateView, AcceptInvitationView,
)

urlpatterns = [
    path("", OrganizationListCreateView.as_view(), name="org-list"),
    path("invitations/accept/", AcceptInvitationView.as_view(), name="invite-accept"),
    path("<int:org_id>/members/", MemberListView.as_view(), name="member-list"),
    path("<int:org_id>/members/<int:member_id>/", MemberDetailView.as_view(), name="member-detail"),
    path("<int:org_id>/invitations/", InvitationListCreateView.as_view(), name="invite-list"),
]
