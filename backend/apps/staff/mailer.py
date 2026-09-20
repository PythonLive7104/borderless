"""Staff broadcast mailer: wrap admin-composed content in a branded, deliverable
email and send it.

Inbox placement is mostly DNS and reputation (SPF/DKIM/DMARC on the sending
domain — see docs), which code can't force. What code CAN do, and does here:
send real multipart (HTML + a plain-text alternative), a branded shell with
inline styles that renders everywhere, and the List-Unsubscribe header bulk
mailboxes now expect. Those are the difference between "looks like spam" and
"looks like a real company", short of the DNS.
"""
import re

from django.conf import settings
from django.core.mail import EmailMultiAlternatives

BRAND = "#2563eb"
VIOLET = "#7c3aed"
INK = "#0f172a"
MUTED = "#64748b"


def _front() -> str:
    return getattr(settings, "FRONTEND_URL", "https://trynobot.com").rstrip("/")


def render_email(subject: str, body_html: str) -> tuple[str, str]:
    """Wrap admin-composed body HTML in the branded shell; return (html, text).

    The body is the admin's own HTML (paragraphs, links, etc.); the shell adds
    the header, spacing and footer so every send looks consistent and on-brand.
    """
    front = _front()
    html = f"""\
<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px -12px rgba(15,23,42,.25);">
        <tr><td style="background:linear-gradient(135deg,{BRAND},{VIOLET});padding:22px 28px;">
          <span style="color:#fff;font-size:18px;font-weight:800;letter-spacing:-.02em;">TryNoBot</span>
        </td></tr>
        <tr><td style="padding:32px 28px;color:{INK};font-size:15px;line-height:1.6;">
{body_html}
        </td></tr>
        <tr><td style="padding:18px 28px;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:{MUTED};font-size:12px;line-height:1.6;">
            TryNoBot · <a href="{front}" style="color:{BRAND};text-decoration:none;">trynobot.com</a><br>
            You're receiving this because you have a TryNoBot account or ran our free Bot Check.
            To stop these emails, reply with "unsubscribe".
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""
    return html, _to_text(body_html)


def _to_text(body_html: str) -> str:
    """A readable plain-text fallback from the body HTML. A multipart email
    without a text part is itself a spam signal."""
    t = re.sub(r"(?is)<br\s*/?>", "\n", body_html)
    t = re.sub(r"(?is)</p>", "\n\n", t)
    t = re.sub(r"(?is)<a [^>]*href=[\"']([^\"']+)[\"'][^>]*>(.*?)</a>", r"\2 (\1)", t)
    t = re.sub(r"(?is)<[^>]+>", "", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip() + f"\n\n— TryNoBot\n{_front()}"


def send_broadcast(subject: str, body_html: str, recipients: list[str]) -> int:
    """Send one branded email to each recipient (separately, so nobody sees the
    others' addresses). Returns how many were sent."""
    html, text = render_email(subject, body_html)
    front = _front()
    sent = 0
    for email in recipients:
        msg = EmailMultiAlternatives(subject, text, settings.DEFAULT_FROM_EMAIL, [email])
        msg.attach_alternative(html, "text/html")
        # Bulk mailboxes (Gmail/Yahoo) expect an unsubscribe affordance; its
        # presence also improves inbox placement.
        msg.extra_headers["List-Unsubscribe"] = f"<mailto:{settings.DEFAULT_FROM_EMAIL}?subject=unsubscribe>"
        try:
            msg.send(fail_silently=False)
            sent += 1
        except Exception:
            continue
    return sent
