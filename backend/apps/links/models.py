import secrets
from django.db import models
from apps.organizations.models import Organization
from apps.websites.models import Website


def gen_slug() -> str:
    # short, url-safe, no ambiguous separators
    return secrets.token_urlsafe(8).replace("_", "").replace("-", "")[:8]


class ShortDomain(models.Model):
    """A domain that serves short links.

    Rows with organization=None are the platform pool: domains we own and offer
    to everyone. Spreading links across several means one blocklisting can't
    take every customer's links down at once, and a burned domain can be
    retired by flipping `active` without touching the links themselves.

    A row with an organization set is a customer's own domain — the schema is
    ready for it, but issuing certificates per customer domain is not built yet,
    so `verified_at` stays the gate.
    """
    host = models.CharField(max_length=190, unique=True,
                            help_text='Bare hostname, e.g. "trynb.cc" — no scheme, no trailing slash.')
    organization = models.ForeignKey(Organization, on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name="short_domains",
                                     help_text="Set = private to that workspace. Empty = shared, or unsold stock.")
    # Three states, not two:
    #   is_shared=True,  organization=None  -> the public pool, everyone uses it
    #   is_shared=False, organization=None  -> bought but unsold, nobody sees it
    #   is_shared=False, organization=<org> -> private, only that workspace
    # Without this flag an unsold domain would silently appear in every
    # customer's dropdown the moment we registered it.
    is_shared = models.BooleanField(
        default=True,
        help_text="In the pool everyone can use. Uncheck for stock held back to sell privately.")
    # A private domain is rented, not bought outright: each payment extends this.
    # Past it the domain enters a grace period during which links keep working
    # and the owner is reminded — reclaiming a domain that is carrying live
    # traffic without warning would break campaigns already in the wild.
    private_until = models.DateTimeField(
        null=True, blank=True,
        help_text="Paid through this date. Only meaningful for a private domain.")

    PRIVATE_GRACE_DAYS = 14

    @property
    def private_expired(self) -> bool:
        from django.utils import timezone as tz
        return bool(self.organization_id and self.private_until
                    and tz.now() > self.private_until)

    @property
    def private_grace_ends(self):
        from datetime import timedelta
        return self.private_until + timedelta(days=self.PRIVATE_GRACE_DAYS) if self.private_until else None
    active = models.BooleanField(default=True,
                                 help_text="Uncheck to retire a domain; its links stop resolving.")
    is_default = models.BooleanField(default=False, help_text="Pre-selected when creating a redirect.")
    verified_at = models.DateTimeField(null=True, blank=True,
                                       help_text="Our own domains are verified on creation.")
    sort = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort", "host"]

    def __str__(self):
        return self.host

    @property
    def base(self) -> str:
        return f"https://{self.host}"

    @property
    def usable(self) -> bool:
        return bool(self.active and self.verified_at)

    @classmethod
    def for_org(cls, organization_id):
        """Domains this workspace may publish on: the shared pool plus its own.

        Unsold private stock belongs to neither and is deliberately excluded —
        a domain someone paid for must not be usable by anyone else.
        """
        from django.db.models import Q
        return cls.objects.filter(active=True, verified_at__isnull=False).filter(
            Q(is_shared=True, organization__isnull=True) | Q(organization_id=organization_id))

    @classmethod
    def private_stock(cls):
        """Registered, verified domains held back for private sale."""
        return cls.objects.filter(active=True, verified_at__isnull=False,
                                  is_shared=False, organization__isnull=True)

    @classmethod
    def private_for(cls, organization_id):
        return cls.objects.filter(active=True, is_shared=False,
                                  organization_id=organization_id)

    @classmethod
    def default_for(cls, organization_id):
        qs = cls.for_org(organization_id)
        return qs.filter(is_default=True).first() or qs.first()


