from django.contrib import admin
from .models import Click


@admin.register(Click)
class ClickAdmin(admin.ModelAdmin):
    list_display = ("public_id", "ts", "verdict", "reason", "country", "device")
    list_filter = ("verdict", "device", "country")
