from rest_framework import serializers
from django.conf import settings
from apps.organizations.models import OrganizationMember
from .models import RESERVED_SLUGS, ShortDomain, ShortLink, gen_slug


class ShortLinkSerializer(serializers.ModelSerializer):
    short_url = serializers.SerializerMethodField()
    quality = serializers.SerializerMethodField()
    slug = serializers.SlugField(max_length=200, required=False)
    domain_host = serializers.CharField(source="domain.host", read_only=True, default="")
    scan_locked = serializers.SerializerMethodField()

    class Meta:
        model = ShortLink
        fields = ["id", "organization", "website", "slug", "destination_url", "title",
                  "domain", "domain_host", "active", "bot_action", "challenge", "challenge_style", "forward_params", "forward_param_keys", "block_vpn", "block_datacenter", "deep_check", "decoy_url", "country_mode", "countries", "device_mode", "devices",
                  "os_mode", "operating_systems", "max_risk", "scan_optout", "clicks", "human_clicks", "bot_clicks", "reviewer_clicks", "url_safe",
                  "url_threats", "url_scanned_at", "short_url", "quality", "scan_locked", "created_at"]
        read_only_fields = ["clicks", "human_clicks", "bot_clicks", "reviewer_clicks", "url_safe", "url_threats",
                            "url_scanned_at", "created_at"]

    def get_short_url(self, obj) -> str:
        # A dedicated short domain serves bare-slug links at the root
        # (nobot.link/<slug>). Without one, fall back to the main app domain,
        # which only routes /l/ to the engine — so keep the /l/ prefix there.
        # No short domain configured (or it was pulled after abuse) => no link.
        # Never fall back to the main domain: that would serve redirects from the
        # brand we isolated them from in the first place.
        # Built from the link's own domain row. No domain (or a retired one)
        # means no link — never fall back to another domain of ours.
        return f"{obj.domain.base}/{obj.slug}" if obj.domain_id and obj.domain.active else ""

    def get_quality(self, obj) -> float:
        return round(obj.human_clicks / obj.clicks, 4) if obj.clicks else 0.0

    def get_scan_locked(self, obj) -> bool:
        """True when Google confirmed phishing/malware and this cannot be undone.

        The dashboard uses it to drop the "make it live anyway" control, so the
        UI stops offering something the API will refuse.
        """
        from .sync import _flagged_by_from_threats
        if obj.url_safe is not False:
            return False
        return "google_safe_browsing" in _flagged_by_from_threats(obj.url_threats)

    def validate_organization(self, org):
        from apps.organizations.models import ensure_membership
        user = self.context["request"].user
        m = ensure_membership(user, org)
        if not m:
            raise serializers.ValidationError("You are not a member of this workspace.")
        if not m.can_manage:
            raise serializers.ValidationError("Only Owners and Admins can manage links.")
        return org

    def validate_slug(self, slug):
        # The short domain serves /report and the bot pages itself; a link with
        # one of those slugs would shadow the page a complainant needs.
        if slug.lower() in RESERVED_SLUGS:
            raise serializers.ValidationError(f'"{slug}" is reserved — pick another.')
        return slug

    def validate_domain(self, domain):
        org = self.initial_data.get("organization") or getattr(self.instance, "organization_id", None)
        if domain and org and not ShortDomain.for_org(org).filter(pk=domain.pk).exists():
            raise serializers.ValidationError("That domain isn't available to this workspace.")
        return domain

    def validate(self, attrs):
        website = attrs.get("website")
        org = attrs.get("organization") or getattr(self.instance, "organization", None)
        if website and org and website.organization_id != org.id:
            raise serializers.ValidationError({"website": "That website isn't in this workspace."})

        # A link Google has confirmed as phishing or malware stays off.
        #
        # Enforced here and not only in the UI: hiding the button stops an
        # honest mistake, it does not stop someone sending the PATCH by hand,
        # and the whole point is that this particular lock cannot be picked.
        # Changing the destination is allowed and is the way back — the next
        # scan re-enables the link if the new destination is clean.
        if self.instance is not None and self.get_scan_locked(self.instance):
            changing_destination = (
                "destination_url" in attrs
                and attrs["destination_url"] != self.instance.destination_url)
            if not changing_destination:
                if attrs.get("active") and not self.instance.active:
                    raise serializers.ValidationError({"active": (
                        "Google Safe Browsing flagged this destination as phishing or "
                        "malware, so this redirect can't be switched back on. Point it "
                        "at a safe destination instead.")})
                if attrs.get("scan_optout") and not self.instance.scan_optout:
                    raise serializers.ValidationError({"scan_optout": (
                        "The safety scan can't be skipped for a destination Google has "
                        "confirmed as phishing or malware.")})
        return attrs

    def create(self, validated_data):
        if not validated_data.get("slug"):
            validated_data["slug"] = gen_slug()
        if not validated_data.get("domain"):
            validated_data["domain"] = ShortDomain.default_for(validated_data["organization"].id)
        return super().create(validated_data)


class ShortDomainSerializer(serializers.ModelSerializer):
    base = serializers.CharField(read_only=True)
    # When the links actually stop resolving, which is NOT the expiry date —
    # there is a grace period after it. The dashboard needs the real deadline to
    # tell someone how long they have, rather than implying it is already gone.
    private_grace_ends = serializers.DateTimeField(read_only=True)

    class Meta:
        model = ShortDomain
        fields = ["id", "host", "base", "is_default", "is_shared", "private_until",
                  "private_grace_ends"]
