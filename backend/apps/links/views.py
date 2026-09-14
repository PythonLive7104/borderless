from django.conf import settings
from rest_framework import permissions, viewsets, views
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.organizations.models import OrganizationMember
from .abuse import extract_slug, process_report
from .models import AbuseReport, ShortDomain, ShortLink
from .serializers import ShortDomainSerializer, ShortLinkSerializer
from .sync import publish_link, unpublish_link, scan_and_flag
from rest_framework.permissions import IsAuthenticated
from apps.billing.permissions import HasWorkspaceAccess


class ShortLinkViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasWorkspaceAccess]
    serializer_class = ShortLinkSerializer

    def _member_org_ids(self):
        return OrganizationMember.objects.filter(user=self.request.user).values_list("organization_id", flat=True)

    def get_queryset(self):
        qs = ShortLink.objects.filter(organization_id__in=self._member_org_ids()).select_related("website")
        org = self.request.query_params.get("organization")
        return qs.filter(organization_id=org) if org else qs

    def _require_manager(self, org_id):
        m = OrganizationMember.objects.filter(organization_id=org_id, user=self.request.user).first()
        if not m or not m.can_manage:
            raise PermissionDenied("Only Owners and Admins can manage links.")

    def list(self, request, *args, **kwargs):
        """List, plus the base every short link is built on.

        The dashboard needs this to preview a link BEFORE one exists — deriving
        it from an existing row leaves a brand-new workspace previewing the wrong
        domain (the old /l/ form on the main site instead of the short domain).
        """
        response = super().list(request, *args, **kwargs)
        if not isinstance(response.data, dict):
            return response
        org = request.query_params.get("organization")
        domains = ShortDomain.for_org(org) if org else ShortDomain.objects.none()
        response.data["domains"] = ShortDomainSerializer(domains, many=True).data
        # What this workspace owns privately, and how many are left to buy.
        response.data["private"] = {
            "owned": ShortDomainSerializer(
                ShortDomain.private_for(org), many=True).data if org else [],
            "available": ShortDomain.private_stock().count(),
        }
        # Kept for the create-form preview: the default domain, or "" when the
        # service has no usable domain at all.
        default = ShortDomain.default_for(org) if org else None
        response.data["base"] = default.base if default else ""
        return response

    def create(self, request, *args, **kwargs):
        # Checked before validation: with no usable domain there is nothing to
        # validate against, and "unavailable" is a clearer answer than a field error.
        from apps.billing.models import redirects_available
        if not redirects_available():
            raise PermissionDenied(
                "Redirects are temporarily unavailable. No new links can be created right now.")
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        org = serializer.validated_data["organization"]
        from apps.billing.models import link_shortener_enabled, redirect_limit
        if not link_shortener_enabled(org.id):
            raise PermissionDenied(
                "Redirects are a paid feature. Start a plan on the Billing page to create them.")
        # The cap is PER DOMAIN, not per workspace: each domain the workspace can
        # use — the shared pool and every private domain it owns — gets its own
        # plan-sized allowance. So buying more private domains buys more capacity.
        limit = redirect_limit(org.id)
        domain = serializer.validated_data.get("domain")
        if limit and domain and ShortLink.objects.filter(
                organization_id=org.id, domain=domain).count() >= limit:
            raise PermissionDenied(
                f"You've reached your plan's redirect limit ({limit}) for this domain. "
                "Use another domain, add a private domain, or upgrade your plan.")
        link = serializer.save()
        scan_and_flag(link)   # threat scan; auto-disables if the destination is unsafe
        publish_link(link)

    def perform_update(self, serializer):
        self._require_manager(serializer.instance.organization_id)
        old_slug, old_host = serializer.instance.slug, serializer.instance.host()
        link = serializer.save()
        # A renamed redirect must stop answering on its old slug. publish_link
        # only writes the new key, so without this the old URL keeps redirecting
        # out of Redis forever — including one renamed to disown an abused link.
        if link.slug != old_slug or link.host() != old_host:
            unpublish_link(old_slug, old_host)
        scan_and_flag(link)
        publish_link(link)

    def perform_destroy(self, instance):
        self._require_manager(instance.organization_id)
        slug, host = instance.slug, instance.host()
        instance.delete()
        unpublish_link(slug, host)


# --- Public abuse reporting (no account required) -------------------------
# Anyone who receives a malicious short link must be able to tell us in a few
# seconds. If they can't, they report the domain to our registrar instead and
# every customer's links die with it.

RL_LIMIT = 10      # reports per IP
RL_WINDOW = 3600   # per hour


def _client_ip(request):
    xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "") or ""


def _rate_limited(ip) -> bool:
    try:
        from apps.rules.sync import _r
        r = _r()
        key = f"abuse:rl:{ip}"
        n = r.incr(key)
        if n == 1:
            r.expire(key, RL_WINDOW)
        return n > RL_LIMIT
    except Exception:
        return False  # never turn away a report over a Redis hiccup


