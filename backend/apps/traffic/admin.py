from django.contrib import admin
from .models import Visitor, Session, TrafficEvent


@admin.register(Visitor)
class VisitorAdmin(admin.ModelAdmin):
    list_display = ("visitor_id", "website", "country", "device", "browser", "last_seen")
    list_filter = ("device", "country")


@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    list_display = ("session_id", "website", "utm_source", "started_at")


@admin.register(TrafficEvent)
class EventAdmin(admin.ModelAdmin):
    list_display = ("type", "website", "country", "device", "classification", "risk_score", "created_at")
    list_filter = ("type", "classification", "device")


from .models import Conversion  # noqa


@admin.register(Conversion)
class ConversionAdmin(admin.ModelAdmin):
    list_display = ("event_name", "website", "revenue", "currency", "utm_source", "created_at")
    list_filter = ("currency",)
