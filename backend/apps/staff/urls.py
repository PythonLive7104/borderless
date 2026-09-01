from django.urls import path
from .views import AdminOverviewView, AdminUsersView, AdminOrgsView

urlpatterns = [
    path("overview/", AdminOverviewView.as_view(), name="admin-overview"),
    path("users/", AdminUsersView.as_view(), name="admin-users"),
    path("organizations/", AdminOrgsView.as_view(), name="admin-orgs"),
]
