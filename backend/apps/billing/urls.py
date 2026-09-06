from django.urls import path
from .views import (PlanListView, SubscriptionView, ChangePlanView, CancelView,
                    UsageView, CheckoutView, VerifyCheckoutView, BachsWebhookView)

urlpatterns = [
    path("plans/", PlanListView.as_view(), name="plans"),
    path("subscription/", SubscriptionView.as_view(), name="subscription"),
    path("subscription/change/", ChangePlanView.as_view(), name="change-plan"),
    path("subscription/cancel/", CancelView.as_view(), name="cancel"),
    path("usage/", UsageView.as_view(), name="usage"),
    path("checkout/", CheckoutView.as_view(), name="checkout"),
    path("checkout/verify/", VerifyCheckoutView.as_view(), name="checkout-verify"),
    path("webhooks/bachs/", BachsWebhookView.as_view(), name="bachs-webhook"),
]
