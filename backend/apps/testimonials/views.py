"""Submit (customer), moderate (staff), and read (public) endpoints.

The marketing site still renders testimonials from the static data file that
`export_testimonials` generates — that is what keeps the landing page
pre-rendered, so the Review markup is in the HTML a crawler receives. The public
read endpoint below is a LIVE layer on top of that, not a replacement: the
landing page shows the exported (crawler-visible) set immediately, then upgrades
to the live set after hydration. This is what makes "approve + feature a
testimonial in the admin" put it on the site at once, instead of waiting for the
next deploy's export — the gap that made publishing one feel impossible.
"""
from django.utils import timezone
from rest_framework import generics, permissions, status, views
from rest_framework.response import Response

from apps.organizations.models import OrganizationMember

from .models import Testimonial
from .serializers import (TestimonialAdminSerializer, TestimonialPublicSerializer,
                          TestimonialSubmitSerializer)


class PublishedTestimonialsView(generics.ListAPIView):
    """Public: the featured, approved, consented testimonials for the site.

    Exactly the query `export_testimonials` writes to the static file, so the
    live fetch and the build-time export never disagree about what is published.
    AllowAny with no authentication — it is public marketing content.
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    serializer_class = TestimonialPublicSerializer
    # A plain array, not a paginated envelope: the set is tiny (a handful of
    # featured quotes), the marketing site consumes it as a list, and it mirrors
    # the static data file's shape. Pagination here would break the carousel.
    pagination_class = None

    def get_queryset(self):
        return (Testimonial.objects
                .filter(status=Testimonial.Status.APPROVED, consent=True, featured=True)
                .order_by("sort", "-created_at"))


class IsStaff(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)


class MyTestimonialView(views.APIView):
    """The caller's own testimonial for a workspace: read one, or submit one.

    One per person per workspace. A resubmission edits the pending row rather
    than stacking up, so rewording a review doesn't leave a human comparing
    near-duplicates.
    """
    permission_classes = [permissions.IsAuthenticated]

    def _member(self, request):
        org_id = request.query_params.get("organization") or request.data.get("organization")
        if not org_id:
            return None
        return OrganizationMember.objects.filter(
            user=request.user, organization_id=org_id).first()

    def get(self, request):
        member = self._member(request)
        if not member:
            return Response({"detail": "Workspace not found."}, status=404)
        existing = Testimonial.objects.filter(
            organization_id=member.organization_id, author=request.user).first()
        return Response({
            "testimonial": TestimonialSubmitSerializer(existing).data if existing else None,
        })

    def post(self, request):
        member = self._member(request)
        if not member:
            return Response({"detail": "Workspace not found."}, status=404)

        existing = Testimonial.objects.filter(
            organization_id=member.organization_id, author=request.user).first()

        # An approved testimonial is already public. Letting it be edited in
        # place would change published copy with nobody reviewing the new words.
        if existing and existing.status == Testimonial.Status.APPROVED:
            return Response(
                {"detail": "Your testimonial is already published. Contact us to change it."},
                status=status.HTTP_409_CONFLICT)

        serializer = TestimonialSubmitSerializer(instance=existing, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(organization_id=member.organization_id, author=request.user,
                        status=Testimonial.Status.PENDING)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class AdminTestimonialListView(generics.ListAPIView):
    serializer_class = TestimonialAdminSerializer
    permission_classes = [IsStaff]

    def get_queryset(self):
        qs = Testimonial.objects.select_related("organization", "author")
        state = self.request.query_params.get("status")
        return qs.filter(status=state) if state else qs


class AdminTestimonialDetailView(views.APIView):
    """Approve, reject, feature or re-order one testimonial."""
    permission_classes = [IsStaff]

    def patch(self, request, pk):
        try:
            t = Testimonial.objects.get(pk=pk)
        except Testimonial.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        action = (request.data.get("action") or "").lower()

        if action == "approve":
            # Belt and braces over the model's own guard: approving something
            # nobody gave permission to publish is the one mistake here that
            # cannot be undone by editing a file afterwards.
            if not t.consent:
                return Response(
                    {"detail": "This submission has no consent to publish and cannot be approved."},
                    status=400)
            t.approve(by=request.user, featured=bool(request.data.get("featured")))
            t.save()

        elif action == "reject":
            t.status = Testimonial.Status.REJECTED
            t.featured = False
            t.review_note = (request.data.get("review_note") or "")[:300]
            t.reviewed_by = request.user
            t.reviewed_at = timezone.now()
            t.save()

        elif action == "feature":
            if not t.publishable:
                return Response(
                    {"detail": "Only an approved, consented testimonial can be featured."},
                    status=400)
            t.featured = bool(request.data.get("featured", True))
            try:
                t.sort = int(request.data.get("sort", t.sort) or 0)
            except (TypeError, ValueError):
                pass
            t.save(update_fields=["featured", "sort"])

        else:
            return Response({"detail": "action must be approve, reject or feature."}, status=400)

        return Response(TestimonialAdminSerializer(t).data)
