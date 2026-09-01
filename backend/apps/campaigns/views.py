from django.db.models import Count
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.organizations.models import OrganizationMember
from .models import Campaign
from .serializers import CampaignSerializer


class CampaignViewSet(viewsets.ModelViewSet):
    serializer_class = CampaignSerializer

    def _member_org_ids(self):
        return OrganizationMember.objects.filter(user=self.request.user).values_list("organization_id", flat=True)

    def get_queryset(self):
        qs = Campaign.objects.filter(website__organization_id__in=self._member_org_ids()).select_related("website")
        org = self.request.query_params.get("organization")
        website = self.request.query_params.get("website")
        if org:
            qs = qs.filter(website__organization_id=org)
        if website:
            qs = qs.filter(website_id=website)
        return qs

    def _require_manager(self, org_id):
        m = OrganizationMember.objects.filter(organization_id=org_id, user=self.request.user).first()
        if not m or not m.can_manage:
            raise PermissionDenied("Only Owners and Admins can modify campaigns.")

    def perform_update(self, serializer):
        self._require_manager(serializer.instance.website.organization_id)
        serializer.save()

    def perform_destroy(self, instance):
        self._require_manager(instance.website.organization_id)
        instance.delete()

    @action(detail=True, methods=["get"])
    def stats(self, request, pk=None):
        campaign = self.get_object()
        events = campaign.matched_events()
        total = events.count()
        by_class = dict(
            events.exclude(classification="").values_list("classification")
            .annotate(n=Count("id")).values_list("classification", "n")
        )
        visitors = events.values("visitor").distinct().count()
        conversions = events.filter(type="conversion").count()
        good = by_class.get("human", 0)
        flagged = total - good
        return Response({
            "events": total,
            "visitors": visitors,
            "conversions": conversions,
            "by_classification": by_class,
            "quality": round(good / total, 4) if total else 0.0,
            "flagged": flagged,
        })

    @action(detail=True, methods=["get"], url_path="variant-stats")
    def variant_stats(self, request, pk=None):
        """Per-variant A/B results, derived from deterministic assignment over
        this campaign's human visitors (bots/fraud are excluded from the test)."""
        from apps.campaigns.assignment import assign as _assign
        campaign = self.get_object()
        variants = list(campaign.variants.all())
        events = campaign.matched_events().filter(classification="human")
        # one row per visitor: did they convert?
        visitors = {}
        for vid, is_conv in events.values_list("visitor__visitor_id", "type"):
            rec = visitors.setdefault(vid, {"conv": False})
            if is_conv == "conversion":
                rec["conv"] = True
        rows = {v.id: {"label": v.label, "weight": v.weight, "active": v.active,
                       "visitors": 0, "conversions": 0} for v in variants}
        for vid, rec in visitors.items():
            chosen = _assign(campaign.id, vid, variants)
            if not chosen:
                continue
            row = rows[chosen.id]
            row["visitors"] += 1
            if rec["conv"]:
                row["conversions"] += 1
        out = []
        for vid, row in rows.items():
            n = row["visitors"]
            row["id"] = vid
            row["cvr"] = round(row["conversions"] / n, 4) if n else 0.0
            out.append(row)
        return Response({"variants": out, "total_visitors": len(visitors)})

    @action(detail=True, methods=["post"], url_path="scan-url")
    def scan_url(self, request, pk=None):
        """Scan the campaign's destination URL for malware/phishing flags."""
        from apps.intelligence.threatscan import scan_url as _scan, is_enabled
        from django.utils import timezone as _tz
        campaign = self.get_object()
        self._require_manager(campaign.website.organization_id)
        if not campaign.destination_url:
            return Response({"detail": "This campaign has no destination URL to scan."}, status=400)
        if not is_enabled():
            return Response({
                "detail": "URL scanning is not configured. Add GOOGLE_SAFE_BROWSING_KEY "
                          "or VIRUSTOTAL_KEY to enable it.",
                "checked": False,
            }, status=200)
        result = _scan(campaign.destination_url)
        campaign.url_safe = result["safe"]
        campaign.url_threats = result["threats"]
        campaign.url_scanned_at = _tz.now()
        campaign.save(update_fields=["url_safe", "url_threats", "url_scanned_at"])
        return Response(result)


from .models import CampaignVariant
from .serializers import CampaignVariantSerializer
from .assignment import assign


class CampaignVariantViewSet(viewsets.ModelViewSet):
    serializer_class = CampaignVariantSerializer

    def _member_org_ids(self):
        return OrganizationMember.objects.filter(user=self.request.user).values_list("organization_id", flat=True)

    def get_queryset(self):
        qs = CampaignVariant.objects.filter(
            campaign__website__organization_id__in=self._member_org_ids()
        ).select_related("campaign")
        campaign = self.request.query_params.get("campaign")
        if campaign:
            qs = qs.filter(campaign_id=campaign)
        return qs

    def _require_manager(self, org_id):
        m = OrganizationMember.objects.filter(organization_id=org_id, user=self.request.user).first()
        if not m or not m.can_manage:
            raise PermissionDenied("Only Owners and Admins can modify variants.")

    def perform_update(self, serializer):
        self._require_manager(serializer.instance.campaign.website.organization_id)
        serializer.save()

    def perform_destroy(self, instance):
        self._require_manager(instance.campaign.website.organization_id)
        instance.delete()
