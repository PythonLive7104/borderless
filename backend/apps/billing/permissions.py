"""Server-side half of the access gate.

The React AccessGate only hides the dashboard; anyone with a token could still
drive the REST API directly after their week ran out. This refuses the writes.

Reads stay open on purpose: a locked workspace must still be able to load its
billing page and see its own data to decide whether to renew, and we never want
a billing edge case to be the reason someone can't reach the checkout. What the
lock removes is the ability to *use* the product — create or change sites, rules,
campaigns, links and API keys — while revoke_org() simultaneously withdraws the
live protection and redirects from the engine.
"""
from rest_framework.permissions import SAFE_METHODS, BasePermission

from .entitlements import workspace_locked

MESSAGE = ("Your access period has ended. Renew your plan on the Billing page "
           "to keep using this workspace.")


def _target_org(request, view):
    """The organization this request would write to, if we can tell."""
    for source in (request.data if hasattr(request, "data") else None, request.query_params):
        if not source:
            continue
        try:
            org = source.get("organization")
        except AttributeError:
            continue
        if org:
            return org
    obj_org = getattr(getattr(view, "_gate_instance", None), "organization_id", None)
    return obj_org


class HasWorkspaceAccess(BasePermission):
    """Blocks writes for a workspace outside its paid/trial window."""
    message = MESSAGE

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        org_id = _target_org(request, view)
        if not org_id:
            return True   # can't attribute it; object-level check still runs
        return not workspace_locked(org_id)

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        org_id = getattr(obj, "organization_id", None)
        if org_id is None:
            return True
        return not workspace_locked(org_id)
