from django.contrib import admin

from .models import Notification, NotifyChannel, NotifyQuota


@admin.register(NotifyChannel)
class NotifyChannelAdmin(admin.ModelAdmin):
    list_display = ("name", "prefix", "organization", "active", "last_used", "created_at")
    list_filter = ("active", "created_at")
    search_fields = ("name", "prefix")


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("title", "channel", "read", "created_at")
    list_filter = ("read", "created_at")
    search_fields = ("title", "message")
    readonly_fields = ("channel", "title", "message", "source_ip", "created_at")


@admin.register(NotifyQuota)
class NotifyQuotaAdmin(admin.ModelAdmin):
    list_display = ("organization", "credits_used", "day", "day_used", "updated_at")
