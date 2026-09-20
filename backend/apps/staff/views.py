from django.contrib.auth import get_user_model
from django.db.models import Count
from rest_framework import views
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from apps.organizations.models import Organization, OrganizationMember
from apps.websites.models import Website
from apps.campaigns.models import Campaign
from apps.traffic.models import TrafficEvent, Conversion
from apps.billing.models import Subscription, Plan
from apps.integrations.models import APIKey

User = get_user_model()


class AdminOverviewView(views.APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        subs = Subscription.objects.exclude(status="canceled").select_related("plan")
        mrr = sum(s.plan.price for s in subs)
        by_plan = {}
        for s in subs:
            by_plan[s.plan.name] = by_plan.get(s.plan.name, 0) + 1
        return Response({
            "users": User.objects.count(),
            "organizations": Organization.objects.count(),
            "active_subscriptions": subs.count(),
            "mrr": mrr,
            "events_processed": TrafficEvent.objects.count(),
            "conversions": Conversion.objects.count(),
            "websites": Website.objects.count(),
            "campaigns": Campaign.objects.count(),
            "api_keys": APIKey.objects.filter(revoked=False).count(),
            "subscriptions_by_plan": by_plan,
        })


class AdminUsersView(views.APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        users = User.objects.annotate(orgs=Count("memberships")).order_by("-date_joined")[:200]
        return Response([{
            "id": u.id, "email": u.email, "name": f"{u.first_name} {u.last_name}".strip(),
            "is_verified": u.is_verified, "is_staff": u.is_staff,
            "orgs": u.orgs, "date_joined": u.date_joined,
        } for u in users])


class AdminOrgsView(views.APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        orgs = (Organization.objects.select_related("owner")
                .annotate(member_count=Count("members", distinct=True), site_count=Count("websites", distinct=True))
                .order_by("-created_at")[:200])
        subs = {s.organization_id: s for s in Subscription.objects.select_related("plan")}
        out = []
        for o in orgs:
            sub = subs.get(o.id)
            out.append({
                "id": o.id, "name": o.name, "owner": o.owner.email,
                "members": o.member_count, "websites": o.site_count,
                "plan": sub.plan.name if sub else "—", "status": sub.status if sub else "—",
                "created_at": o.created_at,
            })
        return Response(out)


class AdminSubscriptionsView(views.APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        subs = (Subscription.objects
                .select_related("plan", "organization", "organization__owner")
                .order_by("-created_at")[:300])
        out = []
        for s in subs:
            access = s.access_state()
            out.append({
                "id": s.id,
                "organization_id": s.organization_id,
                "organization": s.organization.name,
                "owner": s.organization.owner.email if s.organization.owner else "—",
                "plan": s.plan.name, "price": s.plan.price,
                "status": s.status,
                "locked": access["locked"], "reason": access["reason"],
                "trial_end": s.trial_end,
                "created_at": s.created_at,
            })
        return Response(out)


class AdminFraudAlertsView(views.APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = (TrafficEvent.objects.filter(classification__in=["bot", "fraud"])
              .select_related("website", "website__organization", "visitor")
              .order_by("-created_at")[:200])
        out = []
        for e in qs:
            out.append({
                "id": e.id,
                "organization": e.website.organization.name,
                "website": e.website.name,
                "visitor": e.visitor.visitor_id,
                "ip": e.ip or "", "country": e.country or "",
                "classification": e.classification, "risk_score": e.risk_score,
                "action": e.action, "signals": e.signals,
                "created_at": e.created_at,
            })
        return Response(out)


class AdminGrantPlanView(views.APIView):
    """Staff can put any workspace on any plan (active), bypassing payment."""
    permission_classes = [IsAdminUser]

    def post(self, request):
        from apps.billing.views import _get_subscription, _activate
        org_id = request.data.get("organization")
        plan = Plan.objects.filter(slug=request.data.get("plan")).first()
        if not org_id or not plan:
            return Response({"detail": "organization and a valid plan are required."}, status=400)
        sub = _get_subscription(org_id)
        if not sub:
            return Response({"detail": "Workspace not found."}, status=404)
        _activate(sub, plan)
        return Response({"detail": f"Granted {plan.name} to this workspace.",
                         "plan": plan.name, "status": sub.status})


class AdminEmailPreviewView(views.APIView):
    """Return the fully-wrapped HTML for a composed email so the admin can see
    exactly what recipients will get, before sending anything."""
    permission_classes = [IsAdminUser]

    def post(self, request):
        from apps.staff.mailer import render_email
        subject = (request.data.get("subject") or "").strip()
        body = request.data.get("body_html") or ""
        html, text = render_email(subject, body)
        return Response({"html": html, "text": text})


class AdminEmailSendView(views.APIView):
    """Send a composed email to a chosen audience. Modes:
      test   -> just the requesting admin (always safe to try)
      users  -> every registered user
      leads  -> Bot Check leads who haven't converted
      custom -> an explicit comma/space/newline-separated list
    """
    permission_classes = [IsAdminUser]

    def post(self, request):
        from apps.staff.mailer import send_broadcast
        subject = (request.data.get("subject") or "").strip()
        body = request.data.get("body_html") or ""
        mode = request.data.get("mode") or "test"
        if not subject or not body.strip():
            return Response({"detail": "Subject and body are required."}, status=400)

        if mode == "test":
            recipients = [request.user.email]
        elif mode == "users":
            recipients = list(User.objects.exclude(email="")
                              .values_list("email", flat=True))
        elif mode == "leads":
            from apps.intelligence.models import BotCheckLead
            recipients = list(BotCheckLead.objects.filter(converted=False)
                              .values_list("email", flat=True).distinct())
        elif mode == "custom":
            import re as _re
            raw = request.data.get("emails") or ""
            recipients = [e for e in _re.split(r"[\s,;]+", raw) if e]
        else:
            return Response({"detail": "Unknown audience."}, status=400)

        # De-duplicate while preserving order; guard against an empty audience.
        seen, unique = set(), []
        for e in recipients:
            el = e.strip().lower()
            if el and el not in seen:
                seen.add(el)
                unique.append(el)
        if not unique:
            return Response({"detail": "No recipients for that audience."}, status=400)

        sent = send_broadcast(subject, body, unique)
        return Response({"ok": True, "sent": sent, "recipients": len(unique)})