class ShortLink(models.Model):
    """A branded short link. Each click is scored by the bot engine and, when a
    website is attached, filtered by that site's Traffic Rules. Real humans go to
    the destination; bots follow the org's block/redirect rule (or are just logged)."""
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="short_links")
    website = models.ForeignKey(Website, on_delete=models.SET_NULL, null=True, blank=True,
                                related_name="short_links",
                                help_text="Optional — which site's Traffic Rules apply to clicks.")
    # Which domain serves this link. Slugs are unique PER DOMAIN, so two
    # workspaces on different domains can both use /promo.
    domain = models.ForeignKey(ShortDomain, on_delete=models.PROTECT, null=True, blank=True,
                               related_name="links")
    slug = models.SlugField(max_length=200, default=gen_slug)
    destination_url = models.URLField(max_length=2000)
    title = models.CharField(max_length=120, blank=True)
    active = models.BooleanField(default=True)

    class BotAction(models.TextChoices):
        DESTINATION = "off", "Send them to the destination too"
        DECOY = "decoy", "A decoy page"
        NOTFOUND = "notfound", "A 404 page"
        BLANK = "blank", "A blank page"

    # What automated traffic gets. Real visitors always go to the destination.
    bot_action = models.CharField(max_length=10, choices=BotAction.choices, default=BotAction.DECOY)

    # Interstitial "click to continue" check. Only shown to visitors we'd
    # otherwise let through — bots already get bot_action — so it catches the
    # automation the scorer missed rather than taxing everyone twice.
    challenge = models.BooleanField(
        default=False,
        help_text="Ask visitors to confirm they're human before redirecting.")

    class ChallengeStyle(models.TextChoices):
        HOLD = "hold", "Press and hold (5 seconds)"
        CHECKBOX = "checkbox", "Tick a box"
        SLIDE = "slide", "Slide to continue"

    # Which check the visitor gets. All three are verified the same way on the
    # server; they differ only in the interaction, so pick whichever suits the
    # audience. The minimum dwell time is enforced per style in the engine.
    challenge_style = models.CharField(max_length=10, choices=ChallengeStyle.choices,
                                       default=ChallengeStyle.HOLD)

    # Pass ?utm_source=…&rid=… from the short link through to the destination.
    # Off by default: forwarding is what personalised survey/campaign links need,
    # but those params often carry PII, so it's an explicit opt-in per link.
    forward_params = models.BooleanField(
        default=False,
        help_text="Forward the link's query string on to the destination.")
    # Comma-separated allow-list of parameter names, e.g. "email,rid". Blank
    # means forward everything. Naming them is the safer default: only what the
    # campaign actually needs reaches the destination, and stray tracking junk
    # picked up in transit is dropped.
    forward_param_keys = models.CharField(
        max_length=300, blank=True, default="",
        help_text='Only forward these parameters, e.g. "email,rid". Blank = all.')

    def forward_keys(self) -> list:
        return [k.strip() for k in self.forward_param_keys.split(",") if k.strip()]

    # VPN / proxy / Tor / datacenter (which is where RDP sessions come from).
    # Surfaced as one plain switch here because the equivalent Traffic Rule
    # ("Proxy/Datacenter is Yes") is buried where nobody finds it.
    block_vpn = models.BooleanField(
        default=False,
        help_text="Give VPN, proxy and datacenter/RDP visitors the bot handling.")

    # Country gate. Expressed as a plain list rather than making the user build
    # a rule, because "only these countries" is the single most common thing an
    # advertiser wants and shouldn't require learning the rule builder.
    class CountryMode(models.TextChoices):
        OFF = "off", "Everywhere"
        ALLOW = "allow", "Only these countries"
        BLOCK = "block", "Everywhere except these"

    country_mode = models.CharField(max_length=6, choices=CountryMode.choices,
                                    default=CountryMode.OFF)
    countries = models.CharField(
        max_length=400, blank=True, default="",
        help_text='Comma-separated ISO-2 codes, e.g. "US,CA,GB".')

    # Same shape for device and OS: a mode plus a short list. Deliberately not
    # the rule builder — "block Android" shouldn't require learning conditions,
    # operators and priorities.
    device_mode = models.CharField(max_length=6, choices=CountryMode.choices,
                                   default=CountryMode.OFF)
    devices = models.CharField(max_length=100, blank=True, default="",
                               help_text="Comma-separated: mobile, desktop, tablet")
    os_mode = models.CharField(max_length=6, choices=CountryMode.choices,
                               default=CountryMode.OFF)
    operating_systems = models.CharField(max_length=200, blank=True, default="",
                                         help_text="Comma-separated: windows, macos, ios, android, linux")
    # Visitors scoring at or above this are treated as bots. 0 = no extra limit.
    max_risk = models.IntegerField(
        default=0, help_text="Refuse visitors at or above this risk score (0 = off).")

    def country_list(self) -> list:
        return [c.strip().upper() for c in self.countries.split(",") if c.strip()]

    def device_list(self) -> list:
        return [d.strip().lower() for d in self.devices.split(",") if d.strip()]

    def os_list(self) -> list:
        return [o.strip().lower() for o in self.operating_systems.split(",") if o.strip()]

    clicks = models.IntegerField(default=0)
    human_clicks = models.IntegerField(default=0)
    bot_clicks = models.IntegerField(default=0)

    # Where bots go when bot_action is "decoy". Blank means our built-in decoy
    # page, served from this link's OWN short domain — never the brand domain,
    # which would hand a bot another domain of ours to report.
    decoy_url = models.URLField(
        blank=True, default="",
        help_text="Send bots to your own page instead of the built-in decoy. Blank = built-in.")

    # Threat scan of the destination (Safe Browsing / VirusTotal). A link that
    # resolves to malware/phishing is auto-disabled so it can't be abused.
    url_safe = models.BooleanField(null=True, blank=True)
    url_threats = models.JSONField(default=list, blank=True)
    url_scanned_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["domain", "slug"], name="uniq_slug_per_domain"),
        ]

    def __str__(self):
        return f"{self.host_slug()} -> {self.destination_url}"

    def host(self) -> str:
        return self.domain.host if self.domain_id else ""

    def host_slug(self) -> str:
        """The Redis key body: a slug is only meaningful together with its host."""
        return f"{self.host()}/{self.slug}"

