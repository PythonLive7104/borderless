from django.contrib import admin
from django.utils import timezone

from .models import AbuseReport, ShortLink
from .sync import publish_link


@admin.register(ShortLink)
class ShortLinkAdmin(admin.ModelAdmin):
    list_display = ("slug", "destination_url", "organization", "active", "url_safe",
                    "clicks", "created_at")
    list_filter = ("active", "url_safe", "bot_action")
    search_fields = ("slug", "destination_url", "title", "organization__name")
    readonly_fields = ("clicks", "human_clicks", "bot_clicks", "url_scanned_at", "created_at")


@admin.register(AbuseReport)
class AbuseReportAdmin(admin.ModelAdmin):
    """Triage queue. Default view is the open reports, newest first."""
    list_display = ("created_at", "reason", "slug", "status", "auto_disabled",
                    "reporter_email", "link_active")
    list_filter = ("status", "reason", "auto_disabled")
    search_fields = ("slug", "reported_url", "reporter_email", "details")
    readonly_fields = ("created_at", "scan_result", "reporter_ip", "reported_url", "slug")
    actions = ("disable_links", "dismiss_reports")

    @admin.display(boolean=True, description="Link live?")
    def link_active(self, obj):
        return bool(obj.link and obj.link.active)

    @admin.action(description="Disable the reported links and mark actioned")
    def disable_links(self, request, queryset):
        n = 0
        for report in queryset.select_related("link"):
            if report.link and report.link.active:
                report.link.active = False
                report.link.save(update_fields=["active"])
                publish_link(report.link)   # or the engine keeps redirecting
                n += 1
            report.status = AbuseReport.Status.ACTIONED
            report.resolved_at = timezone.now()
            report.save(update_fields=["status", "resolved_at"])
        self.message_user(request, f"{n} link(s) disabled.")

    @admin.action(description="Dismiss — no action needed")
    def dismiss_reports(self, request, queryset):
        queryset.update(status=AbuseReport.Status.DISMISSED, resolved_at=timezone.now())
