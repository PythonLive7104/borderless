from django.contrib import admin
from django.utils import timezone

from .models import AbuseReport, PrivateDomainPurchase, ShortDomain, ShortLink
from .sync import publish_link


@admin.register(ShortDomain)
class ShortDomainAdmin(admin.ModelAdmin):
    list_display = ("host", "health_badge", "active", "is_shared", "organization",
                    "is_default", "health_checked_at")
    # health first: "which domain is broken?" is the question this page gets
    # opened to answer, and scanning a status column beats opening each row.
    list_filter = ("health", "active", "is_shared", "is_default")
    readonly_fields = ("health", "health_detail", "health_checked_at")
    actions = ("reclaim_for_abuse", "hold_as_private_stock",
               "return_to_shared_pool", "check_health")

    @admin.action(description="Reclaim from the workspace (abuse) — notifies them")
    def reclaim_for_abuse(self, request, queryset):
        """Take a private domain back from a workspace, in one step, with notice.

        return_to_shared_pool deliberately refuses to touch an owned domain, so
        reclaiming an abused one meant clearing the owner by hand and then
        running it — and the customer was told nothing at all. Their links
        simply stopped resolving and they found out by finding them broken.
        That is poor even for someone who earned it, and a reported domain is
        sometimes reported wrongly; the owner needs to know what happened and
        that their click history is intact.

        Held back as stock rather than returned to the shared pool: a host that
        has just been used for abuse should not start serving every other
        customer's links.
        """
        from apps.notifications.system import notify_workspace

        taken = skipped = 0
        for d in queryset:
            if d.organization_id is None:
                skipped += 1
                continue
            org = d.organization
            links = list(d.links.all())
            d.organization = None
            d.private_until = None
            d.is_shared = False          # sellable stock, NOT the public pool
            d.save(update_fields=["organization", "private_until", "is_shared"])
            for link in links:
                publish_link(link)       # withdraws them — no longer entitled
            notify_workspace(
                org,
                f"{d.host} has been withdrawn",
                f"We have withdrawn {d.host} from your workspace following a report of "
                f"abuse, and the {len(links)} link(s) on it no longer resolve.\n\n"
                f"Your links and their click history are still in your account. If you "
                f"believe this is a mistake, reply to this notice or contact support and "
                f"we will look again.",
            )
            taken += 1

        msg = f"{taken} domain(s) withdrawn and the owner notified."
        if skipped:
            msg += f" {skipped} skipped — nobody owns them."
        self.message_user(request, msg)

    @admin.display(description="Health", ordering="health")
    def health_badge(self, obj):
        icon = {"ok": "✅", "flagged": "⚠️",
                "unreachable": "❌", "unknown": "—"}.get(obj.health, "—")
        return f"{icon} {obj.get_health_display()}" + (
            f" — {obj.health_detail}" if obj.health_detail and obj.health != "ok" else "")

    @admin.action(description="Check health now (DNS, HTTPS, blacklist)")
    def check_health(self, request, queryset):
        from django.core.management import call_command
        from io import StringIO
        out = StringIO()
        for host in queryset.values_list("host", flat=True):
            call_command("check_domain_health", host=host, stdout=out)
        bad = queryset.model.objects.filter(
            host__in=list(queryset.values_list("host", flat=True))
        ).exclude(health="ok")
        if bad:
            self.message_user(request, "Unhealthy: " + ", ".join(
                f"{d.host} ({d.get_health_display()})" for d in bad), level="ERROR")
        else:
            self.message_user(request, "All checked domains are serving normally.")

    @admin.action(description="Hold back as private stock (removes from the shared pool)")
    def hold_as_private_stock(self, request, queryset):
        n = queryset.filter(organization__isnull=True).update(is_shared=False, is_default=False)
        self.message_user(request, f"{n} domain(s) held as private stock. "
                                   "Assign one to a workspace to sell it.")

    @admin.action(description="Return to the shared pool")
    def return_to_shared_pool(self, request, queryset):
        sold = queryset.filter(organization__isnull=False).count()
        n = queryset.filter(organization__isnull=True).update(is_shared=True)
        msg = f"{n} domain(s) returned to the shared pool."
        if sold:
            msg += f" {sold} skipped — they belong to a workspace; clear the owner first."
        self.message_user(request, msg)
    search_fields = ("host",)


@admin.register(ShortLink)
class ShortLinkAdmin(admin.ModelAdmin):
    list_display = ("slug", "domain", "destination_url", "organization", "active", "url_safe",
                    "clicks", "created_at")
    list_filter = ("active", "url_safe", "bot_action", "domain")
    search_fields = ("slug", "destination_url", "title", "organization__name")
    readonly_fields = ("clicks", "human_clicks", "bot_clicks", "url_scanned_at", "created_at")
    actions = ("disable_and_withdraw",)

    def save_model(self, request, obj, form, change):
        """Push every admin edit to the engine.

        The redirect is served from Redis, not the database, so a change saved
        here is invisible to visitors until it is republished. Without this,
        unticking Active on a malicious link looks like it worked — the row says
        inactive — while the engine keeps redirecting every click.
        """
        super().save_model(request, obj, form, change)
        publish_link(obj)       # withdraws it when inactive; see publish_link()

    @admin.action(description="Disable and stop redirecting")
    def disable_and_withdraw(self, request, queryset):
        n = 0
        for link in queryset:
            link.active = False
            link.save(update_fields=["active"])
            publish_link(link)
            n += 1
        self.message_user(request, f"{n} link(s) disabled and withdrawn from the engine.")


