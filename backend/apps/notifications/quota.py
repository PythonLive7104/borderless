"""Notification quota accounting.

One entry point, consume(), called on the publish hot path. Every workspace is
on a daily allowance now — paid plans get the plan's number, free/trial gets
FREE_NOTIFY_DAILY — so there's a single meter: today's count against today's
limit, resetting at local midnight.

Recording is atomic (select_for_update) so two simultaneous publishes can't
both slip past a limit of one.
"""
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from apps.billing.models import notify_quota as plan_quota

from .models import NotifyQuota


def status(organization_id) -> dict:
    """Read-only view of the meter for the dashboard. Never mutates."""
    q = plan_quota(organization_id)
    row = NotifyQuota.objects.filter(organization_id=organization_id).first()
    used = row.day_used if (row and row.day == timezone.localdate()) else 0
    limit = q["limit"]
    return {
        "mode": "daily",
        "limit": limit,
        "used": used,
        "remaining": None if limit == 0 else max(limit - used, 0),
        "unlimited": limit == 0,
    }


@transaction.atomic
def consume(organization_id) -> bool:
    """Try to spend one notification against today's allowance. Returns True if
    allowed and recorded."""
    limit = plan_quota(organization_id)["limit"]
    row, _ = (NotifyQuota.objects
              .select_for_update()
              .get_or_create(organization_id=organization_id))

    today = timezone.localdate()
    if row.day != today:
        # New day: yesterday's count is irrelevant. Write a literal 1 rather than
        # F("day_used")+1, which would add to the STALE value and carry
        # yesterday's total into today.
        row.day, row.day_used = today, 1
        row.save(update_fields=["day", "day_used"])
        return True
    if limit and row.day_used >= limit:
        return False
    row.day_used = F("day_used") + 1
    row.save(update_fields=["day_used"])
    return True
