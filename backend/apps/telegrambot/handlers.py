"""What the bot does with an incoming message.

Every action goes through the same model helpers the dashboard uses —
link_shortener_enabled(), redirect_limit(), ShortDomain.default_for() — so plan
limits, the paywall and the paused-service switch behave identically in chat.
The bot is another front end, never a second set of rules.
"""
import logging

from django.conf import settings
from django.utils import timezone

from . import api
from .models import TelegramLink, TelegramLinkToken

log = logging.getLogger("telegram")

HELP = (
    "*TryNoBot*\n\n"
    "🔗 *New redirect* — a short link that filters bots before they reach your page\n"
    "📊 *My redirects* — your links and how many clicks were real\n"
    "🌐 *My websites* — the sites you're protecting, and the snippet to install\n"
    "👤 *My plan* — what you're on and what's left\n\n"
    "Send /cancel at any time to stop what you're doing."
)


def _front() -> str:
    return settings.FRONTEND_URL.rstrip("/")


# --- connecting -----------------------------------------------------------

def connect(chat_id: int, token: str, username: str) -> None:
    """Spend a one-time token from the dashboard and attach this chat."""
    entry = TelegramLinkToken.objects.filter(token=token).select_related(
        "user", "organization").first()
    if not entry or not entry.is_usable():
        api.send(chat_id,
                 "That link has expired or was already used.\n\n"
                 f"Open [your settings]({_front()}/dashboard/settings) and tap "
                 "*Connect Telegram* for a fresh one.")
        return

    TelegramLink.objects.update_or_create(
        chat_id=chat_id,
        defaults={"user": entry.user, "organization": entry.organization,
                  "username": username or "", "active": True, "state": "", "state_data": {}},
    )
    entry.used_at = timezone.now()
    entry.save(update_fields=["used_at"])
    api.send(chat_id,
             f"✅ Connected to *{entry.organization.name}*.\n\n" + HELP,
             keyboard=api.MAIN_KEYBOARD)


def require_link(chat_id: int) -> TelegramLink | None:
    link = TelegramLink.objects.filter(chat_id=chat_id, active=True).select_related(
        "user", "organization").first()
    if not link:
        api.send(chat_id,
                 "This chat isn't connected to a TryNoBot account yet.\n\n"
                 f"Open [your settings]({_front()}/dashboard/settings), tap "
                 "*Connect Telegram*, and follow the link it gives you.")
    return link


# --- redirects ------------------------------------------------------------

def start_new_redirect(link: TelegramLink) -> None:
    from apps.billing.models import link_shortener_enabled, redirect_limit, redirects_available
    from apps.links.models import ShortDomain, ShortLink

    if not redirects_available():
        api.send(link.chat_id, "Redirects are temporarily unavailable. Nothing you need to do — try again shortly.")
        return
    if not link_shortener_enabled(link.organization_id):
        api.send(link.chat_id,
                 "Redirects are a paid feature.\n\n"
                 f"[Choose a plan]({_front()}/dashboard/billing) and you can create them here.")
        return

    cap = redirect_limit(link.organization_id)
    used = ShortLink.objects.filter(organization_id=link.organization_id).count()
    if cap and used >= cap:
        api.send(link.chat_id,
                 f"You've used all *{cap}* redirects on your plan.\n\n"
                 f"[Upgrade]({_front()}/dashboard/billing) or delete one to make room.")
        return
    if not ShortDomain.default_for(link.organization_id):
        api.send(link.chat_id, "No short domain is available right now, so a link can't be created.")
        return

    link.state, link.state_data = "await_destination", {}
    link.save(update_fields=["state", "state_data"])
    api.send(link.chat_id,
             "Where should the link send people?\n\n"
             "Paste the full address, e.g. `https://my-offer.com/landing`")


def create_redirect(link: TelegramLink, destination: str) -> None:
    from apps.links.models import ShortDomain, ShortLink, gen_slug
    from apps.links.sync import publish_link, scan_and_flag

    destination = destination.strip()
    if not destination.lower().startswith(("http://", "https://")):
        api.send(link.chat_id, "That doesn't look like a web address — it needs to start with `https://`.\n\nTry again, or send /cancel.")
        return

    domain = ShortDomain.default_for(link.organization_id)
    obj = ShortLink.objects.create(
        organization_id=link.organization_id, domain=domain,
        slug=gen_slug(), destination_url=destination, bot_action="decoy",
    )
    scan_and_flag(obj)          # same destination check the dashboard runs
    obj.refresh_from_db()
    publish_link(obj)
    link.clear_state()

    if obj.url_safe is False:
        api.send(link.chat_id,
                 f"⚠️ Created, but that destination was flagged as unsafe, so the link is *disabled*.\n\n"
                 f"`{domain.base}/{obj.slug}`")
        return

    api.send(link.chat_id,
             f"✅ Your link is live\n\n`{domain.base}/{obj.slug}`\n\n"
             "Real people go straight to your page. Bots get a decoy.\n\n"
             f"Turn on the human check or VPN blocking in [the dashboard]({_front()}/dashboard/links).",
             keyboard=api.MAIN_KEYBOARD)


