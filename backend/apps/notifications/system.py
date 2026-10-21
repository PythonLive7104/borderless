"""Notices this product sends to a workspace, as opposed to ones they receive.

The notifications app was built for inbound drops: the customer makes a channel,
gets a publish URL, and things they wire up POST into it. There was no way for
us to tell a workspace something — so when the safety scanner switched off one
of their redirects, the only trace was a red label on a row they had no reason
to revisit. Somebody can lose a link for days without knowing why.

These land in the same feed and ring the same bell, through a reserved channel
the customer cannot publish to: its key is generated and thrown away, so no
request can ever carry a matching hash. They do not touch NotifyQuota either —
charging someone's daily allowance to tell them we disabled their link would be
a strange way to behave.
"""
import logging
import secrets

from .models import NotifyChannel, Notification, sha256

log = logging.getLogger("notifications")

SYSTEM_CHANNEL_NAME = "TryNoBot alerts"


def _system_channel(organization) -> NotifyChannel | None:
    """The workspace's reserved channel for notices from us. Created on demand."""
    ch = NotifyChannel.objects.filter(
        organization=organization, name=SYSTEM_CHANNEL_NAME).first()
    if ch:
        return ch
    # The raw key is never returned or stored — only its hash — so the publish
    # endpoint can never match it and this channel is receive-only in practice.
    raw = "ntk_sys_" + secrets.token_urlsafe(32)
    return NotifyChannel.objects.create(
        organization=organization,
        name=SYSTEM_CHANNEL_NAME,
        prefix="system",
        key_hash=sha256(raw),
        active=True,
    )


def notify_workspace(organization, title: str, message: str) -> bool:
    """Put a notice in the workspace's feed. Returns whether it landed.

    Never raises. This is always called from the middle of doing something more
    important — disabling a dangerous link, for one — and failing to deliver the
    explanation must not undo the action it explains.
    """
    if organization is None:
        return False
    try:
        ch = _system_channel(organization)
        if ch is None:
            return False
        Notification.objects.create(channel=ch, title=title[:200], message=message)
        return True
    except Exception:  # pragma: no cover - defensive
        log.exception("could not deliver a system notice to org %s",
                      getattr(organization, "pk", "?"))
        return False
