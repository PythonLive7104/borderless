from django.utils import timezone
from rest_framework import views
from rest_framework.response import Response

from apps.organizations.models import OrganizationMember
from apps.traffic.models import TrafficEvent
from .models import Plan, Subscription
from .serializers import PlanSerializer, SubscriptionSerializer


def _membership(user, org_id):
    return OrganizationMember.objects.filter(organization_id=org_id, user=user).first()


def _get_subscription(org_id):
    sub = Subscription.objects.filter(organization_id=org_id).select_related("plan").first()
    if not sub:  # lazily create for orgs that predate billing
        basic = Plan.objects.filter(slug="basic").first()
        if basic:
            sub = Subscription.objects.create(organization_id=org_id, plan=basic)
    return sub


class PlanListView(views.APIView):
    def get(self, request):
        return Response(PlanSerializer(Plan.objects.all(), many=True).data)


class SubscriptionView(views.APIView):
    def get(self, request):
        org_id = request.query_params.get("organization")
        if not _membership(request.user, org_id):
            return Response({"detail": "Not a member."}, status=403)
        sub = _get_subscription(org_id)
        return Response(SubscriptionSerializer(sub).data)


class ChangePlanView(views.APIView):
    def post(self, request):
        org_id = request.data.get("organization")
        m = _membership(request.user, org_id)
        if not m or not m.can_manage:
            return Response({"detail": "Only Owners and Admins can change the plan."}, status=403)
        plan = Plan.objects.filter(slug=request.data.get("plan")).first()
        if not plan:
            return Response({"detail": "Unknown plan."}, status=400)
        interval = (request.data.get("interval") or "").lower() or None
        if interval and interval not in INTERVAL_DAYS:
            return Response({"detail": "Interval must be 'weekly' or 'monthly'."}, status=400)
        sub = _get_subscription(org_id)
        sub.start_period(plan, interval)  # rollover-aware; payment stubbed for the MVP
        sub.save(update_fields=["plan", "status", "interval", "period_start", "period_end",
                                "pending_plan_slug", "pending_interval"])
        return Response(SubscriptionSerializer(sub).data)


class CancelView(views.APIView):
    def post(self, request):
        org_id = request.data.get("organization")
        m = _membership(request.user, org_id)
        if not m or not m.can_manage:
            return Response({"detail": "Only Owners and Admins can cancel."}, status=403)
        sub = _get_subscription(org_id)
        sub.status = Subscription.Status.CANCELED
        sub.save(update_fields=["status"])
        return Response(SubscriptionSerializer(sub).data)


class UsageView(views.APIView):
    def get(self, request):
        org_id = request.query_params.get("organization")
        if not _membership(request.user, org_id):
            return Response({"detail": "Not a member."}, status=403)
        sub = _get_subscription(org_id)
        start, end = sub.current_period()
        used = TrafficEvent.objects.filter(website__organization_id=org_id, created_at__gte=start, created_at__lt=end).count()
        limit = sub.plan.monthly_events
        pct = round(used / limit, 4) if limit else 0
        members = OrganizationMember.objects.filter(organization_id=org_id).count()

        # Website / campaign counts vs. their limits. Trial caps at 1/1; paid
        # plans are uncapped here (limit 0 = unlimited, same convention as team).
        from apps.websites.models import Website
        from apps.campaigns.models import Campaign
        from apps.links.models import ShortLink
        from .models import is_on_trial, website_limit, campaign_limit, redirect_limit
        on_trial = is_on_trial(org_id)
        n_sites = Website.objects.filter(organization_id=org_id).count()
        n_campaigns = Campaign.objects.filter(website__organization_id=org_id).count()
        n_redirects = ShortLink.objects.filter(organization_id=org_id).count()

        level = "ok"
        if pct >= 1.0:
            level = "critical"
        elif pct >= 0.85:
            level = "warning"
        elif pct >= 0.70:
            level = "notice"

        return Response({
            "period": {"start": start, "end": end},
            "events": {"used": used, "limit": limit, "pct": pct, "remaining": max(limit - used, 0), "level": level},
            "team": {"used": members, "limit": sub.plan.team_members},
            "websites": {"used": n_sites, "limit": website_limit(org_id)},
            "domains": {"used": n_sites, "limit": website_limit(org_id)},
            "campaigns": {"used": n_campaigns, "limit": campaign_limit(org_id)},
            "redirects": {"used": n_redirects, "limit": redirect_limit(org_id) or sub.plan.max_redirects},
            "on_trial": on_trial,
            "retention_days": sub.plan.retention_days,
            "plan": PlanSerializer(sub.plan).data,
        })


