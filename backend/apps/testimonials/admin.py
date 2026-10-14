from django.contrib import admin

from .models import Testimonial


@admin.register(Testimonial)
class TestimonialAdmin(admin.ModelAdmin):
    list_display = ("author_name", "author_company", "rating", "status",
                    "featured", "consent", "created_at")
    list_filter = ("status", "featured", "consent", "rating")
    search_fields = ("author_name", "author_company", "quote")
    # The consent record is evidence, not an editable field. If it ever has to
    # be proved that someone agreed to be quoted, a value an admin could have
    # typed afterwards proves nothing.
    readonly_fields = ("consent", "consent_text", "consent_at", "organization",
                       "author", "created_at", "reviewed_at", "reviewed_by")
    actions = ("approve_selected", "unfeature_selected")

    @admin.action(description="Approve (only rows with consent)")
    def approve_selected(self, request, queryset):
        done = skipped = 0
        for t in queryset:
            if not t.consent:
                skipped += 1
                continue
            t.approve(by=request.user, featured=t.featured)
            t.save()
            done += 1
        msg = f"Approved {done}."
        if skipped:
            msg += f" Skipped {skipped} without consent to publish."
        self.message_user(request, msg)

    @admin.action(description="Remove from the landing page carousel")
    def unfeature_selected(self, request, queryset):
        n = queryset.update(featured=False)
        self.message_user(request, f"Unfeatured {n}. Re-run export_testimonials to publish.")
