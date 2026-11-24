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
    # "featured" is intentionally editable in the change form AND has its own
    # action, because featuring is the publish step — and the only reason a
    # testimonial reaches the landing page. Approving alone never did, which is
    # the gap that made publishing one feel impossible.
    list_editable = ("featured",)
    actions = ("publish_to_landing", "approve_selected", "unfeature_selected")

    @admin.action(description="Publish on the landing page (approve + feature)")
    def publish_to_landing(self, request, queryset):
        """One click to put a testimonial on the site.

        This is the action to reach for. It approves (where there is consent)
        AND features, which is the combination the landing page actually shows —
        'Approve' on its own leaves it approved-but-not-featured, and so
        invisible. With the live testimonials endpoint deployed it appears on the
        site immediately; it is also baked into the static file on the next
        deploy's export for crawlers.
        """
        from django.contrib import messages
        published = skipped = 0
        for t in queryset:
            if not t.consent:
                skipped += 1
                continue
            t.approve(by=request.user, featured=True)   # approve + feature in one
            t.save()
            published += 1
        msg = f"Published {published} to the landing page."
        if skipped:
            msg += f" Skipped {skipped} without consent to publish."
        self.message_user(request, msg,
                          level=messages.WARNING if skipped else messages.SUCCESS)

    @admin.action(description="Approve only (does NOT put it on the landing page)")
    def approve_selected(self, request, queryset):
        done = skipped = 0
        for t in queryset:
            if not t.consent:
                skipped += 1
                continue
            t.approve(by=request.user, featured=t.featured)
            t.save()
            done += 1
        msg = (f"Approved {done} — note these are NOT on the landing page until you "
               f"also feature them (use 'Publish on the landing page').")
        if skipped:
            msg += f" Skipped {skipped} without consent to publish."
        self.message_user(request, msg)

    @admin.action(description="Remove from the landing page carousel")
    def unfeature_selected(self, request, queryset):
        n = queryset.update(featured=False)
        self.message_user(request, f"Removed {n} from the landing page.")
