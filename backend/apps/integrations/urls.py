from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import APIKeyViewSet, WebhookViewSet, EventsMetaView
from .googleads_views import (
    GoogleAdsStatusView, GoogleAdsConnectView, GoogleAdsCallbackView,
    GoogleAdsDisconnectView, GoogleAdsExclusionPlanView,
)

router = DefaultRouter()
router.register("keys", APIKeyViewSet, basename="apikey")
router.register("webhooks", WebhookViewSet, basename="webhook")
urlpatterns = [
    path("events/", EventsMetaView.as_view(), name="webhook-events"),
    path("google-ads/status/", GoogleAdsStatusView.as_view(), name="google-ads-status"),
    path("google-ads/connect/", GoogleAdsConnectView.as_view(), name="google-ads-connect"),
    path("google-ads/callback/", GoogleAdsCallbackView.as_view(), name="google-ads-callback"),
    path("google-ads/disconnect/", GoogleAdsDisconnectView.as_view(), name="google-ads-disconnect"),
    path("google-ads/exclusion-plan/", GoogleAdsExclusionPlanView.as_view(), name="google-ads-exclusion-plan"),
] + router.urls