# Slugs the short domain serves itself (abuse reporting, bot pages). A link can
# never claim one, or it would shadow the page a complainant is trying to reach.
RESERVED_SLUGS = {
    "report", "abuse", "decoy", "blocked", "not-found", "unauthorized",
    "favicon.ico", "robots.txt", "l", "api", "admin",
}


class AbuseReport(models.Model):
    """A public report that a short link is being used for phishing/malware/spam.

    Anyone can file one, with no account — that's the point. A report we can tie
    to a live link re-scans its destination immediately; only a confirmed threat
    disables the link, everything else waits for a human. Being reachable and
    fast here is what stops a complainant escalating to the registrar instead."""

    class Reason(models.TextChoices):
        PHISHING = "phishing", "Phishing / fake login page"
        MALWARE = "malware", "Malware or harmful download"
        SPAM = "spam", "Spam (unsolicited email or SMS)"
        SCAM = "scam", "Scam or fraud"
        OTHER = "other", "Something else"

    class Status(models.TextChoices):
        NEW = "new", "New"
        ACTIONED = "actioned", "Actioned — link disabled"
        DISMISSED = "dismissed", "Dismissed — no action needed"

    # Kept even if the link is deleted, so the audit trail survives a cleanup.
    link = models.ForeignKey(ShortLink, on_delete=models.SET_NULL, null=True, blank=True,
                             related_name="abuse_reports")
    slug = models.CharField(max_length=200, blank=True, db_index=True)
    reported_url = models.CharField(max_length=2000)
    reason = models.CharField(max_length=16, choices=Reason.choices, default=Reason.PHISHING)
    details = models.TextField(blank=True)
    # Optional — a reporter who leaves one gets told what we did about it.
    reporter_email = models.EmailField(blank=True)
    reporter_ip = models.GenericIPAddressField(null=True, blank=True)

    status = models.CharField(max_length=12, choices=Status.choices, default=Status.NEW, db_index=True)
    auto_disabled = models.BooleanField(
        default=False,
        help_text="The threat scan triggered by this report disabled the link.")
    scan_result = models.JSONField(default=dict, blank=True,
                                   help_text="Threat scan run at the moment the report arrived.")

    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "-created_at"])]

    def __str__(self):
        return f"{self.reason} report on /{self.slug or '?'} ({self.status})"


class PrivateDomainPurchase(models.Model):
    """Someone buying exclusive use of a short domain.

    Held as its own record rather than a subscription change: it's a one-off,
    it can be paid for before we have stock to hand over, and the fulfilment
    (assigning a real domain) is a separate step from the payment.
    """
    class Status(models.TextChoices):
        PENDING = "pending", "Awaiting payment"
        PAID = "paid", "Paid — awaiting a domain"
        FULFILLED = "fulfilled", "Domain assigned"
        REFUNDED = "refunded", "Refunded"

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE,
                                     related_name="private_domain_purchases")
    user = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, blank=True,
                             related_name="private_domain_purchases")
    amount = models.IntegerField(help_text="USD charged.")
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING,
                              db_index=True)
    bachs_session_id = models.CharField(max_length=120, blank=True, default="", db_index=True)
    domain = models.ForeignKey(ShortDomain, on_delete=models.SET_NULL, null=True, blank=True,
                               related_name="purchases")
    note = models.CharField(max_length=200, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    fulfilled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.organization.slug} · private domain · {self.status}"
