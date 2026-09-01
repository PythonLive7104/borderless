from django.contrib import admin
from .models import APIKey, Webhook, WebhookDelivery


@admin.register(APIKey)
class APIKeyAdmin(admin.ModelAdmin):
    list_display = ("name", "prefix", "organization", "revoked", "last_used", "created_at")
    list_filter = ("revoked",)


@admin.register(Webhook)
class WebhookAdmin(admin.ModelAdmin):
    list_display = ("url", "organization", "active", "created_at")


@admin.register(WebhookDelivery)
class DeliveryAdmin(admin.ModelAdmin):
    list_display = ("webhook", "event", "success", "status_code", "attempts", "created_at")
    list_filter = ("success", "event")