# ---- Bachs (bachs.io) payment integration ----
import json

from django.conf import settings
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import permissions

from django.core.mail import send_mail

from . import bachs
from .entitlements import restore_org
from .models import INTERVAL_DAYS, MONTHLY, WEEKLY


def _notify_activation(sub, plan):
    """Email the workspace owner that their subscription is active. Never blocks
    activation — mail failures are swallowed (fail_silently)."""
    owner = getattr(sub.organization, "owner", None)
    email = getattr(owner, "email", "")
    if not email:
        return
    start, end = sub.current_period()
    send_mail(
        f"Your {plan.name} plan is active",
        (
            f"Thanks for subscribing to {settings.BRAND_NAME}.\n\n"
            f"Plan: {plan.name} (${plan.price_for(sub.interval)}/{'month' if sub.interval == MONTHLY else 'week'})\n"
            f"Included: {plan.max_redirects or '∞'} redirects, "
            f"{plan.max_websites or '∞'} domains.\n"
            f"Access through: {end:%b %d, %Y} ({sub.period_days}-day access; unused days roll over when you renew)\n\n"
            f"Manage your subscription any time at {settings.FRONTEND_URL}/dashboard/billing"
        ),
        settings.DEFAULT_FROM_EMAIL,
        [email],
        fail_silently=True,
    )


def _activate(sub, plan, interval=None):
    sub.start_period(plan, interval)  # plan + interval, rolling unused days over
    sub.save(update_fields=["plan", "status", "interval", "period_start", "period_end",
                            "pending_plan_slug", "pending_interval"])
    # Put the engine keys back immediately — a renewal shouldn't wait for the
    # hourly enforce_access run to start protecting traffic again.
    restore_org(sub.organization_id)
    _notify_activation(sub, plan)


class CheckoutView(views.APIView):
    """Start an upgrade. Free plans activate instantly. When Bachs is configured
    and the target plan has a Bachs product, we return a hosted checkout URL for
    the browser to redirect to; the webhook activates the plan after payment.
    When Bachs is not configured (dev), we activate immediately (stub)."""

    def post(self, request):
        org_id = request.data.get("organization")
        m = _membership(request.user, org_id)
        if not m or not m.can_manage:
            return Response({"detail": "Only Owners and Admins can change the plan."}, status=403)
        plan = Plan.objects.filter(slug=request.data.get("plan")).first()
        if not plan:
            return Response({"detail": "Unknown plan."}, status=400)

        interval = (request.data.get("interval") or WEEKLY).lower()
        if interval not in INTERVAL_DAYS:
            return Response({"detail": "Interval must be 'weekly' or 'monthly'."}, status=400)
        if not plan.offers(interval):
            return Response({"detail": f"{plan.name} isn't available on {interval} billing."}, status=400)

        sub = _get_subscription(org_id)
        product_id = plan.product_for(interval)

        if plan.price_for(interval) == 0 or not bachs.is_enabled() or not product_id:
            _activate(sub, plan, interval)  # dev stub / free plan
            return Response({"activated": True, **SubscriptionSerializer(sub).data})

        front = settings.FRONTEND_URL.rstrip("/")
        data, err = bachs.create_checkout_session(
            product_id=product_id,
            email=request.user.email,
            return_url=f"{front}/dashboard/billing?checkout=success",
            cancel_url=f"{front}/dashboard/billing?checkout=cancelled",
            metadata={"organization_id": str(org_id), "plan_slug": plan.slug,
                      "interval": interval},
        )
        if err:
            return Response({"detail": err}, status=502)
        checkout_url = data.get("checkout_url") or data.get("url") or data.get("redirect_url")
        session_id = data.get("id") or data.get("session_id") or ""
        # Remember what they're buying so the webhook can activate it even if
        # Bachs doesn't echo our metadata back.
        sub.bachs_session_id = session_id
        sub.pending_plan_slug = plan.slug
        sub.pending_interval = interval
        sub.save(update_fields=["bachs_session_id", "pending_plan_slug", "pending_interval"])
        if not checkout_url:
            return Response({"detail": "Bachs did not return a checkout URL.", "raw": data}, status=502)
        return Response({"checkout_url": checkout_url})


