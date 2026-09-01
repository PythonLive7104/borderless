from django.contrib.auth import get_user_model
from django.db.models import Count
from rest_framework import views
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from apps.organizations.models import Organization, OrganizationMember
from apps.websites.models import Website
from apps.campaigns.models import Campaign
from apps.traffic.models import TrafficEvent, Conversion
from apps.billing.models import Subscription
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
