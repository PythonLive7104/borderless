from django.contrib import admin
from .models import JA3Block, JA4Block


@admin.register(JA3Block)
class JA3BlockAdmin(admin.ModelAdmin):
    list_display = ("ja3", "label", "active", "created_at")
    list_filter = ("active",)
    search_fields = ("ja3", "label")


@admin.register(JA4Block)
class JA4BlockAdmin(admin.ModelAdmin):
    list_display = ("ja4", "label", "active", "created_at")
    list_filter = ("active",)
    search_fields = ("ja4", "label")


from .models import BotCheckLead


@admin.register(BotCheckLead)
class BotCheckLeadAdmin(admin.ModelAdmin):
    list_display = ("email", "url", "grade", "exposure", "converted", "created_at")
    list_filter = ("grade", "converted", "created_at")
    search_fields = ("email", "url")
    readonly_fields = ("email", "url", "grade", "exposure", "ip", "created_at")
