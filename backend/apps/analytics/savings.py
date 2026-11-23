"""Estimate the ad spend a workspace is protecting — the number that makes a
customer renew.

Detection counts and quality percentages are what the product measures, but they
are not what a buyer feels. "We caught 1,240 invalid clicks" lands far softer
than "that's about $3,100 of ad spend we kept from being wasted." This turns the
one into the other, honestly.

The honesty is the whole point, because the category is full of inflated savings
claims:

  * We count only PAID clicks. A bot on organic traffic cost the advertiser
    nothing, so it is not savings — including it would flatter the figure with
    traffic that was never billed.
  * We count only paid clicks we scored as INVALID (suspicious / bot / fraud).
    A real customer who clicked an ad is not waste.
  * The dollar figure is an ESTIMATE, labelled as one, equal to invalid paid
    clicks times the workspace's own average CPC — a number the customer enters
    (or that a connected ad account provides). With no CPC we return the count
    and no dollars, rather than guess a price.
  * It is "waste identified / prevented going forward", never "recovered". A
    block does not refund a click already billed, and the copy built on this
    must not imply it does.
"""
from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, Q
from django.utils import timezone

# What counts as an invalid (wasted) paid click.
INVALID_CLASSES = ("suspicious", "bot", "fraud")


def savings_for(organization_id, days=30, website_id=None) -> dict:
    """Estimate protected ad spend for a workspace over the last `days`.

    Returns the real counts always, and a dollar estimate only when the
    workspace has an average CPC set.
    """
    from apps.organizations.models import Organization
    from apps.traffic.models import TrafficEvent
    from apps.websites.models import Website

    since = timezone.now() - timedelta(days=days)
    site_ids = list(Website.objects.filter(organization_id=organization_id, is_system=False)
                    .values_list("id", flat=True))
    if website_id:
        site_ids = [website_id] if int(website_id) in site_ids else []

    # One scan of the period's PAID-click events, split by whether we scored
    # them invalid. Verified ad-review bots are excluded: a platform's own
    # landing-page reviewer arrives through the ad (so it looks like a paid
    # click) and scores as automated, but it is not fraud and must not pad the
    # "wasted spend" figure. `is_reviewer` is the indexed flag for exactly those;
    # search crawlers arrive organically and are already out via is_paid_click.
    events = (TrafficEvent.objects
              .filter(website_id__in=site_ids, created_at__gte=since,
                      session__is_paid_click=True)
              .exclude(is_reviewer=True))

    paid_clicks = events.values("session").distinct().count()
    invalid = (events.filter(classification__in=INVALID_CLASSES)
               .values("session").distinct().count())
    # Of those, the ones protection actually acted on (not just flagged).
    blocked = (events.filter(classification__in=INVALID_CLASSES)
               .exclude(action="allow").exclude(action="")
               .values("session").distinct().count())

    org = Organization.objects.filter(pk=organization_id).first()
    cpc = org.avg_cpc if org and org.avg_cpc is not None else None

    estimated = None
    if cpc is not None:
        estimated = float((Decimal(invalid) * cpc).quantize(Decimal("0.01")))

    pct_invalid = round(invalid / paid_clicks, 4) if paid_clicks else 0.0

    return {
        "days": days,
        "paid_clicks": paid_clicks,
        "invalid_paid_clicks": invalid,
        "blocked_paid_clicks": blocked,
        "invalid_rate": pct_invalid,
        "avg_cpc": float(cpc) if cpc is not None else None,
        "estimated_savings": estimated,
        # The assumption, in words, so the figure is never a black box.
        "basis": (f"{invalid} invalid paid clicks x ${float(cpc):.2f} average CPC"
                  if cpc is not None else
                  "Set your average cost-per-click to see the dollar estimate."),
        "has_cpc": cpc is not None,
    }
