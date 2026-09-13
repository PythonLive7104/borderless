import secrets
from django.conf import settings
from django.db import models, transaction
from django.utils.text import slugify


class Role(models.TextChoices):
    OWNER = "owner", "Owner"
    ADMIN = "admin", "Admin"
    ANALYST = "analyst", "Analyst"


def _token() -> str:
    return secrets.token_urlsafe(24)


class Organization(models.Model):
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140, unique=True)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                              related_name="owned_organizations")
    # When True, a redirect flagged by the destination scan is NOT auto-disabled
    # — EXCEPT a Google Safe Browsing hit on a shared domain, which is always
    # disabled to protect every other customer on that domain.
    link_scan_optout = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name) or "workspace"
            slug, i = base, 1
            while Organization.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                i += 1
                slug = f"{base}-{i}"
            self.slug = slug
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class OrganizationMember(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="members")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="memberships")
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.ANALYST)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("organization", "user")
        ordering = ["created_at"]

    @property
    def can_manage(self) -> bool:
        return self.role in (Role.OWNER, Role.ADMIN)

    def __str__(self):
        return f"{self.user} @ {self.organization} ({self.role})"


class Invitation(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="invitations")
    email = models.EmailField()
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.ANALYST)
    token = models.CharField(max_length=48, unique=True, default=_token, db_index=True)
    invited_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def pending(self) -> bool:
        return self.accepted_at is None


def create_workspace(user, name: str) -> Organization:
    """Create an organization and add the user as its owner. Atomic, so we can
    never end up with an org whose owner has no membership row — the drift that
    locked owners out of their own workspace with "not a member"."""
    with transaction.atomic():
        org = Organization.objects.create(name=name, owner=user)
        OrganizationMember.objects.create(organization=org, user=user, role=Role.OWNER)
    return org


def ensure_membership(user, org):
    """Return the user's membership for org, self-healing the owner's row if it
    drifted missing. Returns None for a genuine non-member."""
    m = OrganizationMember.objects.filter(organization=org, user=user).first()
    if m:
        return m
    if org.owner_id == user.id:
        m, _ = OrganizationMember.objects.get_or_create(
            organization=org, user=user, defaults={"role": Role.OWNER})
        return m
    return None
