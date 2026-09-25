"""Notification quota accounting.

One entry point, consume(), called on the publish hot path. It resolves which
meter applies (paid -> daily limit, everyone else -> a 50-credit lifetime pool),
checks headroom, and records the use atomically so two simultaneous publishes
can't both slip past a limit of one.

Kept apart from the ingest view so the same logic backs the dashboard's
"remaining" read without duplicating the plan resolution.
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
    used = _used(q["mode"], row)
    limit = q["limit"]
    return {
        "mode": q["mode"],
        "limit": limit,
        "used": used,
        "remaining": None if limit == 0 else max(limit - used, 0),
        "unlimited": q["mode"] == "daily" and limit == 0,
    }


def _used(mode: str, row) -> int:
    if row is None:
        return 0
    if mode == "daily":
        return row.day_used if row.day == timezone.localdate() else 0
    return row.credits_used


@transaction.atomic
def consume(organization_id) -> bool:
    """Try to spend one notification. Returns True if allowed and recorded."""
    q = plan_quota(organization_id)
    row, _ = (NotifyQuota.objects
              .select_for_update()
              .get_or_create(organization_id=organization_id))

    if q["mode"] == "daily":
        today = timezone.localdate()
        limit = q["limit"]
        if row.day != today:
            # New day: yesterday's count is irrelevant. Write a literal 1 rather
            # than F("day_used")+1, which would add to the STALE DB value and
            # carry yesterday's total into today.
            row.day, row.day_used = today, 1
            row.save(update_fields=["day", "day_used"])
            return True
        if limit and row.day_used >= limit:
            return False
        row.day_used = F("day_used") + 1
        row.save(update_fields=["day_used"])
        return True

    # free/trial: lifetime credit pool
    if row.credits_used >= q["limit"]:
        return False
    row.credits_used = F("credits_used") + 1
    row.save(update_fields=["credits_used"])
    return True
