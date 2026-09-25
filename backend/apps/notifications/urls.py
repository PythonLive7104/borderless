from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import FeedView, MarkReadView, NotifyChannelViewSet

router = DefaultRouter()
router.register("channels", NotifyChannelViewSet, basename="notify-channel")

urlpatterns = [
    path("feed/", FeedView.as_view(), name="notify-feed"),
    path("feed/read/", MarkReadView.as_view(), name="notify-mark-read"),
] + router.urls
