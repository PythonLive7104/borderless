"""Backfill owner memberships that drifted missing.

An organization whose owner has no OrganizationMember row locks that owner out
of managing their own workspace ("You are not a member of this workspace").
This heals any such row. Safe to run repeatedly.
"""
from django.core.management.base import BaseCommand

from apps.organizations.models import Organization, OrganizationMember, Role


class Command(BaseCommand):
    help = "Create any missing owner memberships."

    def handle(self, *args, **opts):
        fixed = 0
        for org in Organization.objects.select_related("owner"):
            if not org.owner_id:
                continue
            _, created = OrganizationMember.objects.get_or_create(
                organization=org, user_id=org.owner_id, defaults={"role": Role.OWNER})
            if created:
                fixed += 1
                self.stdout.write(f"  healed: {org.name} -> owner {org.owner_id}")
        self.stdout.write(self.style.SUCCESS(f"Owner memberships repaired: {fixed}."))
