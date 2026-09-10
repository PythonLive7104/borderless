from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import PrivateDomainCheckoutView, PrivateDomainVerifyView, ShortLinkViewSet

router = DefaultRouter()
router.register("", ShortLinkViewSet, basename="shortlink")
urlpatterns = [
    path("private-domain/checkout/", PrivateDomainCheckoutView.as_view(), name="private-domain-checkout"),
    path("private-domain/verify/", PrivateDomainVerifyView.as_view(), name="private-domain-verify"),
] + router.urls
