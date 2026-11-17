"""Why is email carrying this redirect not being delivered?

A campaign letter that arrives with the customer's own URL and vanishes with
ours has exactly four plausible causes, and they are indistinguishable from the
outside — the sender sees "it didn't arrive" for all four. Guessing wastes days,
so this checks all four against the live link and says which one applies.

  1. The redirect cloaks. We answer a mail gateway differently from a browser
     (404, 403, blank, decoy, interstitial), which every major mail security
     vendor reads as a malicious redirect and refuses the message over. Only
     links that filter SOMEBODY can do this, so that is what gets reported.

  2. The short domain is on an email URI blocklist. Receiving servers check
     every hostname in a message against Spamhaus DBL, SURBL and URIBL; a hit
     is refused at SMTP. Invisible from here — the domain resolves, serves a
     perfect 302 and passes browser-safety scans.

  3. The DESTINATION is the problem. Gateways follow the redirect and judge
     where it lands. A flagged or blocklisted destination gets the message
     refused no matter how well the redirect behaves, and no change to the
     shortener can help.

  4. Nothing here is wrong, in which case the next artifact is the bounce
     message, which names the real reason verbatim.

Usage:  python manage.py diagnose_link <slug> [--host trynb.cc]
"""
from urllib.parse import urlsplit

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.links.models import ShortLink


