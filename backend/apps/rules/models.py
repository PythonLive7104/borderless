from django.db import models
from apps.organizations.models import Organization

# Fields a condition can test (shared contract with the Go engine).
FIELD_CHOICES = [
    ("risk_score", "Risk score"), ("requests_per_min", "Requests/minute"), ("classification", "Classification"),
    ("country", "Country"), ("device", "Device"), ("browser", "Browser"), ("os", "OS"),
    ("is_bot", "Bot detected"), ("is_proxy", "Proxy/Datacenter"),
    ("utm_source", "UTM source"), ("utm_medium", "UTM medium"), ("utm_campaign", "UTM campaign"),
    ("referrer", "Referrer"), ("ja3", "TLS/JA3 hash"), ("path", "URL path"),
]
OP_CHOICES = [
    ("eq", "equals"), ("ne", "not equals"), ("gt", "greater than"), ("gte", "≥"),
    ("lt", "less than"), ("lte", "≤"), ("contains", "contains"), ("in", "in list"),
]


class TrafficRule(models.Model):
    class Action(models.TextChoices):
        ALLOW = "allow", "Allow"
        REDIRECT = "redirect", "Redirect"
        BLOCK = "block", "Block"
        REVIEW = "review", "Review"
        TAG = "tag", "Tag"

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="rules")
    website = models.ForeignKey("websites.Website", on_delete=models.CASCADE, null=True, blank=True,
                                related_name="site_rules",
                                help_text="Which website this rule applies to. Empty = all websites in the workspace.")
    name = models.CharField(max_length=120)
    priority = models.IntegerField(default=100, help_text="Lower runs first; first match wins")
    action = models.CharField(max_length=8, choices=Action.choices, default=Action.REVIEW)
    tag = models.CharField(max_length=60, blank=True, help_text="Label applied when action = Tag")
    redirect_url = models.URLField(blank=True, help_text="Where to send traffic when action = Redirect")
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["priority", "id"]

    def __str__(self):
        return f"{self.name} → {self.action}"


class RuleCondition(models.Model):
    rule = models.ForeignKey(TrafficRule, on_delete=models.CASCADE, related_name="conditions")
    field = models.CharField(max_length=20, choices=FIELD_CHOICES)
    operator = models.CharField(max_length=8, choices=OP_CHOICES)
    value = models.CharField(max_length=200)

    def __str__(self):
        return f"{self.field} {self.operator} {self.value}"


class IPListEntry(models.Model):
    """A workspace IP allow/deny entry. Accepts an exact IP or a CIDR range.

    Enforced on the Go hot path: an allow (whitelist) match always passes,
    a deny (blacklist) match is blocked outright — both take precedence over
    the scored traffic rules.
    """
    class Kind(models.TextChoices):
        ALLOW = "allow", "Allow (whitelist)"
        DENY = "deny", "Deny (blacklist)"

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="ip_entries")
    value = models.CharField(max_length=64, help_text="Exact IP or CIDR, e.g. 1.2.3.4 or 10.0.0.0/8")
    kind = models.CharField(max_length=5, choices=Kind.choices, default=Kind.DENY)
    note = models.CharField(max_length=160, blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ("organization", "value", "kind")

    def __str__(self):
        return f"{self.kind}:{self.value}"
