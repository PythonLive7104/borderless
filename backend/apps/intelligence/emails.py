"""The 48-hour Bot Check follow-up email.

Sent two days after someone scans their site and leaves their email. The first
email delivered their report; this one converts: it reminds them of what they
saw, reframes exposure as wasted ad spend, and drives to live monitoring (which
needs the tracker = signup). HTML is table-based with inline styles so it
renders across email clients; a plain-text alternative is always included.
"""
from django.conf import settings

BRAND = "#2563eb"
VIOLET = "#7c3aed"
INK = "#0f172a"
MUTED = "#64748b"


def _front() -> str:
    return getattr(settings, "FRONTEND_URL", "https://trynobot.com").rstrip("/")


def _grade_line(grade: str) -> str:
    """One adaptive sentence: urgency for a poor grade, vigilance for a good one."""
    g = (grade or "").upper()
    if g in ("D", "F"):
        return "A grade like that means automated traffic is very likely reaching your pages — and if you run ads, paying for clicks that will never convert."
    if g == "C":
        return "A middling grade means bots still have room to get through — and on paid traffic, that's budget quietly leaking every day."
    if g in ("A", "B"):
        return "Even a strong grade only measures what's visible from outside. The bots that cost you most are the ones that look human until you score them."
    return "Bots that reach your pages waste real money — most on ad clicks that never had a chance to convert."


def followup_email(lead):
    """Return (subject, text, html) for a lead's 48h follow-up."""
    front = _front()
    signup = f"{front}/signup"
    url = lead.url
    grade = (lead.grade or "?").upper()
    exposure = lead.exposure or 0
    subject = f"Still paying for bots on {url}?"

    text = (
        f"Two days ago you scanned {url} with TryNoBot's free Bot Check.\n\n"
        f"Exposure grade: {grade} (score {exposure}/100)\n\n"
        f"{_grade_line(grade)}\n\n"
        f"That scan only reads what's visible from outside. To see the real "
        f"picture — how many of your actual visitors and ad clicks are bots, "
        f"scored in real time — add the free TryNoBot tracker to your site:\n\n"
        f"{signup}\n\n"
        f"One script tag, a few minutes, no credit card. Reply to this email if "
        f"you'd like a hand setting it up.\n\n"
        f"— TryNoBot\n"
        f"{front}\n"
    )

    html = f"""\
<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px -12px rgba(15,23,42,.25);">

        <!-- header -->
        <tr><td style="background:linear-gradient(135deg,{BRAND},{VIOLET});padding:22px 28px;">
          <span style="color:#fff;font-size:18px;font-weight:800;letter-spacing:-.02em;">TryNoBot</span>
        </td></tr>

        <!-- body -->
        <tr><td style="padding:32px 28px 8px;">
          <p style="margin:0 0 6px;color:{MUTED};font-size:13px;">Your free scan, 2 days ago</p>
          <h1 style="margin:0 0 16px;color:{INK};font-size:24px;font-weight:800;line-height:1.25;">
            Is <span style="color:{BRAND};">{url}</span> still paying for bots?
          </h1>

          <!-- grade chip -->
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;">
            <tr>
              <td style="background:{INK};color:#fff;font-size:28px;font-weight:800;width:56px;height:56px;text-align:center;border-radius:12px;">{grade}</td>
              <td style="padding-left:14px;color:{MUTED};font-size:14px;line-height:1.5;">
                Bot exposure grade<br><span style="color:{INK};font-weight:700;">Score {exposure}/100</span>
              </td>
            </tr>
          </table>

          <p style="margin:0 0 16px;color:{INK};font-size:15px;line-height:1.6;">{_grade_line(grade)}</p>
          <p style="margin:0 0 24px;color:{INK};font-size:15px;line-height:1.6;">
            That scan only reads what's visible from outside. The real number —
            how many of your <b>actual</b> visitors and ad clicks are automated —
            shows up only once you score live traffic. That's what the tracker does.
          </p>

          <!-- CTA -->
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
            <tr><td style="border-radius:999px;background:{BRAND};">
              <a href="{signup}" style="display:inline-block;padding:14px 30px;color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:999px;">See your live bot traffic — free</a>
            </td></tr>
          </table>

          <p style="margin:0 0 28px;color:{MUTED};font-size:13px;line-height:1.6;">
            One script tag, a few minutes, no credit card. Just reply if you'd like a hand setting it up — a real person reads these.
          </p>
        </td></tr>

        <!-- footer -->
        <tr><td style="padding:18px 28px;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:{MUTED};font-size:12px;line-height:1.6;">
            You're getting this because you ran a free Bot Check on {url}.
            <a href="{front}" style="color:{BRAND};text-decoration:none;">trynobot.com</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""
    return subject, text, html
