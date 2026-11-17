"""Decide whether a session began with a paid ad click, and on which network.

Why this exists: plans were metered in "events", while every competitor in the
category sells "ad clicks protected". A buyer comparing our $69 plan against
Fraud Blocker's $79 could not tell which was bigger, and when someone can't
compare they pick the name they recognise. This is the meter that makes the
pricing page legible.

Nothing new is collected to do it. The tracker already sends the full landing
URL (location.href), so the click identifiers are sitting in landing_url on
every session we've ever recorded, and existing rows can be backfilled.

Counting rule: ONE per session, not per event. A visitor who clicks an ad and
then reads eight pages is one ad click — which is how ClickCease and Fraud
Blocker count, and the whole point is to be comparable to them.
"""
from urllib.parse import parse_qs, urlsplit

# Click identifiers each network appends to the landing URL. Presence of one of
# these is near-conclusive: they are minted by the ad platform on the click.
#
# fbclid is deliberately ABSENT. Facebook appends it to organic shares too, so
# billing on it would charge customers for traffic they never paid for — the
# one failure mode that turns a metering change into a refund queue.
CLICK_IDS = {
    "gclid": "google_ads",
    "gbraid": "google_ads",      # iOS app->web, privacy-preserving
    "wbraid": "google_ads",      # iOS web->web
    "msclkid": "microsoft_ads",
    "ttclid": "tiktok_ads",
    "li_fat_id": "linkedin_ads",
    "twclid": "x_ads",
    "epik": "pinterest_ads",
    "dclid": "google_display",
    "srsltid": "google_shopping",
}

# utm_medium values that mean paid. Weaker evidence than a click id — anyone can
# type these by hand — but it's how a lot of real campaigns are tagged, and
# under-counting means giving the traffic away.
PAID_MEDIUMS = {
    "cpc", "ppc", "paid", "paidsearch", "paid_search", "paid-search",
    "paidsocial", "paid_social", "paid-social", "display", "cpm", "cpv",
    "banner", "retargeting", "remarketing",
}

UNKNOWN = "other_paid"

# Where the ad platform's own campaign id arrives, best first.
#
# Why this is needed at all: a Google Ads IP exclusion is a CampaignCriterion —
# it attaches to ONE campaign, by numeric id. utm_campaign is a name the
# advertiser typed, and `Campaign` in apps.campaigns is our own row keyed on
# that name; neither can address a campaign through the API. The gclid can be
# resolved to a campaign, but only by asking Google, which needs the developer
# token and a round trip per click.
#
# ValueTrack costs neither. The advertiser pastes a final-URL suffix once and
# Google substitutes the real id on every click, so it arrives in the landing
# URL the tracker already sends. Nothing new is collected and no API is called.
#
# `tnb_cid` is ours, so nothing else can collide with it. The rest are the
# names people already have in their URLs from other tools — read opportunisti-
# cally, because a customer who already tags campaigns should not have to redo
# it to turn this on.
CAMPAIGN_ID_PARAMS = ("tnb_cid", "campaignid", "campaign_id", "utm_campaign_id")

# Ad platform click ids we can later resolve to a campaign through the platform
# API, for customers who never add the suffix. Stored so that path stays open.
CLICK_ID_PARAMS = ("tnb_gid", "gclid", "gbraid", "wbraid", "msclkid")


def _first_param(params: dict, names) -> str:
    for name in names:
        for value in params.get(name, []):
            value = (value or "").strip()
            # ValueTrack leaves the literal braces in place when a parameter
            # does not apply to the click ("{campaignid}" on a non-ad visit),
            # and some setups ship the template to production by mistake.
            # Storing that would put a fake campaign id on real traffic.
            if value and "{" not in value and "}" not in value:
                return value[:40]
    return ""


def campaign_ref(landing_url: str = "") -> tuple:
    """(campaign_id, click_id) read from a landing URL. Both may be "".

    Pure parsing, no network. The campaign id is what an exclusion has to be
    addressed to; the click id is the fallback route for accounts that never
    added the suffix.
    """
    params = _params(landing_url or "")
    return _first_param(params, CAMPAIGN_ID_PARAMS), _first_param(params, CLICK_ID_PARAMS)


def _params(url: str) -> dict:
    try:
        return parse_qs(urlsplit(url).query, keep_blank_values=False)
    except Exception:
        return {}


def classify(landing_url: str = "", utm_medium: str = "", utm_source: str = ""):
    """Return (is_paid, platform) for a session's landing details.

    platform is "" when is_paid is False. A click id wins over utm_medium: it's
    the stronger signal and it names the network precisely.
    """
    params = _params(landing_url or "")
    for key, platform in CLICK_IDS.items():
        values = params.get(key)
        # An empty "?gclid=" is a copied URL, not a click — require a value.
        if values and any(v.strip() for v in values):
            return True, platform

    medium = (utm_medium or "").strip().lower()
    if not medium:
        # Some setups put the medium only in the URL, not in the tracker payload.
        medium = next((v.strip().lower() for v in params.get("utm_medium", []) if v.strip()), "")
    if medium in PAID_MEDIUMS:
        return True, _platform_from_source(utm_source, params)

    return False, ""


def _platform_from_source(utm_source: str, params: dict) -> str:
    """Best-effort network name when we only have a paid utm_medium."""
    source = (utm_source or "").strip().lower()
    if not source:
        source = next((v.strip().lower() for v in params.get("utm_source", []) if v.strip()), "")
    known = {
        "google": "google_ads", "adwords": "google_ads", "googleads": "google_ads",
        "bing": "microsoft_ads", "microsoft": "microsoft_ads",
        "facebook": "meta_ads", "fb": "meta_ads", "instagram": "meta_ads", "meta": "meta_ads",
        "tiktok": "tiktok_ads", "linkedin": "linkedin_ads",
        "twitter": "x_ads", "x": "x_ads", "pinterest": "pinterest_ads",
        "reddit": "reddit_ads", "taboola": "taboola", "outbrain": "outbrain",
    }
    return known.get(source, UNKNOWN)
