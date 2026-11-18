"""HTTP surface for the Google Ads integration.

Everything degrades cleanly when the feature is unconfigured: status reports
`enabled: false`, connect/callback 404, and the dry-run exclusion plan still
works because it reads only the workspace's own stored traffic — so a customer
can see the value ("here are the addresses we'd exclude") before any Google
credentials exist.
"""
from datetime import timedelta

from django.conf import settings
from django.shortcuts import redirect
from django.utils import timezone
from rest_framework import status, views
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.billing.permissions import HasWorkspaceAccess
from apps.organizations.models import OrganizationMember

from . import googleads
from .models import GoogleAdsAccount


def _member(user, org_id):
    return OrganizationMember.objects.filter(organization_id=org_id, user=user).first()


def _require_member(user, org_id):
    if not _member(user, org_id):
        raise PermissionDenied("Not a member of this workspace.")


def _require_manager(user, org_id):
    m = _member(user, org_id)
    if not m or not m.can_manage:
        raise PermissionDenied("Only Owners and Admins can manage integrations.")


def _front() -> str:
    return (getattr(settings, "FRONTEND_URL", "") or "").rstrip("/")


class GoogleAdsStatusView(views.APIView):
    """Is the feature available, and is this workspace connected?"""
    permission_classes = [IsAuthenticated, HasWorkspaceAccess]

    def get(self, request):
        org_id = request.query_params.get("organization")
        _require_member(request.user, org_id)
        acct = GoogleAdsAccount.objects.filter(organization_id=org_id).first()
        return Response({
            "enabled": googleads.is_enabled(),
            "live_push": googleads.live_push_enabled(),
            "connected": bool(acct and acct.is_connected),
            "customer_id": acct.customer_id if acct else "",
            "status": acct.status if acct else "",
            "connected_at": acct.connected_at if acct else None,
        })


class GoogleAdsConnectView(views.APIView):
    """Begin the OAuth flow: hand back the Google consent URL to open."""
    permission_classes = [IsAuthenticated, HasWorkspaceAccess]

    def get(self, request):
        org_id = request.query_params.get("organization")
        _require_manager(request.user, org_id)
        if not googleads.is_enabled():
            return Response({"detail": "Google Ads isn't configured on this server yet."},
                            status=status.HTTP_404_NOT_FOUND)
        state = googleads.make_state(org_id, request.user.id)
        return Response({"authorize_url": googleads.authorize_url(state)})


class GoogleAdsCallbackView(views.APIView):
    """Where Google returns the customer after they consent.

    AllowAny because the browser arrives here on a redirect from Google with no
    auth header — trust comes entirely from the signed `state`, which names the
    workspace and user and cannot be forged or replayed past its short lifetime.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        if not googleads.is_enabled():
            return redirect(f"{_front()}/dashboard/integrations?google_ads=disabled")

        err = request.query_params.get("error")
        if err:
            # The customer declined, or Google refused. Back to the dashboard
            # with a reason rather than a dead page.
            return redirect(f"{_front()}/dashboard/integrations?google_ads=denied")

        state = request.query_params.get("state", "")
        code = request.query_params.get("code", "")
        parsed = googleads.read_state(state)
        if not parsed or not code:
            return redirect(f"{_front()}/dashboard/integrations?google_ads=invalid")
        org_id, user_id = parsed

        # Still require that the user named in the state is a manager of that
        # workspace now — a grant does not override current permissions.
        m = OrganizationMember.objects.filter(organization_id=org_id, user_id=user_id).first()
        if not m or not m.can_manage:
            return redirect(f"{_front()}/dashboard/integrations?google_ads=forbidden")

        try:
            tokens = googleads.exchange_code(code)
        except Exception:
            return redirect(f"{_front()}/dashboard/integrations?google_ads=exchange_failed")

        refresh = tokens.get("refresh_token", "")
        access = tokens.get("access_token", "")
        if not refresh:
            # No refresh token means Google did not treat this as a fresh offline
            # grant (usually a re-consent without prompt=consent). Useless to us.
            return redirect(f"{_front()}/dashboard/integrations?google_ads=no_refresh")

        expires_in = int(tokens.get("expires_in", 3600) or 3600)
        GoogleAdsAccount.objects.update_or_create(
            organization_id=org_id,
            defaults={
                "refresh_token": refresh,
                "access_token": access,
                "token_expires_at": timezone.now() + timedelta(seconds=expires_in),
                "scopes": tokens.get("scope", googleads.SCOPE),
                "status": GoogleAdsAccount.Status.CONNECTED,
                "last_error": "",
                "connected_by_id": user_id,
                "connected_at": timezone.now(),
            },
        )
        return redirect(f"{_front()}/dashboard/integrations?google_ads=connected")


class GoogleAdsDisconnectView(views.APIView):
    permission_classes = [IsAuthenticated, HasWorkspaceAccess]

    def post(self, request):
        org_id = request.data.get("organization")
        _require_manager(request.user, org_id)
        acct = GoogleAdsAccount.objects.filter(organization_id=org_id).first()
        if acct:
            if acct.refresh_token:
                googleads.revoke(acct.refresh_token)   # best-effort at Google
            acct.delete()
        return Response({"connected": False})


class GoogleAdsExclusionPlanView(views.APIView):
    """The dry-run plan for one campaign: which IPs we'd exclude, and why.

    Works with or without a connected account, because it only reads the
    workspace's own stored traffic — so it is a sellable screen today, before
    any Google approval. Applying it (the live mutate) is a separate, flag-gated
    step in googleads_push.
    """
    permission_classes = [IsAuthenticated, HasWorkspaceAccess]

    def get(self, request):
        from apps.traffic import exclusions
        from apps.websites.models import Website

        org_id = request.query_params.get("organization")
        _require_member(request.user, org_id)
        campaign_id = (request.query_params.get("campaign_id") or "").strip()
        if not campaign_id:
            return Response({"detail": "A campaign_id is required."},
                            status=status.HTTP_400_BAD_REQUEST)

        website_ids = list(Website.objects.filter(organization_id=org_id)
                           .values_list("id", flat=True))
        plan = exclusions.plan_for_campaign(website_ids, campaign_id)
        return Response(plan)
