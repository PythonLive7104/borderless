from django.urls import path

from .views import TelegramConnectView, TelegramWebhookView

urlpatterns = [
    path("connect/", TelegramConnectView.as_view(), name="telegram-connect"),
    path("webhook/<str:secret>/", TelegramWebhookView.as_view(), name="telegram-webhook"),
]
