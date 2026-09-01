from django.contrib import admin
from .models import Organization, OrganizationMember, Invitation


@admin.register(Organization)
class OrgAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "owner", "created_at")
    search_fields = ("name", "slug")


@admin.register(OrganizationMember)
class MemberAdmin(admin.ModelAdmin):
    list_display = ("user", "organization", "role", "created_at")
    list_filter = ("role",)


@admin.register(Invitation)
class InviteAdmin(admin.ModelAdmin):
    list_display = ("email", "organization", "role", "pending", "created_at")
    list_filter = ("role",)