def _find_metadata(event: dict) -> dict:
    """Locate our checkout metadata in the webhook body. CONFIRM the exact path
    against a real Bachs event; we check the common nestings defensively."""
    for path in (("metadata",), ("data", "metadata"), ("data", "object", "metadata")):
        node = event
        ok = True
        for k in path:
            if isinstance(node, dict) and k in node:
                node = node[k]
            else:
                ok = False
                break
        if ok and isinstance(node, dict):
            return node
    return {}


def _find_session_id(event: dict) -> str:
    """Find the Bachs checkout/collection id in the webhook body — used to match
    the subscription we saved it against at checkout."""
    for path in (("id",), ("data", "id"), ("data", "object", "id"),
                 ("data", "checkout_session_id"), ("checkout_session_id",), ("session_id",)):
        node = event
        ok = True
        for k in path:
            if isinstance(node, dict) and k in node:
                node = node[k]
            else:
                ok = False
                break
        if ok and isinstance(node, str) and node:
            return node
    return ""


@method_decorator(csrf_exempt, name="dispatch")
class BachsWebhookView(views.APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        raw = request.body
        sig = (
            request.headers.get("Bachs-Signature")
            or request.headers.get("X-Bachs-Signature")
            or request.headers.get("Webhook-Signature")
            or ""
        )
        if not bachs.verify_signature(raw, sig):
            return Response({"detail": "Invalid signature."}, status=400)
        try:
            event = json.loads(raw.decode())
        except Exception:
            return Response({"detail": "Bad payload."}, status=400)

        import logging
        log = logging.getLogger("bachs")
        etype = (event.get("type") or event.get("event") or "").lower()
        meta = _find_metadata(event)
        session_id = _find_session_id(event)

        # A successful payment, matched defensively across Bachs's event names
        # (collection.succeeded / checkout.completed / *.paid, but not *.failed).
        paid = any(k in etype for k in ("succeeded", "completed", "paid")) and "fail" not in etype
        if not paid:
            log.info("bachs webhook: ignoring event type=%s", etype)
            return Response({"received": True})

        # Find the subscription: prefer our metadata org id, else the checkout
        # session id we saved. Find the plan: metadata, else the pending plan.
        sub = _get_subscription(meta["organization_id"]) if meta.get("organization_id") else None
        if not sub and session_id:
            sub = Subscription.objects.filter(bachs_session_id=session_id).first()
        plan_slug = meta.get("plan_slug") or (sub.pending_plan_slug if sub else "")
        plan = Plan.objects.filter(slug=plan_slug).first() if plan_slug else None
        interval = (meta.get("interval") or (sub.pending_interval if sub else "") or WEEKLY).lower()
        if interval not in INTERVAL_DAYS:
            interval = WEEKLY

        if sub and plan:
            _activate(sub, plan, interval)
            log.info("bachs webhook: activated org=%s plan=%s interval=%s (type=%s)",
                     sub.organization_id, plan.slug, interval, etype)
        else:
            log.warning("bachs webhook: could NOT activate — type=%s sub_found=%s plan_slug=%r session=%r",
                        etype, bool(sub), plan_slug, session_id)
        return Response({"received": True})
