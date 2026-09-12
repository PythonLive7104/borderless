"""Shared Safe Browsing check for one website.

Used by both the scheduled command (check_safebrowsing) and the "Check now"
button on the website page, so a manual check and a cron check behave
identically — same flag state, same one-time owner alert on a new flag.
"""
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone


def is_enabled() -> bool:
    from apps.intelligence import threatscan
    return bool(threatscan._sb_key())


def check_site(site, *, notify: bool = True) -> dict:
    """Scan one site against Google Safe Browsing and persist the result.

    Returns {"enabled": bool, "flagged": bool, "threats": [...],
             "checked_at": datetime|None, "changed": bool}. Never raises for an
    API error — it returns enabled=True, changed=False and leaves state as-is,
    so a transient outage can't wrongly clear or set a flag.
    """
    from apps.intelligence import threatscan

    if not threatscan._sb_key():
        return {"enabled": False, "flagged": site.safe_browsing_flagged,
                "threats": site.safe_browsing_threats,
                "checked_at": site.safe_browsing_checked_at, "changed": False}

    url = site.url or f"https://{site.domain}"
    try:
        threats = threatscan._safe_browsing(url)
    except Exception:
        return {"enabled": True, "flagged": site.safe_browsing_flagged,
                "threats": site.safe_browsing_threats,
                "checked_at": site.safe_browsing_checked_at, "changed": False}

    now = timezone.now()
    was_flagged = site.safe_browsing_flagged
    is_flagged = bool(threats)
    fields = ["safe_browsing_checked_at", "safe_browsing_flagged", "safe_browsing_threats"]
    site.safe_browsing_checked_at = now
    site.safe_browsing_flagged = is_flagged
    site.safe_browsing_threats = threats

    changed = is_flagged != was_flagged
    if is_flagged and not was_flagged:
        site.safe_browsing_notified_at = now
        fields.append("safe_browsing_notified_at")
        if notify:
            _notify_flagged(site, threats)
    elif not is_flagged and was_flagged:
        site.safe_browsing_notified_at = None
        fields.append("safe_browsing_notified_at")
        if notify:
            _notify_cleared(site)

    site.save(update_fields=fields)
    return {"enabled": True, "flagged": is_flagged, "threats": threats,
            "checked_at": now, "changed": changed}


def _owner_email(site) -> str:
    return getattr(getattr(site.organization, "owner", None), "email", "") or ""


def _notify_flagged(site, threats):
    to = _owner_email(site)
    if not to:
        return
    readable = ", ".join(t.replace("_", " ").title() for t in threats) or "a threat"
    send_mail(
        f"Action needed: Google flagged {site.domain}",
        (
            f"Google Safe Browsing has flagged {site.domain} ({readable}).\n\n"
            "Chrome, Firefox and Safari will all show a red warning before your\n"
            "page loads, so your ad traffic will drop until this is cleared.\n\n"
            "What to do now:\n"
            "1. Open Google Search Console for this domain "
            "(https://search.google.com/search-console).\n"
            "2. Go to Security & Manual Actions -> Security Issues to see what\n"
            "   Google found, fix it, then click Request Review.\n"
            "3. Reviews usually clear within 1-3 days once the cause is fixed.\n\n"
            "Common cause on protected sites: search crawlers being shown a\n"
            "different page than real visitors (cloaking). TryNoBot now lets\n"
            "verified crawlers through to your real page automatically, which\n"
            "helps prevent this — make sure you're on the latest deploy.\n\n"
            f"Workspace: {site.organization.name}\n"
        ),
        settings.DEFAULT_FROM_EMAIL, [to], fail_silently=True,
    )


def _notify_cleared(site):
    to = _owner_email(site)
    if not to:
        return
    send_mail(
        f"Resolved: {site.domain} is clear on Google Safe Browsing",
        (
            f"Good news — {site.domain} is no longer flagged by Google Safe\n"
            "Browsing. Browser warnings should stop within a few hours as the\n"
            "list propagates.\n"
        ),
        settings.DEFAULT_FROM_EMAIL, [to], fail_silently=True,
    )
