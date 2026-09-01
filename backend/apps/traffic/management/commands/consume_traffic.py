"""Consume the events:traffic Redis stream (written by the Go engine) into Postgres.

Run:  python manage.py consume_traffic
"""
import json
import time
from datetime import datetime, timezone

import redis
from django.conf import settings
from django.core.management.base import BaseCommand

from apps.websites.models import Website
from apps.traffic.models import Visitor, Session, TrafficEvent, Conversion
from apps.integrations.dispatch import dispatch
from apps.intelligence.service import enrich

STREAM = "events:traffic"
GROUP = "traffic"
CONSUMER = "worker-1"


def _classify(score):
    if score >= 85:
        return "fraud"
    if score >= 70:
        return "bot"
    if score >= 40:
        return "suspicious"
    return "human"


class Command(BaseCommand):
    help = "Consume traffic events from Redis Streams into Visitor/Session/TrafficEvent."

    def handle(self, *args, **opts):
        r = redis.from_url(settings.REDIS_URL, decode_responses=True)
        try:
            r.xgroup_create(STREAM, GROUP, id="0", mkstream=True)
        except redis.ResponseError:
            pass
        self.stdout.write(self.style.SUCCESS(f"Consuming {STREAM}..."))
        while True:
            try:
                resp = r.xreadgroup(GROUP, CONSUMER, {STREAM: ">"}, count=100, block=5000)
            except redis.ConnectionError:
                time.sleep(1); continue
            if not resp:
                continue
            for _stream, entries in resp:
                for entry_id, f in entries:
                    try:
                        self._ingest(f)
                    except Exception as e:  # never let one bad event stall the stream
                        self.stderr.write(f"skip {entry_id}: {e}")
                    r.xack(STREAM, GROUP, entry_id)

    def _ingest(self, f: dict):
        site = Website.objects.filter(tracking_id=f.get("site_id")).first()
        if not site:
            return  # unknown site — drop

        ts = datetime.fromtimestamp(int(f.get("ts", "0")), tz=timezone.utc)

        visitor, _ = Visitor.objects.get_or_create(
            website=site, visitor_id=f.get("visitor_id", "")[:64],
            defaults={"ip": f.get("ip") or None, "country": f.get("country", ""),
                      "device": f.get("device", ""), "browser": f.get("browser", ""), "os": f.get("os", "")},
        )
        # refresh latest signals
        Visitor.objects.filter(pk=visitor.pk).update(
            ip=f.get("ip") or None, country=f.get("country", ""),
            device=f.get("device", ""), browser=f.get("browser", ""), os=f.get("os", ""),
            fingerprint=f.get("fingerprint", ""),
        )

        session, _ = Session.objects.get_or_create(
            website=site, session_id=f.get("session_id", "")[:64],
            defaults={
                "visitor": visitor, "landing_url": f.get("url", ""), "referrer": f.get("referrer", ""),
                "utm_source": f.get("utm_source", ""), "utm_medium": f.get("utm_medium", ""),
                "utm_campaign": f.get("utm_campaign", ""),
            },
        )

        event = TrafficEvent.objects.create(
            website=site, visitor=visitor, session=session,
            type=f.get("type", "pageview"), url=f.get("url", ""), referrer=f.get("referrer", ""),
            event_name=f.get("event_name", ""),
            ip=f.get("ip") or None, country=f.get("country", ""), device=f.get("device", ""),
            browser=f.get("browser", ""), os=f.get("os", ""), user_agent=f.get("ua", ""),
            is_headless=f.get("is_headless", "0") == "1",
            risk_score=int(f["risk_score"]) if f.get("risk_score") not in (None, "") else None,
            classification=f.get("classification", ""),
            confidence=float(f["confidence"]) if f.get("confidence") not in (None, "") else None,
            signals=json.loads(f.get("signals", "[]") or "[]"),
            action=f.get("action", "allow") or "allow",
            tag=f.get("tag", ""),
            fingerprint=f.get("fingerprint", ""),
            fp_signals=[x for x in (f.get("fp_flags", "") or "").split(",") if x],
            ja3=f.get("ja3", "") or "",
            created_at=ts,
        )
        # IP intelligence enrichment (populates shared sets + adjusts this event)
        intel = enrich(f.get("ip") or "")
        if intel:
            delta, added = 0, []
            if intel.get("datacenter"):
                delta += 25; added.append("datacenter_ip")
            if intel.get("proxy") or intel.get("vpn"):
                delta += 15; added.append("proxy_detected")
            if delta:
                event.risk_score = min((event.risk_score or 0) + delta, 100)
                sigs = list(event.signals or [])
                for a in added:
                    if a not in sigs:
                        sigs.append(a)
                event.signals = sigs
                event.classification = _classify(event.risk_score)
                event.save(update_fields=["risk_score", "signals", "classification"])

        if f.get("type") == "conversion":
            try:
                revenue = float(f.get("revenue") or 0)
            except (TypeError, ValueError):
                revenue = 0
            Conversion.objects.create(
                website=site, visitor=visitor, session=session,
                event_name=f.get("event_name", "") or "conversion",
                revenue=revenue, currency=f.get("currency", "") or "USD",
                utm_source=f.get("utm_source", ""), utm_campaign=session.utm_campaign,
                created_at=ts,
            )
        # fire webhooks (best-effort)
        org_id = site.organization_id
        dispatch(org_id, "traffic.classified", {
            "site_id": site.tracking_id, "visitor_id": visitor.visitor_id,
            "risk_score": event.risk_score, "classification": event.classification,
            "action": event.action, "country": event.country,
        })
        if (event.risk_score or 0) >= 85:
            dispatch(org_id, "risk.critical", {"site_id": site.tracking_id, "risk_score": event.risk_score, "visitor_id": visitor.visitor_id})
        elif (event.risk_score or 0) >= 70:
            dispatch(org_id, "risk.high", {"site_id": site.tracking_id, "risk_score": event.risk_score, "visitor_id": visitor.visitor_id})
        site.mark_event()