@admin.register(AbuseReport)
class AbuseReportAdmin(admin.ModelAdmin):
    """Triage queue. Default view is the open reports, newest first."""
    list_display = ("created_at", "reason", "slug", "status", "auto_disabled",
                    "reporter_email", "link_active")
    list_filter = ("status", "reason", "auto_disabled")
    search_fields = ("slug", "reported_url", "reporter_email", "details")
    readonly_fields = ("created_at", "scan_result", "reporter_ip", "reported_url", "slug")
    actions = ("disable_links", "dismiss_reports")

    @admin.display(boolean=True, description="Link live?")
    def link_active(self, obj):
        return bool(obj.link and obj.link.active)

    @admin.action(description="Disable the reported links and mark actioned")
    def disable_links(self, request, queryset):
        n = 0
        for report in queryset.select_related("link"):
            if report.link and report.link.active:
                report.link.active = False
                report.link.save(update_fields=["active"])
                publish_link(report.link)   # or the engine keeps redirecting
                n += 1
            report.status = AbuseReport.Status.ACTIONED
            report.resolved_at = timezone.now()
            report.save(update_fields=["status", "resolved_at"])
        self.message_user(request, f"{n} link(s) disabled.")

    @admin.action(description="Dismiss — no action needed")
    def dismiss_reports(self, request, queryset):
        queryset.update(status=AbuseReport.Status.DISMISSED, resolved_at=timezone.now())


@admin.register(PrivateDomainPurchase)
class PrivateDomainPurchaseAdmin(admin.ModelAdmin):
    """Private domain orders — including the ones we owe a domain on.

    This page did not exist, which meant the paid-but-not-yet-fulfilled backlog
    was invisible: finding out who had paid and was still waiting took a shell
    session. That is also where "they asked for a specific host" orders sit
    until someone registers the name, so it is the queue to work from.
    """
    list_display = ("id", "organization", "wanted", "amount", "status",
                    "paid_from", "created_at", "fulfilled_at")
    list_filter = ("status",)
    search_fields = ("requested_host", "organization__name", "organization__slug",
                     "bachs_session_id")
    readonly_fields = ("bachs_session_id", "paid_at", "fulfilled_at", "created_at")
    actions = ("refund_to_wallet", "fulfil_now")

    @admin.display(description="Wanted")
    def wanted(self, obj):
        if obj.domain_id:
            return obj.domain.host
        if obj.requested_host:
            return f"{obj.requested_host} (to register)"
        if obj.renew_domain_id:
            return f"renewal: {obj.renew_domain.host}"
        return "any from stock"

    @admin.display(description="Paid by")
    def paid_from(self, obj):
        # The wallet path stamps the note; anything else came through Bachs.
        return "wallet" if "wallet" in (obj.note or "").lower() else "card"

    @admin.action(description="Refund to wallet (could not source the domain)")
    def refund_to_wallet(self, request, queryset):
        """Put the money back as wallet credit and tell the customer.

        Only touches PAID orders. A FULFILLED one got what it paid for, and a
        REFUNDED one has already been settled — refunding either again would
        hand out money twice, so both are skipped rather than silently redone.

        Note this returns credit, not a card reversal. For a card purchase the
        customer gets spendable balance rather than money back in their bank;
        if they want the latter, refund it in Bachs instead and leave this
        order alone.
        """
        from apps.notifications.system import notify_workspace
        from apps.referrals.service import refund

        done = skipped = no_user = 0
        for p in queryset.select_related("organization", "user"):
            if p.status != PrivateDomainPurchase.Status.PAID:
                skipped += 1
                continue
            if p.user_id is None:
                # The buyer's account was deleted; there is no wallet to credit.
                no_user += 1
                continue

            wanted = p.requested_host or "a private domain"
            refund(p.user, int(p.amount) * 100,
                   note=f"Refund: could not source {wanted}"[:200])
            p.status = PrivateDomainPurchase.Status.REFUNDED
            p.save(update_fields=["status"])
            notify_workspace(
                p.organization,
                f"Refunded ${p.amount} for {wanted}",
                f"We could not register {wanted}, so the ${p.amount} you paid has been "
                f"returned to your wallet as credit. You can spend it on another "
                f"private domain, a plan or a renewal whenever you like.",
            )
            done += 1

        msg = f"{done} order(s) refunded to wallet and the customer notified."
        if skipped:
            msg += f" {skipped} skipped — not in the PAID state."
        if no_user:
            msg += f" {no_user} skipped — the buyer's account no longer exists."
        self.message_user(request, msg)

    @admin.action(description="Fulfil now (assign a domain from stock)")
    def fulfil_now(self, request, queryset):
        """Hand over a domain to an order that is paid and waiting.

        Use after adding the host to stock. An order naming a specific host is
        only filled once THAT host exists — assign_domain will not substitute a
        different name for one somebody asked for by name.
        """
        from .purchases import assign_domain

        filled = waiting = 0
        for p in queryset.filter(status=PrivateDomainPurchase.Status.PAID):
            if assign_domain(p):
                filled += 1
            else:
                waiting += 1
        self.message_user(
            request,
            f"{filled} order(s) fulfilled." +
            (f" {waiting} still waiting — the host they asked for is not in stock yet."
             if waiting else ""))
