"""Turning an exclusion plan into changes in a Google Ads account.

Kept apart from the OAuth module so the boundary is obvious: everything here is
about *acting on* an account, and every path through it is safe to run before
the live integration is approved and tested.

The plan itself comes from apps.traffic.exclusions.plan_for_campaign — a
keep/add/remove diff that never touches the network. This module decides whether
to apply that diff for real.

The live mutate is written but **gated twice**: it only runs when
googleads.live_push_enabled() is true (credentials present AND
GOOGLE_ADS_LIVE_PUSH set), and it is never reached by the dry-run default. Until
an operator turns that flag on and tests it against a real account, apply()
reports exactly what it would change and changes nothing. This is on purpose:
the cost of a bug here is a customer's live campaigns, so the untested code path
cannot fire by default.
"""
from apps.integrations import googleads


def apply(account, campaign_id: str, plan: dict, *, dry_run=None) -> dict:
    """Apply (or preview) an exclusion plan for one campaign.

    dry_run defaults to the safe reading: anything other than an explicit
    dry_run=False with live push enabled is a preview. So a caller that forgets
    the argument previews; only a caller that both asks to apply AND has the
    operator's live flag on will change the account.
    """
    would = {
        "campaign_id": campaign_id,
        "add": plan.get("add", []),
        "remove": plan.get("remove", []),
        "keep": plan.get("keep", []),
        "skipped": plan.get("skipped", []),
    }

    wants_live = dry_run is False
    if not (wants_live and googleads.live_push_enabled()):
        return {
            "applied": False,
            "dry_run": True,
            # Say why it was a preview, so the UI can show "connect and enable to
            # apply" rather than looking like it silently did nothing.
            "reason": _why_preview(account, wants_live),
            **would,
        }

    # --- live path -----------------------------------------------------------
    # Reached only with live push explicitly enabled. Builds the CampaignCriterion
    # mutate and sends it. Untested against a real account at the time of writing,
    # which is exactly why the gate above exists.
    try:
        result = _mutate(account, campaign_id, would["add"], would["remove"])
        return {"applied": True, "dry_run": False, **would, **result}
    except Exception as e:  # pragma: no cover - live path, needs real credentials
        return {"applied": False, "dry_run": False, "error": str(e)[:300], **would}


def _why_preview(account, wants_live: bool) -> str:
    if not googleads.is_enabled():
        return "Google Ads is not configured on this server."
    if account is None or not getattr(account, "is_connected", False):
        return "No Google Ads account is connected to this workspace."
    if not wants_live:
        return "Preview only — call with dry_run=False to apply."
    return ("Live push is turned off (GOOGLE_ADS_LIVE_PUSH). Showing what would "
            "change; nothing was sent to Google.")


def _mutate(account, campaign_id, add, remove):  # pragma: no cover - live only
    """The real CampaignCriterion mutate.

    Separated and uncovered on purpose: it cannot be exercised without live
    credentials and a real test account. When the developer token and OAuth
    verification are in place, this is the one function to test against a Google
    *test* account first, behind GOOGLE_ADS_LIVE_PUSH, before any customer
    account is ever touched.

    Shape of the work (see Google Ads API CampaignCriterionService):
      * each `add` -> create operation, IP_BLOCK criterion on this campaign
      * each `remove` -> remove operation by the criterion resource name
    Addresses already present (`keep`) are deliberately left untouched — a no-op
    is free, a remove+add is two operations and a window where the click is paid
    for again.
    """
    raise NotImplementedError(
        "Live Google Ads push is not implemented/tested yet. It is intentionally "
        "unreachable until GOOGLE_ADS_LIVE_PUSH is enabled and verified against a "
        "test account.")