class Command(BaseCommand):
    help = "Explain why mail carrying a given short link may not be delivered."

    def add_arguments(self, parser):
        parser.add_argument("slug", help="The slug, e.g. aB3xK9")
        parser.add_argument("--host", help="Disambiguate when the slug exists on several domains.")
        parser.add_argument("--days", type=int, default=14,
                            help="How far back to look for scanner traffic.")

    def handle(self, *args, **opts):
        links = ShortLink.objects.filter(slug=opts["slug"]).select_related("domain", "organization")
        if opts["host"]:
            links = links.filter(domain__host=opts["host"].lower())
        link = links.first()
        if link is None:
            self.stderr.write(self.style.ERROR(
                f"No link with slug {opts['slug']!r}"
                + (f" on {opts['host']}" if opts["host"] else "")))
            return
        if links.count() > 1:
            self.stdout.write(self.style.WARNING(
                f"  {links.count()} links share this slug — using {link.domain}. "
                f"Pass --host to pick another."))

        host = link.domain.host if link.domain_id else ""
        self.stdout.write(self.style.MIGRATE_HEADING(
            f"\n{host}/{link.slug}  ->  {link.destination_url}"))
        self.stdout.write(f"  workspace: {link.organization.name}   active: {link.active}\n")

        problems = []
        self._check_cloaking(link, problems)
        self._check_short_domain(host, link, problems)
        self._check_destination(link, problems)
        self._check_scanner_traffic(link, opts["days"])

        self.stdout.write("")
        if problems:
            self.stdout.write(self.style.ERROR("VERDICT — found %d likely cause(s):" % len(problems)))
            for i, p in enumerate(problems, 1):
                self.stdout.write(self.style.ERROR(f"  {i}. {p}"))
        else:
            self.stdout.write(self.style.SUCCESS(
                "VERDICT — nothing here explains a non-delivery."))
            self.stdout.write(
                "  Get the bounce message from the sender's platform: a refusal at SMTP\n"
                "  always produces one, and its text names the real reason. 'Not even in\n"
                "  spam' means refused, not filtered, so a bounce exists.")

    # --- 1. does this link cloak? -----------------------------------------
    def _check_cloaking(self, link, problems):
        from apps.links.edge import edge_simple

        self.stdout.write(self.style.MIGRATE_HEADING("1. Does the redirect filter anyone?"))
        if edge_simple(link):
            self.stdout.write(self.style.SUCCESS(
                "   No — everyone gets the same 302. This link cannot be cloaking."))
            return

        # It filters. Name what, so the operator can judge whether to relax it.
        gates = []
        if link.bot_action != "off":
            gates.append(f"bot handling = {link.bot_action}")
        if link.challenge:
            gates.append("human confirmation")
        if link.deep_check:
            gates.append("deep browser check")
        if link.block_vpn:
            gates.append("block VPN/proxy")
        if link.block_datacenter:
            gates.append("block datacenter")
        if (link.country_mode or "off") != "off":
            gates.append(f"country {link.country_mode}-list")
        if (link.device_mode or "off") != "off":
            gates.append(f"device {link.device_mode}-list")
        if (link.os_mode or "off") != "off":
            gates.append(f"OS {link.os_mode}-list")
        if int(link.max_risk or 0):
            gates.append(f"max risk {link.max_risk}")

        self.stdout.write(f"   Yes: {', '.join(gates) or 'rules'}")
        self.stdout.write(
            "   Mail scanners are served the real destination anyway IF the engine is\n"
            "   running the scanner fix — section 4 below shows whether it is.")

    # --- 2. the short domain ----------------------------------------------
    def _check_short_domain(self, host, link, problems):
        from apps.links import uriblocklist
        from apps.links.models import ShortDomain

        self.stdout.write(self.style.MIGRATE_HEADING("\n2. Is the short domain blocklisted?"))
        if not host:
            self.stdout.write(self.style.WARNING("   No domain attached to this link."))
            return

        if link.domain.health != ShortDomain.Health.OK:
            self.stdout.write(self.style.WARNING(
                f"   Browser safety: {link.domain.get_health_display()}"
                f" — {link.domain.health_detail or 'no detail'}"))
            if link.domain.health == ShortDomain.Health.FLAGGED:
                problems.append(
                    f"{host} is flagged by a safety scanner. Vendors share these feeds with "
                    f"mail filters, so this alone can get the message refused.")
        else:
            self.stdout.write("   Browser safety: serving normally")

        r = uriblocklist.check_domain(host)
        if r["listed"]:
            self.stdout.write(self.style.ERROR(f"   Email blocklists: {r['detail']}"))
            problems.append(
                f"{host} is on an email blocklist ({'; '.join(r['listed_on'])}). Every "
                f"message carrying a link on it is refused at the recipient's gateway, "
                f"whatever the redirect does. Move customers to another domain and "
                f"request delisting.")
        elif not r["checked"]:
            self.stdout.write(self.style.WARNING(f"   Email blocklists: {r['detail']}"))
            self.stdout.write(
                "   (These zones refuse queries from public resolvers — run this from a\n"
                "    host with its own resolver to get a real answer.)")
        else:
            self.stdout.write(self.style.SUCCESS(f"   Email blocklists: {r['detail']}"))

    # --- 3. the destination ------------------------------------------------
    def _check_destination(self, link, problems):
        from apps.links import uriblocklist

        self.stdout.write(self.style.MIGRATE_HEADING("\n3. Is the destination the problem?"))
        dest_host = (urlsplit(link.destination_url).hostname or "").lower()
        if not dest_host:
            self.stdout.write(self.style.WARNING("   Could not read a hostname from the destination."))
            return

        if link.url_safe is False:
            self.stdout.write(self.style.ERROR(
                f"   {dest_host}: flagged — {', '.join(link.url_threats or []) or 'unspecified'}"))
            problems.append(
                f"The destination {dest_host} is flagged. Gateways follow the redirect and "
                f"judge where it lands, so this refuses the message no matter how the "
                f"redirect behaves.")
        elif link.url_safe is None:
            self.stdout.write(f"   {dest_host}: never scanned")
        else:
            self.stdout.write(self.style.SUCCESS(f"   {dest_host}: scanned clean"))

        r = uriblocklist.check_domain(dest_host)
        if r["listed"]:
            self.stdout.write(self.style.ERROR(f"   Email blocklists: {r['detail']}"))
            problems.append(
                f"The destination {dest_host} is itself on an email blocklist "
                f"({'; '.join(r['listed_on'])}). Nothing about the shortener can fix this — "
                f"the customer's own URL would be refused too.")
        else:
            self.stdout.write(f"   Email blocklists: {r['detail']}")

    # --- 4. is the scanner fix live and seeing anything? -------------------
    def _check_scanner_traffic(self, link, days):
        from datetime import timedelta
        from apps.traffic.models import TrafficEvent

        self.stdout.write(self.style.MIGRATE_HEADING(
            f"\n4. Have mail scanners been seen in the last {days} days?"))
        since = timezone.now() - timedelta(days=days)
        qs = TrafficEvent.objects.filter(created_at__gte=since)

        try:
            seen = list(qs.filter(signals__contains=["link_scanner"])
                        .values_list("signals", "created_at")[:200])
        except Exception:
            # JSONField containment is Postgres-only; fall back to Python so
            # this still works on a non-Postgres database.
            seen = [(s, t) for s, t in qs.values_list("signals", "created_at")[:5000]
                    if isinstance(s, list) and "link_scanner" in s]

        if not seen:
            self.stdout.write(self.style.WARNING(
                "   None recorded.\n"
                "   That means either no scanner has fetched a link yet, or the decision\n"
                "   engine is not running the scanner fix. Confirm the engine was rebuilt:\n"
                "     docker compose -f docker-compose.prod.yml up -d --force-recreate decision"))
            return

        vendors = {}
        for signals, _at in seen:
            for s in signals or []:
                if isinstance(s, str) and s.startswith("scanner:"):
                    vendors[s[8:]] = vendors.get(s[8:], 0) + 1
        self.stdout.write(self.style.SUCCESS(
            f"   Yes — {len(seen)} scanner fetch(es) recognised. The fix is live."))
        if vendors:
            self.stdout.write("   " + ", ".join(f"{v} x{n}" for v, n in
                                                sorted(vendors.items(), key=lambda kv: -kv[1])))
