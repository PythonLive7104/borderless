"""What checkout can actually complete today.

The pricing and billing pages read this instead of hard-coding the answer.
Advertising a payment method checkout can't honour breaks the funnel at the
worst possible moment, and it's the kind of misrepresentation that gets an ad
account suspended rather than warned.

Both methods run through the same Bachs hosted checkout, so enabling card is a
merchant-side switch in the Bachs dashboard, not a code change here. Flip
BACHS_CARD_ENABLED once card is actually live on the account — and only then,
because this is what the public pricing page believes.
"""
from django.conf import settings

from . import bachs


def card_enabled() -> bool:
    return bool(getattr(settings, "BACHS_CARD_ENABLED", False))


def available():
    """Return the methods checkout can complete, most preferred first.

    Card leads when it's on: it's what a UK, US, Canadian or Australian buyer
    expects to see, and burying it under crypto costs conversions from exactly
    the market these plans are priced for.
    """
    methods = []
    if card_enabled():
        methods.append("card")
    # Bachs is the crypto processor. With no API key, dev stubs checkout out and
    # activates instantly — crypto is still the method being offered.
    methods.append("crypto")
    return methods


def fee_pct() -> float:
    """The processing fee Bachs adds on top of the plan price, as a percentage.

    Disclosed on the pricing page rather than sprung at checkout: advertising
    $70 and charging $73.90 is drip pricing, and it is the surprise at the
    payment step that loses the sale as much as the money.
    """
    return float(getattr(settings, "PAYMENT_FEE_PCT", 0) or 0)
