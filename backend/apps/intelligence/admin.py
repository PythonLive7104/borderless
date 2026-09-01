from django.contrib import admin
from .models import JA3Block


@admin.register(JA3Block)
class JA3BlockAdmin(admin.ModelAdmin):
    list_display = ("ja3", "label", "active", "created_at")
    list_filter = ("active",)
    search_fields = ("ja3", "label")
