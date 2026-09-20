"""Live component health for the public status page.

The page used to hard-code "Operational" for everything plus a 99.98% uptime
figure that measured nothing — which is worth less than no status page at all,
because the one time it matters it will still be green. This reports what is
actually reachable right now. It deliberately does not claim an uptime
percentage: we don't run the historical probing that would substantiate one.
"""
from rest_framework import permissions, views
from rest_framework.response import Response

OK, DEGRADED, DOWN = "operational", "degraded", "down"


def _database():
    from django.db import connection
    try:
        with connection.cursor() as c:
            c.execute("SELECT 1")
        return OK
    except Exception:
        return DOWN


def _redis():
    try:
        from apps.intelligence.service import _r
        return OK if _r().ping() else DOWN
    except Exception:
        return DOWN


def _decision():
    """The Go hot path. Reached over the internal network, short timeout — the
    status page must never hang because the thing it reports on is hanging."""
    import os
    import urllib.request

    base = os.getenv("DECISION_INTERNAL_URL", "http://decision:8080").rstrip("/")
    try:
        req = urllib.request.Request(f"{base}/healthz", method="GET")
        with urllib.request.urlopen(req, timeout=2) as r:
            return OK if 200 <= r.status < 300 else DEGRADED
    except Exception:
        return DOWN


def _ingestion():
    """Events are written to a Redis stream, so ingestion is up when Redis is."""
    return _redis()


class StatusView(views.APIView):
    """Public, unauthenticated: it has to answer while the dashboard cannot."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        components = [
            {"name": "Traffic engine (Go)", "state": _decision()},
            {"name": "Ingestion API", "state": _ingestion()},
            {"name": "Dashboard & API (Django)", "state": _database()},
            {"name": "Analytics pipeline", "state": _redis()},
        ]
        states = {c["state"] for c in components}
        overall = DOWN if states == {DOWN} else (DEGRADED if states - {OK} else OK)
        return Response({"overall": overall, "components": components})
