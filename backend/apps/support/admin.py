from django.contrib import admin

from .models import ContactMessage


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ("email", "name", "company", "handled", "created_at")
    list_filter = ("handled", "created_at")
    search_fields = ("email", "name", "company", "message")
    readonly_fields = ("name", "email", "company", "message", "ip", "created_at")
    list_editable = ("handled",)
