from django.urls import path
from .views import (AdminOverviewView, AdminUsersView, AdminOrgsView,
                    AdminSubscriptionsView, AdminFraudAlertsView, AdminGrantPlanView,
                    AdminEmailPreviewView, AdminEmailSendView)

urlpatterns = [
    path("overview/", AdminOverviewView.as_view(), name="admin-overview"),
    path("users/", AdminUsersView.as_view(), name="admin-users"),
    path("organizations/", AdminOrgsView.as_view(), name="admin-orgs"),
    path("subscriptions/", AdminSubscriptionsView.as_view(), name="admin-subs"),
    path("fraud-alerts/", AdminFraudAlertsView.as_view(), name="admin-fraud"),
    path("grant-plan/", AdminGrantPlanView.as_view(), name="admin-grant-plan"),
    path("email/preview/", AdminEmailPreviewView.as_view(), name="admin-email-preview"),
    path("email/send/", AdminEmailSendView.as_view(), name="admin-email-send"),
]