def list_redirects(link: TelegramLink) -> None:
    from apps.links.models import ShortLink
    rows = list(ShortLink.objects.filter(organization_id=link.organization_id)
                .select_related("domain")[:10])
    if not rows:
        api.send(link.chat_id, "You haven't created any redirects yet. Tap *🔗 New redirect* to make one.")
        return
    out = ["*Your redirects*\n"]
    for r in rows:
        url = f"{r.domain.base}/{r.slug}" if r.domain_id else "(no domain)"
        flag = "" if r.active else "  ⏸ paused"
        out.append(f"`{url}`\n{r.clicks} clicks · {r.human_clicks} human · {r.bot_clicks} bot{flag}\n")
    api.send(link.chat_id, "\n".join(out))


# --- websites -------------------------------------------------------------

def list_websites(link: TelegramLink) -> None:
    from apps.websites.models import Website
    sites = list(Website.objects.filter(organization_id=link.organization_id)[:10])
    if not sites:
        api.send(link.chat_id,
                 "No websites yet.\n\n"
                 f"[Add one]({_front()}/dashboard/websites) and paste the snippet into your site — "
                 "then every visitor is scored.")
        return
    out = ["*Your websites*\n"]
    for w in sites:
        out.append(f"*{w.name}* — {w.domain}\nSnippet id: `{w.tracking_id}`\n")
    out.append(f"[Copy the full snippet]({_front()}/dashboard/websites)")
    api.send(link.chat_id, "\n".join(out))


def show_plan(link: TelegramLink) -> None:
    from apps.billing.models import redirect_limit, website_limit
    from apps.links.models import ShortLink
    from apps.websites.models import Website

    sub = getattr(link.organization, "subscription", None)
    if not sub:
        api.send(link.chat_id, "No subscription found for this workspace.")
        return
    state = sub.access_state()
    used_links = ShortLink.objects.filter(organization_id=link.organization_id).count()
    used_sites = Website.objects.filter(organization_id=link.organization_id).count()
    cap_links = redirect_limit(link.organization_id)
    cap_sites = website_limit(link.organization_id)

    status = "🔒 expired" if state["locked"] else ("🎁 trial" if sub.status == "trialing" else "✅ active")
    days = state.get("days_left")
    api.send(link.chat_id,
             f"*{link.organization.name}*\n\n"
             f"Plan: *{sub.plan.name}* ({sub.interval})\n"
             f"Status: {status}" + (f" · {days} day(s) left" if days else "") + "\n"
             f"Redirects: {used_links} of {cap_links or '∞'}\n"
             f"Websites: {used_sites} of {cap_sites or '∞'}\n\n"
             f"[Manage billing]({_front()}/dashboard/billing)")


# --- router ---------------------------------------------------------------

BUTTONS = {
    "🔗 new redirect": start_new_redirect,
    "📊 my redirects": list_redirects,
    "🌐 my websites": list_websites,
    "👤 my plan": show_plan,
}


def handle_message(chat_id: int, text: str, username: str = "") -> None:
    text = (text or "").strip()
    low = text.lower()

    if low.startswith("/start"):
        parts = text.split(maxsplit=1)
        if len(parts) == 2 and parts[1].strip():
            connect(chat_id, parts[1].strip(), username)
        else:
            api.send(chat_id,
                     "👋 *TryNoBot*\n\nTo use this bot, connect your account: open "
                     f"[your settings]({_front()}/dashboard/settings) and tap *Connect Telegram*.")
        return

    if low in ("/help", "❓ help", "help"):
        api.send(chat_id, HELP, keyboard=api.MAIN_KEYBOARD)
        return

    link = require_link(chat_id)
    if not link:
        return

    if low == "/cancel":
        link.clear_state()
        api.send(chat_id, "Cancelled.", keyboard=api.MAIN_KEYBOARD)
        return

    # A flow in progress takes priority over the buttons.
    if link.state == "await_destination":
        create_redirect(link, text)
        return

    action = BUTTONS.get(low)
    if action:
        action(link)
        return

    api.send(chat_id, "I didn't catch that — use the buttons below, or send /help.",
             keyboard=api.MAIN_KEYBOARD)
