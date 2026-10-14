"""Customer testimonials: collected in-app, moderated, then published.

Nothing here reaches the marketing site on its own. A testimonial is written by
a customer, approved by a human, and only then exported to the site — because
every one of these is a public claim attributed to a named person at a named
company, and the two ways that goes wrong are both expensive:

  * Publishing without permission. `consent` is stored as an explicit boolean
    the submitter had to tick, alongside the exact wording they agreed to and
    when. Without it the row can never be approved. "They said something nice
    in a support ticket" is not consent to put their name on a landing page.
  * Publishing a performance claim we cannot stand behind. A quote saying a
    customer saved 40% is an advertising claim WE are responsible for, not
    just a thing they said — the FTC, ASA and ACCC all treat it that way. The
    moderation step exists to catch those, which is why approval is manual and
    there is no auto-publish path.

The same caution the rest of this codebase already applies to its own metrics
(see Landing.tsx METRICS) applies here, with the added wrinkle that the words
are somebody else's.
"""
from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.organizations.models import Organization

# The wording the submitter ticks. Stored per-row so that if it is ever
# reworded, existing rows still record what their author actually agreed to.
CONSENT_TEXT = (
    "I agree that TryNoBot may publish this testimonial, along with my name, "
    "role and company, on its website and marketing materials."
)


class Testimonial(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending review"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="testimonials")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
        related_name="testimonials",
        help_text="Who submitted it. Kept null-able so deleting a user does not "
                  "delete a testimonial they consented to publish.")

    quote = models.TextField(max_length=400)
    author_name = models.CharField(max_length=120)
    author_role = models.CharField(max_length=160, blank=True)
    author_company = models.CharField(max_length=160, blank=True)
    country = models.CharField(max_length=80, blank=True)
    rating = models.PositiveSmallIntegerField(
        default=5, help_text="1-5. Published as Review schema, so it must be what they gave.")

    consent = models.BooleanField(
        default=False,
        help_text="Explicit permission to publish. Approval is refused without it.")
    consent_text = models.TextField(
        blank=True, help_text="The exact wording agreed to, as shown at submission.")
    consent_at = models.DateTimeField(null=True, blank=True)

    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    # Approved but not featured still means published-eligible; featured is the
    # smaller set the landing page carousel shows.
    featured = models.BooleanField(
        default=False, help_text="Show in the carousel on the landing page.")
    sort = models.IntegerField(default=0, help_text="Lower sorts first within featured.")

    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="testimonials_reviewed")
    # Why it was rejected. Internal only — never shown to the submitter, who
    # should not be told their praise wasn't good enough.
    review_note = models.CharField(max_length=300, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("sort", "-created_at")
        indexes = [models.Index(fields=["status", "featured"])]

    def __str__(self):
        return f"{self.author_name} ({self.get_status_display()})"

    @property
    def publishable(self) -> bool:
        """Approved AND consented. Both, always — an approval cannot stand in
        for permission the customer never gave."""
        return self.status == self.Status.APPROVED and self.consent

    def approve(self, by=None, featured=False):
        if not self.consent:
            raise ValueError("Cannot approve a testimonial without consent to publish.")
        self.status = self.Status.APPROVED
        self.featured = featured
        self.reviewed_at = timezone.now()
        self.reviewed_by = by
