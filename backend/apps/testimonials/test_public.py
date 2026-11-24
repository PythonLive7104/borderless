"""The public testimonials endpoint — what the landing page now reads live.

The thing that must hold: it shows exactly what the admin published (approved +
consented + featured) and nothing else — never a pending one, never one without
consent, never an approved-but-not-featured one. Those are the ways a
moderation gate leaks.
"""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.organizations.models import create_workspace
from apps.testimonials.models import Testimonial

_SEQ = {"n": 0}


def _t(org, user, **kw):
    _SEQ["n"] += 1
    defaults = dict(organization=org, author=user, quote="Great tool",
                    author_name="Jane", author_role="CMO", author_company="Acme",
                    rating=5, consent=True, status=Testimonial.Status.APPROVED,
                    featured=True)
    defaults.update(kw)
    return Testimonial.objects.create(**defaults)


class PublicTestimonialsTest(TestCase):
    def setUp(self):
        self.c = APIClient()
        self.user = get_user_model().objects.create_user(
            username="t@pub.example", email="t@pub.example", password="x")
        self.org = create_workspace(self.user, "Acme")

    def _t(self, **kw):
        return _t(self.org, self.user, **kw)

    def test_a_featured_approved_consented_one_is_shown(self):
        self._t(author_name="Shown")
        r = self.c.get("/api/testimonials/")
        self.assertEqual(r.status_code, 200)
        names = [t["name"] for t in r.json()]
        self.assertIn("Shown", names)

    def test_the_public_shape_omits_private_fields(self):
        self._t()
        row = self.c.get("/api/testimonials/").json()[0]
        self.assertEqual(set(row), {"quote", "name", "role", "company", "rating"})
        self.assertNotIn("consent", row)
        self.assertNotIn("id", row)

    def test_a_pending_one_is_hidden(self):
        self._t(author_name="Pending", status=Testimonial.Status.PENDING)
        names = [t["name"] for t in self.c.get("/api/testimonials/").json()]
        self.assertNotIn("Pending", names)

    def test_an_approved_but_not_featured_one_is_hidden(self):
        """Featuring is the publish action, matching export_testimonials."""
        self._t(author_name="NotFeatured", featured=False)
        names = [t["name"] for t in self.c.get("/api/testimonials/").json()]
        self.assertNotIn("NotFeatured", names)

    def test_one_without_consent_is_never_shown(self):
        # Shouldn't exist (approve() refuses), but guard the read path too.
        Testimonial.objects.create(organization=self.org, author=self.user,
                                   quote="x", author_name="NoConsent", rating=5,
                                   consent=False, status=Testimonial.Status.APPROVED,
                                   featured=True)
        names = [t["name"] for t in self.c.get("/api/testimonials/").json()]
        self.assertNotIn("NoConsent", names)

    def test_no_auth_required(self):
        self._t()
        r = APIClient().get("/api/testimonials/")   # no credentials at all
        self.assertEqual(r.status_code, 200)

    def test_ordering_follows_sort_then_recency(self):
        self._t(author_name="Second", sort=2)
        self._t(author_name="First", sort=1)
        names = [t["name"] for t in self.c.get("/api/testimonials/").json()]
        self.assertEqual(names.index("First"), 0)

    def test_the_live_query_matches_the_export_query(self):
        """The public endpoint and the build-time export must publish the same
        set, or the live page and the crawler page disagree."""
        from apps.testimonials.views import PublishedTestimonialsView
        self._t(author_name="A"); self._t(author_name="B", featured=False)
        self._t(author_name="C", status=Testimonial.Status.PENDING)
        export_q = (Testimonial.objects
                    .filter(status=Testimonial.Status.APPROVED, consent=True, featured=True)
                    .order_by("sort", "-created_at"))
        live_q = PublishedTestimonialsView().get_queryset()
        self.assertEqual(list(live_q.values_list("pk", flat=True)),
                         list(export_q.values_list("pk", flat=True)))
