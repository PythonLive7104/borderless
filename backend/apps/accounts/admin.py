from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User

PROMO_TEMPLATE = """<p>Hi there,</p>
<p>For a limited time, <b>save on TryNoBot</b> — keep more of your ad budget by blocking the bots and fake clicks draining your campaigns.</p>
<p style="text-align:center;margin:28px 0;">
  <a href="https://trynobot.com/dashboard/billing" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 30px;border-radius:10px;">Claim this offer</a>
</p>
<p>Questions? Just reply to this email.</p>
<p>— The TryNoBot team</p>"""

# The one snippet people can't comfortably hand-write: a button that renders in
# every mail client. Shown in the form so it can be pasted and edited.
OFFER_BUTTON = ('<p style="text-align:center;margin:28px 0;">\n'
                '  <a href="https://trynobot.com/YOUR-OFFER" '
                'style="display:inline-block;background:#2563eb;color:#ffffff;'
                'text-decoration:none;font-weight:700;font-size:15px;'
                'padding:13px 30px;border-radius:10px;">Get the offer</a>\n</p>')


@admin.register(User)
class BorderlessUserAdmin(UserAdmin):
    """Stock UserAdmin plus the acquisition channel.

    Worth a column rather than a buried JSON field: "which campaign produced
    the accounts that converted" is the question the ad spend is decided on,
    and it should be answerable without opening a record at a time.
    """
    list_display = ("email", "first_name", "last_name", "is_verified",
                    "acquisition", "date_joined", "is_staff")
    list_filter = UserAdmin.list_filter + ("is_verified",)
    # Deliberately not searching `attribution`: it is a JSONField, and the
    # icontains lookup the admin builds for a search_fields entry is not
    # supported on one in Postgres — it would make the search box throw.
    search_fields = ("email", "first_name", "last_name")
    readonly_fields = ("attribution",)
    fieldsets = UserAdmin.fieldsets + (
        ("Acquisition", {"fields": ("attribution",)}),
    )
    actions = ["send_email"]

    @admin.display(description="Came from")
    def acquisition(self, obj):
        return obj.acquisition_source

    @admin.action(description="Send an email (promotion / offer) to selected users")
    def send_email(self, request, queryset):
        """Compose and send a branded HTML email to the selected users.

        Lives on the Users list because that's where the recipients are: tick
        the accounts (or "select all"), choose this, write the message, preview
        exactly what lands in the inbox, then send. It reuses the same mailer as
        the dashboard's Email page — branded shell, plain-text fallback,
        List-Unsubscribe header, one message per recipient so nobody sees the
        others' addresses.

        Three steps so nothing goes out by accident: compose, preview, send. The
        email is only dispatched on the explicit "Send" submit.
        """
        from django.contrib import messages
        from django.http import HttpResponseRedirect
        from django.template.response import TemplateResponse
        from apps.staff.mailer import render_email, send_broadcast

        ids = request.POST.getlist("_selected_action") or list(
            queryset.values_list("pk", flat=True))
        recipients = list(User.objects.filter(pk__in=ids)
                          .exclude(email="").values_list("email", flat=True).distinct())

        subject = (request.POST.get("subject") or "").strip()
        body = request.POST.get("body_html")
        if body is None:
            body = PROMO_TEMPLATE

        if "send" in request.POST:
            if not subject or not body.strip():
                self.message_user(request, "Subject and body are both required.",
                                  level=messages.ERROR)
            elif not recipients:
                self.message_user(request, "No recipients with an email address.",
                                  level=messages.ERROR)
            else:
                sent = send_broadcast(subject, body, recipients)
                self.message_user(
                    request, f"Sent to {sent} of {len(recipients)} selected user(s).",
                    level=messages.SUCCESS)
                return HttpResponseRedirect(request.get_full_path())

        preview_html = ""
        if "preview" in request.POST or "send" in request.POST:
            preview_html, _ = render_email(subject, body)

        ctx = {
            **self.admin_site.each_context(request),
            "title": "Send an email to selected users",
            "recipients": recipients,
            "subject": subject,
            "body_html": body,
            "preview_html": preview_html,
            "offer_button": OFFER_BUTTON,
            "selected": ids,
            "opts": self.model._meta,
        }
        return TemplateResponse(request, "admin/accounts/send_email.html", ctx)
