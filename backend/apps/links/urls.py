from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (PrivateDomainCheckoutView, PrivateDomainVerifyView, ShortLinkViewSet,
                    CustomDomainView, CustomDomainVerifyView, CustomDomainDeleteView)

router = DefaultRouter()
router.register("", ShortLinkViewSet, basename="shortlink")
urlpatterns = [
    path("private-domain/checkout/", PrivateDomainCheckoutView.as_view(), name="private-domain-checkout"),
    path("private-domain/verify/", PrivateDomainVerifyView.as_view(), name="private-domain-verify"),
    path("domains/", CustomDomainView.as_view(), name="custom-domains"),
    path("domains/<int:pk>/verify/", CustomDomainVerifyView.as_view(), name="custom-domain-verify"),
    path("domains/<int:pk>/", CustomDomainDeleteView.as_view(), name="custom-domain-delete"),
] + router.urls
