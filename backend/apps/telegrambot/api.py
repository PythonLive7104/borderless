"""Minimal Telegram Bot API client.

Standard library only, matching the rest of the codebase (no new dependency for
what amounts to two POST calls). Every call is best-effort: Telegram being slow
or down must never turn into a 500 on our webhook, because Telegram retries a
failed webhook and we would answer the same update twice.
"""
import json
import logging
import urllib.error
import urllib.request

from django.conf import settings

log = logging.getLogger("telegram")
API = "https://api.telegram.org/bot{token}/{method}"


def _token() -> str:
    return getattr(settings, "TELEGRAM_BOT_TOKEN", "") or ""


def is_enabled() -> bool:
    return bool(_token())


def call(method: str, payload: dict) -> dict | None:
    if not is_enabled():
        return None
    req = urllib.request.Request(
        API.format(token=_token(), method=method),
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json",
                 "User-Agent": "TryNoBot/1.0 (+https://trynobot.com)"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        log.warning("telegram %s failed: %s %s", method, e.code, e.read().decode(errors="replace")[:300])
    except Exception as e:
        log.warning("telegram %s failed: %s", method, e)
    return None


# The persistent keyboard under the message box.
MAIN_KEYBOARD = {
    "keyboard": [
        [{"text": "🔗 New redirect"}, {"text": "📊 My redirects"}],
        [{"text": "🌐 My websites"}, {"text": "👤 My plan"}],
        [{"text": "❓ Help"}],
    ],
    "resize_keyboard": True,
}


def send(chat_id: int, text: str, keyboard=None, preview=False):
    """Send Markdown text. Link previews are off by default — a wall of preview
    cards makes a list of redirects unreadable."""
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "Markdown",
        "disable_web_page_preview": not preview,
    }
    if keyboard is not None:
        payload["reply_markup"] = keyboard
    return call("sendMessage", payload)


def answer_callback(callback_id: str, text: str = ""):
    return call("answerCallbackQuery", {"callback_query_id": callback_id, "text": text})
