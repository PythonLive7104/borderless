import csv
from datetime import timedelta

from django.db.models import Count, Q, Max, Sum
from django.db.models.functions import TruncDate
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import generics, views
from rest_framework.response import Response

from apps.organizations.models import OrganizationMember
from apps.traffic.models import Visitor, TrafficEvent, Conversion
from .serializers import EventSerializer, VisitorSerializer

RANGES = {"today": 1, "7d": 7, "30d": 30, "90d": 90}


def _org_ids(user):
    return OrganizationMember.objects.filter(user=user).values_list("organization_id", flat=True)


def _events(user, params):
    qs = TrafficEvent.objects.filter(website__organization_id__in=_org_ids(user))
    if org := params.get("organization"):
        qs = qs.filter(website__organization_id=org)
    if website := params.get("website"):
        qs = qs.filter(website_id=website)
    return qs


def _days(params):
    return RANGES.get(params.get("range", "7d"), 7)


def _conversions(user, params):
    qs = Conversion.objects.filter(website__organization_id__in=_org_ids(user))
    if org := params.get("organization"):
        qs = qs.filter(website__organization_id=org)
    if website := params.get("website"):
        qs = qs.filter(website_id=website)
    return qs


class OverviewView(views.APIView):
    def get(self, request):
        days = _days(request.query_params)
        since = timezone.now() - timedelta(days=days)
        qs = _events(request.user, request.query_params).filter(created_at__gte=since)

        total = qs.count()
        by_class = dict(qs.exclude(classification="").values_list("classification")
                        .annotate(n=Count("id")).values_list("classification", "n"))
        human = by_class.get("human", 0)
        conversions = qs.filter(type="conversion").count()
        visitors = qs.values("visitor").distinct().count()
        sessions = qs.values("session").distinct().count()
        revenue = float(_conversions(request.user, request.query_params)
                        .filter(created_at__gte=since).aggregate(s=Sum("revenue"))["s"] or 0)

        # time series (per day)
        per_day = (qs.annotate(d=TruncDate("created_at")).values("d")
                   .annotate(events=Count("id"), visitors=Count("visitor", distinct=True),
                             human=Count("id", filter=Q(classification="human")))
                   .order_by("d"))
        visitors_ts = [{"date": r["d"], "count": r["visitors"]} for r in per_day]
        quality_ts = [{"date": r["d"], "pct": round(r["human"] / r["events"], 4) if r["events"] else 0}
                      for r in per_day]

        def top(field, limit=8):
            return [{"key": r[field] or "unknown", "count": r["n"]}
                    for r in qs.exclude(**{field: ""}).values(field).annotate(n=Count("id")).order_by("-n")[:limit]]

        # sources by utm_source ("" -> direct)
        src = {}
        for utm, n in (qs.values_list("session__utm_source").annotate(n=Count("id"))):
            key = utm or "direct"
            src[key] = src.get(key, 0) + n
        sources = sorted([{"key": k, "count": v} for k, v in src.items()], key=lambda x: -x["count"])[:8]

        return Response({
            "range": {"days": days},
            "totals": {
                "events": total, "visitors": visitors, "sessions": sessions,
                "quality": round(human / total, 4) if total else 0.0,
                "human": human,
                "suspicious": by_class.get("suspicious", 0),
                "bot": by_class.get("bot", 0),
                "fraud": by_class.get("fraud", 0),
                "flagged": total - human,
                "conversions": conversions,
                "conversion_rate": round(conversions / sessions, 4) if sessions else 0.0,
                "revenue": round(revenue, 2),
                "revenue_per_visitor": round(revenue / visitors, 2) if visitors else 0.0,
            },
            "timeseries": {"visitors": visitors_ts, "quality": quality_ts},
            "breakdowns": {
                "countries": top("country"),
                "devices": top("device"),
                "classifications": [{"key": k, "count": v} for k, v in by_class.items()],
                "sources": sources,
            },
        })


class VisitorListView(generics.ListAPIView):
    serializer_class = VisitorSerializer

    def get_queryset(self):
        p = self.request.query_params
        qs = Visitor.objects.filter(website__organization_id__in=_org_ids(self.request.user))
        if org := p.get("organization"):
            qs = qs.filter(website__organization_id=org)
        if website := p.get("website"):
            qs = qs.filter(website_id=website)
        if device := p.get("device"):
            qs = qs.filter(device=device)
        if country := p.get("country"):
            qs = qs.filter(country=country)
        if s := p.get("search"):
            qs = qs.filter(Q(visitor_id__icontains=s) | Q(ip__icontains=s))
        return qs.annotate(event_count=Count("events"), max_risk=Max("events__risk_score")).order_by("-last_seen")


class VisitorDetailView(views.APIView):
    def get(self, request, pk):
        v = (Visitor.objects.filter(website__organization_id__in=_org_ids(request.user))
             .filter(pk=pk).annotate(event_count=Count("events"), max_risk=Max("events__risk_score")).first())
        if not v:
            return Response(status=404)
        recent = v.events.order_by("-created_at")[:50]
        return Response({
            "visitor": VisitorSerializer(v).data,
            "sessions": v.sessions.count(),
            "events": EventSerializer(recent, many=True).data,
        })


