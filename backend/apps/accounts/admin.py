from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User


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

    @admin.display(description="Came from")
    def acquisition(self, obj):
        return obj.acquisition_source
