from django.contrib import admin
from .models import TrafficRule, RuleCondition


class ConditionInline(admin.TabularInline):
    model = RuleCondition
    extra = 0


@admin.register(TrafficRule)
class RuleAdmin(admin.ModelAdmin):
    list_display = ("name", "organization", "priority", "action", "active")
    list_filter = ("action", "active")
    inlines = [ConditionInline]
