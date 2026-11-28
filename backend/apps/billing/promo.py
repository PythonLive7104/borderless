"""The Black Friday promo code: double the period on the Pro plan.

A validated code multiplies the time a payment buys — same price, more weeks/
months/years — rather than discounting the charge. That is deliberate: it needs
no second Bachs product and no change to what the card is charged, only a longer
period applied when the plan activates. So the whole feature is "did a valid code
come through, and if so, by how much do we stretch the period."

Rules, kept in one place so checkout and activation can never disagree:

  * The code must match BLACKFRIDAY_CODE exactly (case/space-insensitive).
  * It applies to the Pro plan only. On Basic/Plus it is simply not valid — the
    offer is a Pro promotion.
  * With no code configured (empty setting), the promo is off and any entered
    code is rejected, so a stale code in someone's bookmark can't keep doubling
    after the campaign ends.

Validation is server-side only. The frontend may preview "2x applied", but the
multiplier that actually extends the period is computed here, at activation,
from the code stored on the subscription — never trusted from the client.
"""
from datetime import date

from django.conf import settings
from django.utils import timezone

# The promo applies to this plan only.
PROMO_PLAN = "pro"


def configured_code() -> str:
    return (getattr(settings, "BLACKFRIDAY_CODE", "") or "").strip()


def ends_on():
    """The campaign end date, or None when open-ended. Accepts YYYY-MM-DD (and
    ignores anything after the date, so an ISO datetime also works). A value that
    doesn't parse is treated as no end date rather than raising — a typo in the
    .env must never take the whole promo offline silently... it just removes the
    countdown and leaves the code working."""
    raw = (getattr(settings, "BLACKFRIDAY_ENDS", "") or "").strip()
    if not raw:
        return None
    try:
        return date.fromisoformat(raw[:10])
    except ValueError:
        return None


def is_expired() -> bool:
    """True once the end date has passed. Valid *through* the end date itself —
    the promo turns off the day after, not on the morning of, the last day."""
    end = ends_on()
    return end is not None and timezone.localdate() > end


def ends_iso() -> str:
    """The end date as an ISO string for the UI, or "" when open-ended."""
    end = ends_on()
    return end.isoformat() if end else ""


def is_enabled() -> bool:
    """On only when a code is configured and the campaign hasn't ended. The date
    check means a code left in the .env stops doubling by itself once the sale is
    over — the same safety as clearing the code, without having to remember to."""
    return bool(configured_code()) and not is_expired()


def multiplier() -> int:
    try:
        return max(1, int(getattr(settings, "BLACKFRIDAY_MULTIPLIER", 2)))
    except (TypeError, ValueError):
        return 2


def matches(code: str) -> bool:
    """True when `code` is the running promo code, ignoring case and surrounding
    whitespace. False when the promo is off, so an old code stops working the
    moment the setting is cleared."""
    code = (code or "").strip()
    return is_enabled() and bool(code) and code.casefold() == configured_code().casefold()


def period_multiplier(code: str, plan_slug: str) -> int:
    """How much to stretch the period: the configured multiplier for a valid code
    on the Pro plan, else 1 (no change). This is the only function the activation
    path calls — a 1 is always safe."""
    if plan_slug == PROMO_PLAN and matches(code):
        return multiplier()
    return 1


def validate(code: str, plan_slug: str) -> dict:
    """Explain a code to the checkout UI: whether it applies, the multiplier, and
    a human message. Never raises — an unknown code is just not valid."""
    code = (code or "").strip()
    if not code:
        return {"valid": False, "multiplier": 1, "message": ""}
    if not is_enabled():
        return {"valid": False, "multiplier": 1, "message": "This code isn't active."}
    if not matches(code):
        return {"valid": False, "multiplier": 1, "message": "That code isn't valid."}
    if plan_slug != PROMO_PLAN:
        return {"valid": False, "multiplier": 1,
                "message": "This code applies to the Pro plan only."}
    m = multiplier()
    return {"valid": True, "multiplier": m,
            "message": f"Black Friday: {m}x your plan period for the same price."}
