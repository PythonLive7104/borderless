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


def resolve_customer_id(account, access_token):  # pragma: no cover - live only
    """The Ads account id to act on. Uses the stored one; if blank, asks Google
    which accounts this grant can reach and stores the single one it finds.

    A grant with several accessible accounts is ambiguous — we don't guess which
    campaign's advertiser you meant — so that case is surfaced as an error for an
    operator to resolve (set_google_ads_customer), rather than acting on a coin
    flip against someone's ad spend.
    """
    from . import googleads, googleads_api
    if account.customer_id:
        return googleads.normalize_customer_id(account.customer_id)
    customers = googleads_api.list_accessible_customers(access_token)
    if len(customers) == 1:
        account.customer_id = customers[0]
        account.save(update_fields=["customer_id"])
        return customers[0]
    if not customers:
        raise RuntimeError("This Google login can't reach any Ads accounts.")
    raise RuntimeError(
        f"This login can reach {len(customers)} Ads accounts; set which one with "
        f"`manage.py set_google_ads_customer`.")


def _mutate(account, campaign_id, add, remove):  # pragma: no cover - live only
    """Write the exclusion diff to the campaign, via the REST client.

    Reached only when GOOGLE_ADS_LIVE_PUSH is on (see apply). It is marked
    no-cover because it cannot run without a real account; the parts that CAN be
    tested — the diff (apps.traffic.exclusions) and the operation builder
    (googleads_api.build_operations) — are tested in isolation. When you first
    enable live push, test THIS against a Google *test* account before any real
    campaign; report the exact API error back and it is almost always a version
    or header fix in googleads_api, not a logic change.

    Removals are addressed by resource name, not by value, so the campaign's
    current IP exclusions are read first to map value -> resource name. An `add`
    that is already present is skipped (a no-op is free; a remove+add is two
    operations and a window where the click is billed again).
    """
    from . import googleads_api

    access_token = googleads_api.access_token_for(account)
    customer_id = resolve_customer_id(account, access_token)

    present = googleads_api.existing_ip_blocks(access_token, customer_id, campaign_id)
    to_add = [ip for ip in add if ip not in present]
    remove_resource_names = [present[ip] for ip in remove if ip in present]

    if not to_add and not remove_resource_names:
        return {"customer_id": customer_id, "added": 0, "removed": 0,
                "note": "Already in sync — nothing to change."}

    operations = googleads_api.build_operations(
        customer_id, campaign_id, to_add, remove_resource_names)
    result = googleads_api.mutate_campaign_criteria(access_token, customer_id, operations)

    return {"customer_id": customer_id,
            "added": len(to_add), "removed": len(remove_resource_names),
            "results": len((result or {}).get("results", []))}
