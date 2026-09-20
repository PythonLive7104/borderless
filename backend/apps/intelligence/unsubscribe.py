"""One-click unsubscribe for Bot Check follow-up mail.

Every commercial email we send has to carry a working opt-out that keeps
working for at least 60 days (CASL s.11, and the Spam Act 2003 / CAN-SPAM say
much the same). A signed token is the cheapest way to do that honestly: it
needs no session, no lookup table and no login, and it cannot be enumerated to
unsubscribe somebody else.

The link is also published as a List-Unsubscribe header so Gmail and Yahoo can
offer their own one-click opt-out — which is now a requirement for bulk
senders, and the difference between landing in the inbox and the spam folder.
"""
from django.conf import settings
from django.core import signing

SALT = "botcheck.unsubscribe"
# Deliberately no max_age on the read side: a stale opt-out link must still
# work. An expired one would silently do nothing and leave us mailing someone
# who tried to leave.
TOKEN_KEY = "t"


def make_token(lead) -> str:
    return signing.dumps({"lead": lead.pk, "email": lead.email}, salt=SALT)


def read_token(token: str):
    """Return the lead id encoded in `token`, or None if it isn't ours."""
    try:
        data = signing.loads(token, salt=SALT)
    except signing.BadSignature:
        return None
    return data.get("lead")


def unsubscribe_url(lead) -> str:
    base = getattr(settings, "FRONTEND_URL", "https://trynobot.com").rstrip("/")
    return f"{base}/api/v1/unsubscribe/?{TOKEN_KEY}={make_token(lead)}"
