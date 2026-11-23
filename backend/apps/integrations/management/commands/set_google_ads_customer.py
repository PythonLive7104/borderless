"""Set which Google Ads account a workspace's connection acts on.

Only needed when the connected Google login can reach more than one Ads account
(the push refuses to guess which advertiser you meant). For a single-account
login it is resolved automatically on the first push.

    python manage.py set_google_ads_customer <org> <customer_id>
    python manage.py set_google_ads_customer acme 123-456-7890
    python manage.py set_google_ads_customer 42 --list     # show reachable accounts
"""
from django.core.management.base import BaseCommand, CommandError

from apps.integrations import googleads
from apps.integrations.models import GoogleAdsAccount
from apps.organizations.models import Organization


class Command(BaseCommand):
    help = "Set (or list) the Google Ads account a workspace's connection uses."

    def add_arguments(self, parser):
        parser.add_argument("org", help="Workspace id or slug.")
        parser.add_argument("customer_id", nargs="?", help="The Ads account id (dashes ok).")
        parser.add_argument("--list", action="store_true",
                            help="List the Ads accounts this connection can reach.")

    def handle(self, *args, **opts):
        org = self._org(opts["org"])
        account = GoogleAdsAccount.objects.filter(organization=org).first()
        if not account or not account.is_connected:
            raise CommandError(f"{org.slug} has no connected Google Ads account.")

        if opts["list"]:
            from apps.integrations import googleads_api
            token = googleads_api.access_token_for(account)
            ids = googleads_api.list_accessible_customers(token)
            self.stdout.write("Reachable Ads accounts:")
            for cid in ids:
                self.stdout.write(f"  {cid}")
            return

        raw = opts["customer_id"]
        if not raw:
            raise CommandError("Give a customer_id, or pass --list to see the options.")
        cid = googleads.normalize_customer_id(raw)
        if not cid:
            raise CommandError(f"{raw!r} is not a valid Ads account id.")
        account.customer_id = cid
        account.save(update_fields=["customer_id"])
        self.stdout.write(self.style.SUCCESS(
            f"{org.slug}: Google Ads account set to {cid}."))

    def _org(self, ref):
        ref = ref.strip()
        org = (Organization.objects.filter(pk=int(ref)).first() if ref.isdigit() else None)
        org = org or Organization.objects.filter(slug=ref).first()
        if not org:
            raise CommandError(f"No workspace matches {ref!r}.")
        return org
