"""Apply the weekly access window to the live traffic engine.

A subscription expires at a moment in time with no request behind it, so nothing
in the request path notices when someone's 7 days run out. This command is what
does: it walks every workspace, compares its access state against what Redis is
currently serving, and revokes or restores the engine keys to match.

Revoking withdraws rules:, ipfilter:, site:, apikey: and shortlink: for the org.
The Go engine then fails open — /v1/decide answers "allow", /v1/guard returns
204, short links 404 — so an expired customer loses our protection and their
redirects, but their own website keeps serving. Renewing restores everything.

Schedule it hourly from host cron (see deploy/README.md). Idempotent: running it
twice changes nothing the second time.
"""
from django.core.management.base import BaseCommand

from apps.billing.entitlements import restore_org, revoke_org, workspace_locked
from apps.organizations.models import Organization


class Command(BaseCommand):
    help = "Revoke engine access for expired workspaces and restore it for renewed ones."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true",
                            help="Report what would change without touching Redis.")
        parser.add_argument("--org", type=int, default=None,
                            help="Limit to a single organization id.")

    def handle(self, *args, **opts):
        qs = Organization.objects.all().order_by("id")
        if opts["org"]:
            qs = qs.filter(id=opts["org"])

        revoked = restored = 0
        for org in qs.iterator():
            locked = workspace_locked(org.id)
            if opts["dry_run"]:
                self.stdout.write(f"[{org.slug}] {'would revoke' if locked else 'would restore'}")
                revoked += locked
                restored += not locked
                continue
            if locked:
                if revoke_org(org.id):
                    revoked += 1
                    self.stdout.write(self.style.WARNING(f"[{org.slug}] revoked — access period ended"))
            else:
                restore_org(org.id)
                restored += 1

        self.stdout.write(self.style.SUCCESS(
            f"Done. {revoked} workspace(s) revoked, {restored} entitled."))