class AbuseReportView(views.APIView):
    """POST {url, reason, details?, email?} — file a report on a short link."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        ip = _client_ip(request)
        if _rate_limited(ip):
            return Response(
                {"detail": "You've filed a lot of reports — please wait a while, "
                           "or email us directly so nothing gets lost."},
                status=429,
            )

        reported_url = (request.data.get("url") or "").strip()[:2000]
        if not reported_url:
            return Response({"detail": "Paste the redirect link you're reporting."}, status=400)

        reason = (request.data.get("reason") or "").strip()
        if reason not in AbuseReport.Reason.values:
            reason = AbuseReport.Reason.OTHER

        slug = extract_slug(reported_url)
        report = AbuseReport.objects.create(
            reported_url=reported_url,
            slug=slug,
            link=ShortLink.objects.filter(slug=slug).first() if slug else None,
            reason=reason,
            details=(request.data.get("details") or "").strip()[:5000],
            reporter_email=(request.data.get("email") or "").strip()[:254],
            reporter_ip=ip or None,
        )
        try:
            result = process_report(report)
        except Exception:
            # A failure here must never lose the report — it's already saved and
            # will be picked up by triage.
            result = {"matched": bool(report.link), "disabled": False}

        return Response({
            "id": report.id,
            "status": "received",
            "matched": result["matched"],
            "disabled": result["disabled"],
        }, status=201)


class PrivateDomainCheckoutView(views.APIView):
    """POST {organization} — start a one-off purchase of a private domain."""
    permission_classes = [IsAuthenticated, HasWorkspaceAccess]

    def post(self, request):
        from apps.billing import bachs
        from apps.billing.models import link_shortener_enabled
        from apps.organizations.models import OrganizationMember
        from .models import PrivateDomainPurchase
        from .purchases import mark_paid

        org_id = request.data.get("organization")
        m = OrganizationMember.objects.filter(organization_id=org_id, user=request.user).first()
        if not m or not m.can_manage:
            return Response({"detail": "Only Owners and Admins can buy a domain."}, status=403)
        if not link_shortener_enabled(org_id):
            return Response({"detail": "A private domain is an add-on to a paid plan. "
                                       "Start a plan first."}, status=403)

        # Optional: renew a specific domain the workspace already owns. Without
        # it, the purchase buys a NEW domain — a workspace may own several.
        from .models import ShortDomain
        renew_domain = None
        renew_id = request.data.get("renew_domain")
        if renew_id:
            renew_domain = ShortDomain.private_for(org_id).filter(pk=renew_id).first()
            if not renew_domain:
                return Response({"detail": "That domain isn't one of yours to renew."}, status=400)

        price = int(getattr(settings, "PRIVATE_DOMAIN_PRICE", 25))
        purchase = PrivateDomainPurchase.objects.create(
            organization_id=org_id, user=request.user, amount=price,
            renew_domain=renew_domain)

        product_id = getattr(settings, "BACHS_PRODUCT_PRIVATE_DOMAIN", "")
        if not bachs.is_enabled() or not product_id:
            if settings.DEBUG:
                mark_paid(purchase)     # local development only
                return Response({"activated": True})
            # Never hand over a domain unpaid.
            import logging
            logging.getLogger("bachs").error(
                "private domain checkout blocked: bachs_enabled=%s product_id=%r",
                bachs.is_enabled(), product_id)
            return Response({"detail": "Private domains aren't available to buy just yet. "
                                       "Contact support and we'll set one up."}, status=503)

        front = settings.FRONTEND_URL.rstrip("/")
        data, err = bachs.create_checkout_session(
            product_id=product_id,
            email=request.user.email,
            return_url=f"{front}/dashboard/links?purchase=success",
            cancel_url=f"{front}/dashboard/links?purchase=cancelled",
            metadata={"organization_id": str(org_id),
                      "kind": "private_domain_renew" if renew_domain else "private_domain",
                      "purchase_id": str(purchase.id)},
        )
        if err:
            return Response({"detail": err}, status=502)

        from apps.billing.views import _find_session_id
        purchase.bachs_session_id = _find_session_id(data)
        purchase.save(update_fields=["bachs_session_id"])
        url = (data.get("checkout_url") or data.get("url") or data.get("redirect_url")
               or (data.get("data") or {}).get("checkout_url"))
        if not url:
            return Response({"detail": "Bachs did not return a checkout URL."}, status=502)
        return Response({"checkout_url": url})


class PrivateDomainVerifyView(views.APIView):
    """POST {organization} — confirm the purchase with Bachs on return.

    Same reasoning as plan checkout: the webhook can't be the only path, or a
    paid customer waits on a delivery that may never arrive.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from apps.billing import bachs
        from apps.organizations.models import OrganizationMember
        from .models import PrivateDomainPurchase
        from .purchases import mark_paid

        org_id = request.data.get("organization")
        if not OrganizationMember.objects.filter(organization_id=org_id, user=request.user).exists():
            return Response({"detail": "Not a member of this workspace."}, status=403)

        pending = (PrivateDomainPurchase.objects
                   .filter(organization_id=org_id,
                           status=PrivateDomainPurchase.Status.PENDING)
                   .exclude(bachs_session_id="").first())
        if not pending:
            return Response({"paid": False})

        data, err = bachs.get_checkout_session(pending.bachs_session_id)
        if err or not bachs.session_is_paid(data):
            return Response({"paid": False})

        domain = mark_paid(pending)
        return Response({"paid": True, "host": domain.host if domain else "",
                         "awaiting_stock": domain is None})


