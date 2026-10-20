"""Print how every plan's Bachs product is actually configured.

Price, billing interval and which payment methods a checkout offers are all
properties of the PRODUCT in the Bachs dashboard. This codebase only ever sends
a product id — so when two checkouts behave differently (one showing crypto and
the other not, one saying "Subscribe" and the other "Pay now"), the difference
is in those products and nowhere in this repository. This command fetches each
one so the difference can be seen rather than guessed at.

Read-only: it never creates a session or changes anything.
"""
import json

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.billing.models import MONTHLY, WEEKLY, YEARLY, Plan

# Keys worth surfacing if Bachs returns them. Unknown schemas are handled by
# --raw rather than by assuming field names we have not seen.
INTERESTING = (
    "type", "product_type", "billing_type", "mode", "recurring", "is_recurring",
    "interval", "billing_interval", "billing_period", "recurring_interval",
    "price", "amount", "unit_amount", "currency",
    "payment_methods", "allowed_payment_methods", "payment_method_types",
    "accepts_crypto", "crypto_enabled", "status", "active", "name",
)


def _flat(data):
    """Bachs wraps some responses in {"data": {...}}; look through it."""
    if isinstance(data, dict) and isinstance(data.get("data"), dict):
        return data["data"]
    return data if isinstance(data, dict) else {}


class Command(BaseCommand):
    help = "Show the Bachs product configuration behind each plan and interval."

    def add_arguments(self, parser):
        parser.add_argument("--raw", action="store_true",
                            help="Dump the full JSON for each product.")

    def handle(self, *args, **opts):
        from apps.billing import bachs
        if not bachs.is_enabled():
            self.stdout.write(self.style.WARNING(
                "BACHS_API_KEY is not set — nothing to look up."))
            return

        rows = []
        for plan in Plan.objects.order_by("price"):
            for interval in (WEEKLY, MONTHLY, YEARLY):
                if not plan.offers(interval):
                    continue
                rows.append((f"{plan.slug} {interval}", plan.product_for(interval),
                             plan.price_for(interval)))
        rows.append(("private domain (one-off)",
                     getattr(settings, "BACHS_PRODUCT_PRIVATE_DOMAIN", ""),
                     getattr(settings, "PRIVATE_DOMAIN_PRICE", 0)))

        for label, pid, our_price in rows:
            if not pid:
                self.stdout.write(self.style.WARNING(
                    f"{label:<26} NO PRODUCT ID — this interval can't be bought"))
                continue
            data, err = bachs.get_product(pid)
            if err:
                self.stdout.write(self.style.ERROR(f"{label:<26} {pid}  ->  {err}"))
                continue
            d = _flat(data)
            self.stdout.write(self.style.SUCCESS(f"{label:<26} {pid}  (we charge ${our_price})"))
            if opts["raw"]:
                self.stdout.write(json.dumps(data, indent=2))
                continue
            shown = False
            for k in INTERESTING:
                if k in d and d[k] not in (None, "", [], {}):
                    self.stdout.write(f"    {k}: {d[k]}")
                    shown = True
            if not shown:
                # Better to admit we don't recognise the shape than to print
                # nothing and let it read as "correctly configured".
                self.stdout.write("    (no recognised fields — re-run with --raw)")

        self.stdout.write("")
        self.stdout.write(
            "A product billed as a recurring subscription cannot offer crypto: there is\n"
            "no stored credential to charge on a schedule. If one interval shows crypto\n"
            "and another doesn't, compare their type/interval above — then fix it in the\n"
            "Bachs dashboard. Nothing in this codebase selects payment methods.")
