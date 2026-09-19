"""Check that every short domain still resolves, serves, and isn't blacklisted.

A short domain can die for reasons the app cannot see. The two that actually
happen:

  * the registrar suspends it after an abuse complaint — DNS stops resolving,
    so every link on it fails, and nothing in our logs says why;
  * a safety vendor blacklists it — it resolves fine, but browsers show an
    interstitial before the redirect, so customers report "dead" links that
    look healthy from the server.

Neither surfaces on its own. Without this, the first signal is a support
message, and the admin cannot even tell WHICH domain the customer means.

Run it on a schedule (cron) with --notify, and read the result in the admin
list, where health is a column and a filter.
"""
import socket
import urllib.error
import urllib.request

from django.core.management.base import BaseCommand
from django.utils import timezone

from ...models import ShortDomain

TIMEOUT = 10
UA = "TryNoBot-HealthCheck/1.0 (+https://trynobot.com)"


def _resolves(host: str) -> tuple[bool, str]:
    try:
        socket.getaddrinfo(host, 443, proto=socket.IPPROTO_TCP)
        return True, ""
    except socket.gaierror as e:
        # NXDOMAIN is what a registrar suspension (serverHold) looks like from
        # here, so it is reported as its own case rather than a generic error.
        return False, f"DNS did not resolve ({e.strerror or e})"
    except Exception as e:                                  # pragma: no cover
        return False, f"DNS lookup failed ({type(e).__name__})"


def _serves(host: str) -> tuple[bool, str]:
    """Any HTTP response counts as serving — even a 404. We are testing that
    something answers on the wire, not that a particular page exists."""
    req = urllib.request.Request(f"https://{host}/", headers={"User-Agent": UA},
                                 method="GET")
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return True, f"HTTP {r.status}"
    except urllib.error.HTTPError as e:
        return True, f"HTTP {e.code}"
    except Exception as e:
        return False, f"HTTPS failed ({type(e).__name__})"


class Command(BaseCommand):
    help = "Check each short domain resolves, serves and is not blacklisted."

    def add_arguments(self, parser):
        parser.add_argument("--host", help="Check only this host.")
        parser.add_argument("--notify", action="store_true",
                            help="Email the abuse address about anything unhealthy.")
        parser.add_argument("--skip-scan", action="store_true",
                            help="Skip the blacklist scan (no external API calls).")

    def handle(self, *args, **opts):
        from apps.intelligence.threatscan import is_enabled, scan_url

        qs = ShortDomain.objects.filter(active=True).order_by("host")
        if opts["host"]:
            qs = qs.filter(host=opts["host"].lower())
        scan_on = is_enabled() and not opts["skip_scan"]
        if not scan_on:
            self.stdout.write(self.style.WARNING(
                "  blacklist scan off — reachability only"))

        unhealthy = []
        for d in qs:
            ok, detail = _resolves(d.host)
            health = ShortDomain.Health.OK
            if not ok:
                health = ShortDomain.Health.UNREACHABLE
            else:
                ok, detail = _serves(d.host)
                if not ok:
                    health = ShortDomain.Health.UNREACHABLE
                elif scan_on:
                    r = scan_url(f"https://{d.host}/")
                    if r.get("safe") is False:
                        health = ShortDomain.Health.FLAGGED
                        detail = "flagged by " + ", ".join(r.get("flagged_by") or ["a scanner"])

            d.health, d.health_detail = health, detail[:300]
            d.health_checked_at = timezone.now()
            d.save(update_fields=["health", "health_detail", "health_checked_at"])

            owner = d.organization.name if d.organization_id else (
                "shared pool" if d.is_shared else "unsold stock")
            line = f"  {d.host:<18} {health:<12} {owner:<22} {detail}"
            if health == ShortDomain.Health.OK:
                self.stdout.write(line)
            else:
                unhealthy.append(d)
                self.stdout.write(self.style.ERROR(line))

        self.stdout.write(self.style.SUCCESS(
            f"Done. {qs.count()} checked, {len(unhealthy)} unhealthy."))
        if unhealthy and opts["notify"]:
            self._notify(unhealthy)

    def _notify(self, unhealthy):
        from django.conf import settings
        from django.core.mail import send_mail
        to = getattr(settings, "ABUSE_NOTIFY_EMAIL", "") or getattr(settings, "ABUSE_EMAIL", "")
        if not to:
            self.stdout.write(self.style.WARNING("  no ABUSE_NOTIFY_EMAIL set — not emailing"))
            return
        lines = []
        for d in unhealthy:
            who = d.organization.name if d.organization_id else (
                "shared pool" if d.is_shared else "unsold stock")
            lines.append(f"{d.host} — {d.get_health_display()} ({d.health_detail})\n"
                         f"  used by: {who}; {d.links.count()} link(s) affected")
        send_mail(
            f"[action needed] {len(unhealthy)} short domain(s) unhealthy",
            "These domains are not serving normally. Links on them are failing for\n"
            "customers right now.\n\n" + "\n\n".join(lines),
            settings.DEFAULT_FROM_EMAIL, [to], fail_silently=True)
        self.stdout.write(f"  emailed {to}")
