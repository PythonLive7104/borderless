from django.contrib import admin
from .models import Website


@admin.register(Website)
class WebsiteAdmin(admin.ModelAdmin):
    list_display = ("name", "domain", "tracking_id", "organization", "status", "last_event_at")
    list_filter = ("status",)
    search_fields = ("name", "domain", "tracking_id")