def _reserved_hosts() -> set:
    """Our own domains — a customer must never be able to claim these."""
    out = set()
    for key in ("DOMAIN", "SHORT_DOMAIN", "SHORT_DOMAINS", "SHORT_DOMAINS_PRIVATE"):
        for h in str(getattr(settings, key, "") or "").split(","):
            h = h.strip().lower()
            if h:
                out.add(h)
    return out


class CustomDomainView(views.APIView):
    """Bring-your-own-domain management.

    GET  ?organization=  -> list this workspace's custom domains + status.
    POST {organization, host} -> add one; returns the DNS records to set.
    """
    permission_classes = [IsAuthenticated, HasWorkspaceAccess]

    def _manager(self, org_id):
        m = OrganizationMember.objects.filter(organization_id=org_id, user=self.request.user).first()
        return m and m.can_manage

    def get(self, request):
        org_id = request.query_params.get("organization")
        if not self._manager(org_id):
            raise PermissionDenied("Only Owners and Admins can manage domains.")
        return Response({"domains": [self._row(d) for d in
                                     ShortDomain.byod_for(org_id).order_by("host")]})

    def post(self, request):
        from apps.billing.models import link_shortener_enabled
        from .customdomains import new_token, valid_host, txt_name

        org_id = request.data.get("organization")
        if not self._manager(org_id):
            raise PermissionDenied("Only Owners and Admins can add a domain.")
        if not link_shortener_enabled(org_id):
            return Response({"detail": "Custom domains need an active plan."}, status=403)

        host = str(request.data.get("host", "")).strip().lower()
        # tolerate a pasted URL
        host = host.replace("https://", "").replace("http://", "").split("/")[0]
        if not valid_host(host):
            return Response({"detail": "That doesn't look like a valid domain (e.g. go.yourbrand.com)."}, status=400)
        if host in _reserved_hosts():
            return Response({"detail": "That domain isn't available."}, status=400)
        if ShortDomain.objects.filter(host=host).exists():
            return Response({"detail": "That domain is already in use."}, status=409)

        d = ShortDomain.objects.create(
            host=host, organization_id=org_id, byod=True, is_shared=False,
            active=True, verify_token=new_token())
        return Response(self._row(d), status=201)

    def _row(self, d):
        from .customdomains import txt_name
        front = str(getattr(settings, "DOMAIN", "") or "").strip()
        return {
            "id": d.id, "host": d.host, "verified": bool(d.verified_at),
            "verify": {
                "txt_name": txt_name(d.host),
                "txt_value": d.verify_token,
                "cname_target": front or "redirects.trynobot.com",
            },
        }


class CustomDomainVerifyView(views.APIView):
    permission_classes = [IsAuthenticated, HasWorkspaceAccess]

    def post(self, request, pk):
        from .customdomains import verify_txt
        d = ShortDomain.objects.filter(pk=pk, byod=True).first()
        if not d:
            return Response({"detail": "Domain not found."}, status=404)
        m = OrganizationMember.objects.filter(organization_id=d.organization_id,
                                              user=request.user).first()
        if not m or not m.can_manage:
            raise PermissionDenied("Only Owners and Admins can verify a domain.")
        if d.verified_at:
            return Response({"verified": True, "message": "Already verified."})
        if not verify_txt(d.host, d.verify_token):
            return Response({"verified": False,
                             "message": "We couldn't find the TXT record yet. DNS can take a few "
                                        "minutes — double-check the record and try again."}, status=400)
        from django.utils import timezone
        d.verified_at = timezone.now()
        d.save(update_fields=["verified_at"])
        return Response({"verified": True,
                         "message": "Verified! You can now use this domain for redirects. "
                                    "HTTPS is set up automatically the first time it's visited."})


class CustomDomainDeleteView(views.APIView):
    permission_classes = [IsAuthenticated, HasWorkspaceAccess]

    def delete(self, request, pk):
        d = ShortDomain.objects.filter(pk=pk, byod=True).first()
        if not d:
            return Response(status=204)
        m = OrganizationMember.objects.filter(organization_id=d.organization_id,
                                              user=request.user).first()
        if not m or not m.can_manage:
            raise PermissionDenied("Only Owners and Admins can remove a domain.")
        if ShortLink.objects.filter(domain=d).exists():
            return Response({"detail": "Remove the redirects on this domain first."}, status=409)
        d.delete()
        return Response(status=204)


class TLSAllowedView(views.APIView):
    """Public 'ask' endpoint for the on-demand-TLS front door (Caddy): only
    issue a certificate for a domain we actually recognise as a verified,
    active customer domain. Anything else is refused, so we never fetch certs
    for random hostnames pointed at us."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        host = str(request.query_params.get("domain", "")).strip().lower()
        ok = bool(host) and ShortDomain.objects.filter(
            host=host, byod=True, active=True, verified_at__isnull=False).exists()
        return Response(status=200 if ok else 404)
