from django.contrib import admin
from .models import Campaign


@admin.register(Campaign)
class CampaignAdmin(admin.ModelAdmin):
    list_display = ("name", "website", "traffic_source", "status", "risk_threshold", "created_at")
    list_filter = ("status", "traffic_source")
    search_fields = ("name", "utm_campaign")
