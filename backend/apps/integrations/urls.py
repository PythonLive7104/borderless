from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import APIKeyViewSet, WebhookViewSet, EventsMetaView

router = DefaultRouter()
router.register("keys", APIKeyViewSet, basename="apikey")
router.register("webhooks", WebhookViewSet, basename="webhook")
urlpatterns = [path("events/", EventsMetaView.as_view(), name="webhook-events")] + router.urls