class EventListView(generics.ListAPIView):
    """Click log — filterable traffic events."""
    serializer_class = EventSerializer

    def get_queryset(self):
        p = self.request.query_params
        qs = _events(self.request.user, p)
        for f in ("country", "device", "classification", "action", "type"):
            if v := p.get(f):
                qs = qs.filter(**{f: v})
        if mr := p.get("min_risk"):
            qs = qs.filter(risk_score__gte=mr)
        if s := p.get("search"):
            qs = qs.filter(Q(ip__icontains=s) | Q(url__icontains=s) | Q(visitor__visitor_id__icontains=s))
        return qs.select_related("visitor", "session").order_by("-created_at")


class SourcesView(views.APIView):
    def get(self, request):
        days = _days(request.query_params)
        since = timezone.now() - timedelta(days=days)
        qs = _events(request.user, request.query_params).filter(created_at__gte=since)
        agg = {}
        for utm, cls in qs.values_list("session__utm_source", "classification"):
            key = utm or "direct"
            row = agg.setdefault(key, {"key": key, "events": 0, "human": 0})
            row["events"] += 1
            if cls == "human":
                row["human"] += 1
        rows = []
        for r in agg.values():
            r["quality"] = round(r["human"] / r["events"], 4) if r["events"] else 0
            rows.append(r)
        rows.sort(key=lambda x: -x["events"])
        return Response({"sources": rows})


class ConversionsView(views.APIView):
    def get(self, request):
        days = _days(request.query_params)
        since = timezone.now() - timedelta(days=days)
        qs = _conversions(request.user, request.query_params).filter(created_at__gte=since)

        total = qs.count()
        revenue = float(qs.aggregate(s=Sum("revenue"))["s"] or 0)
        visitors = _events(request.user, request.query_params).filter(created_at__gte=since).values("visitor").distinct().count()

        def group(field):
            rows = (qs.values(field).annotate(n=Count("id"), rev=Sum("revenue")).order_by("-rev"))
            return [{"key": r[field] or "direct", "count": r["n"], "revenue": float(r["rev"] or 0)} for r in rows][:8]

        recent = [{
            "id": c.id, "event_name": c.event_name, "revenue": float(c.revenue), "currency": c.currency,
            "utm_source": c.utm_source or "direct", "utm_campaign": c.utm_campaign or "",
            "visitor_ref": c.visitor.visitor_id, "created_at": c.created_at,
        } for c in qs.select_related("visitor")[:50]]

        return Response({
            "totals": {
                "conversions": total,
                "revenue": round(revenue, 2),
                "revenue_per_visitor": round(revenue / visitors, 2) if visitors else 0.0,
                "avg_order_value": round(revenue / total, 2) if total else 0.0,
            },
            "by_campaign": group("utm_campaign"),
            "by_source": group("utm_source"),
            "recent": recent,
        })


REPORT_DIMENSIONS = {
    "country": "country", "device": "device", "browser": "browser", "os": "os",
    "classification": "classification", "action": "action",
    "utm_source": "session__utm_source", "utm_medium": "session__utm_medium",
    "utm_campaign": "session__utm_campaign",
}


class ReportView(views.APIView):
    """Group traffic by a chosen dimension. Returns JSON, or CSV when ?format=csv."""

    def get(self, request):
        p = request.query_params
        days = _days(p)
        since = timezone.now() - timedelta(days=days)
        dim = p.get("dimension", "country")
        field = REPORT_DIMENSIONS.get(dim, "country")
        qs = _events(request.user, p).filter(created_at__gte=since)

        grouped = (qs.values(field).annotate(
            events=Count("id"),
            visitors=Count("visitor", distinct=True),
            human=Count("id", filter=Q(classification="human")),
            conversions=Count("id", filter=Q(type="conversion")),
        ).order_by("-events"))

        rows = []
        for r in grouped:
            key = r[field] or ("direct" if dim.startswith("utm") else "unknown")
            rows.append({
                "key": key, "events": r["events"], "visitors": r["visitors"],
                "human": r["human"], "conversions": r["conversions"],
                "quality": round(r["human"] / r["events"], 4) if r["events"] else 0,
            })

        if p.get("export") == "csv":
            resp = HttpResponse(content_type="text/csv")
            resp["Content-Disposition"] = f'attachment; filename="report-{dim}.csv"'
            w = csv.writer(resp)
            w.writerow([dim, "events", "visitors", "human", "conversions", "quality_%"])
            for r in rows:
                w.writerow([r["key"], r["events"], r["visitors"], r["human"], r["conversions"], round(r["quality"] * 100, 1)])
            return resp

        return Response({"dimension": dim, "rows": rows,
                         "dimensions": list(REPORT_DIMENSIONS.keys())})
