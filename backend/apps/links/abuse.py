"""Handling for public abuse reports on short links.

The point of this module is speed. When a bank's brand-protection team or an
anti-phishing feed finds one of our slugs pointing at a phishing page, they look
for somewhere to report it; if they can't get action from us they go to our
registrar, and the registrar suspends the whole domain — every customer's links
with it. So a report re-scans the destination immediately and pages us.

Only a confirmed threat scan disables a link. A report on its own never does:
reports are unverified, and pulling a paying customer's live link on someone
else's say-so is its own kind of abuse. Anything the scan can't confirm goes to
the admin triage queue for a human.
"""
import re
from urllib.parse import urlparse

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from .models import AbuseReport, ShortLink
from .sync import publish_link, scan_and_flag

SLUG_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def _our_hosts() -> set:
    hosts = set()
    for url in (getattr(settings, "SHORTLINK_BASE", ""), getattr(settings, "FRONTEND_URL", "")):
        h = urlparse(url if "//" in (url or "") else f"//{url}").hostname if url else None
        if h:
            hosts.add(h.lower())
    return hosts


def extract_slug(value: str) -> str:
    """Pull the slug out of whatever the reporter pasted.

    Accepts a full short URL (https://trynb.cc/aB3xK9, with or without the legacy
    /l/ prefix), a bare path, or the slug on its own. Returns "" if it doesn't
    look like one of ours — we still keep the report, just unlinked.

    A URL on someone else's domain never yields a slug. Otherwise reporting
    https://evil.example/<victim-slug> would be enough to knock out an innocent
    customer's link, which turns this form into the abuse vector.
    """
    v = (value or "").strip()
    if not v:
        return ""
    if "//" in v:
        parsed = urlparse(v)
        host, path = (parsed.hostname or "").lower(), parsed.path
    elif "/" in v:
        head, rest = v.split("/", 1)
        # "trynb.cc/abc" is a host; "/abc" is already a path.
        host, path = ("", v) if v.startswith("/") else (head.lower(), "/" + rest)
    else:
        host, path = "", "/" + v
    ours = _our_hosts()
    if host and ours and host not in ours:
        return ""
    parts = [p for p in path.split("/") if p]
    if parts and parts[0] == "l":       # legacy /l/<slug> form
        parts = parts[1:]
    if not parts:
        return ""
    slug = parts[0].split("?")[0].split("#")[0]
    return slug if SLUG_RE.match(slug) else ""


def process_report(report: AbuseReport) -> dict:
    """Act on a freshly saved report. Returns a short summary for the response."""
    link = report.link
    if not link:
        _notify_staff(report, link=None, action="no matching link")
        return {"matched": False, "disabled": False}

    # 1. Re-scan the destination right now. It may have been clean at creation
    #    and swapped since — that's the usual shape of shortener abuse.
    was_active = link.active
    scan_and_flag(link)
    link.refresh_from_db()
    report.scan_result = {
        "safe": link.url_safe, "threats": link.url_threats,
        "scanned_at": link.url_scanned_at.isoformat() if link.url_scanned_at else None,
    }

    disabled_by_scan = was_active and not link.active
    report.auto_disabled = disabled_by_scan

    # 2. Anything the scan can't confirm stays live and goes to a human. A page
    #    that cloaks against scanners will slip through here, so the triage queue
    #    is the backstop — watch it.
    if not link.active:
        report.status = AbuseReport.Status.ACTIONED
        report.resolved_at = timezone.now()

    # 3. Push the new state to Redis or the engine keeps serving the old payload.
    publish_link(link)
    report.save(update_fields=["scan_result", "auto_disabled", "status", "resolved_at"])

    action = ("disabled by threat scan" if disabled_by_scan
              else "already disabled" if not link.active
              else "STILL LIVE — scan came back clean, needs a human")
    _notify_staff(report, link, action)
    if disabled_by_scan:   # don't re-notify about a link that was already down
        _notify_owner(report, link)
    _acknowledge_reporter(report, disabled=not link.active)

    return {"matched": True, "disabled": not link.active}


def _abuse_inbox() -> str:
    return getattr(settings, "ABUSE_NOTIFY_EMAIL", "") or getattr(settings, "ABUSE_EMAIL", "")


def _notify_staff(report, link, action: str):
    to = _abuse_inbox()
    if not to:
        return
    dest = link.destination_url if link else "(unknown link)"
    org = link.organization.name if link else "—"
    send_mail(
        f"[abuse] {report.get_reason_display()} — /{report.slug or '?'} ({action})",
        (
            f"Reported: {report.reported_url}\n"
            f"Reason:   {report.get_reason_display()}\n"
            f"Action:   {action}\n\n"
            f"Destination: {dest}\n"
            f"Workspace:   {org}\n"
            f"Scan:        {report.scan_result or 'not run'}\n\n"
            f"Reporter: {report.reporter_email or 'anonymous'} ({report.reporter_ip or 'no ip'})\n"
            f"Details:  {report.details or '—'}\n\n"
            f"Triage: {settings.FRONTEND_URL.rstrip('/')}/admin/links/abusereport/{report.id}/change/"
        ),
        settings.DEFAULT_FROM_EMAIL, [to], fail_silently=True,
    )


def _notify_owner(report, link):
    """Tell the workspace owner their link was pulled, so it isn't a silent outage."""
    email = getattr(getattr(link.organization, "owner", None), "email", "")
    if not email:
        return
    send_mail(
        f"A short link in your workspace was disabled",
        (
            f"We received an abuse report about one of your short links and have "
            f"disabled it while we review.\n\n"
            f"Link:        /{link.slug}\n"
            f"Destination: {link.destination_url}\n"
            f"Reported as: {report.get_reason_display()}\n\n"
            f"If you believe this is a mistake, reply to this email and we'll take "
            f"another look. Repeated confirmed abuse will close the workspace.\n\n"
            f"{settings.FRONTEND_URL.rstrip('/')}/dashboard/links"
        ),
        settings.DEFAULT_FROM_EMAIL, [email], fail_silently=True,
    )


def _acknowledge_reporter(report, disabled: bool):
    """Close the loop with the reporter. This is the whole game: a reporter who
    gets a fast, concrete answer marks it resolved instead of escalating."""
    if not report.reporter_email:
        return
    outcome = ("We've disabled the link — it no longer redirects."
               if disabled else
               "Our automated scan didn't confirm a threat, so a human is now reviewing it.")
    send_mail(
        f"Thanks — your report about {report.reported_url[:80]}",
        (
            f"Thanks for reporting this to {settings.BRAND_NAME}.\n\n"
            f"{outcome}\n\n"
            f"Reference: #{report.id}\n"
            f"Reported:  {report.reported_url}\n\n"
            f"If you see further abuse on our domain, reply to this email and it "
            f"will reach our abuse team directly."
        ),
        settings.DEFAULT_FROM_EMAIL, [report.reporter_email], fail_silently=True,
    )
