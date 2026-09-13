from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.organizations.models import (
    Organization, OrganizationMember, Role, create_workspace, ensure_membership,
)
from apps.websites.models import Website


class OwnerMembershipDriftTest(TestCase):
    """An owner whose membership row went missing must not be locked out of
    their own workspace with 'You are not a member of this workspace.'"""

    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="own@example.com", email="own@example.com", password="testpass123")
        self.org = create_workspace(self.user, "Acme")
        # Simulate the drift: owner row missing (interrupted two-step create,
        # or old data from before create_workspace was atomic).
        OrganizationMember.objects.filter(organization=self.org, user=self.user).delete()

    def test_ensure_membership_heals_the_owner(self):
        self.assertFalse(OrganizationMember.objects.filter(
            organization=self.org, user=self.user).exists())
        m = ensure_membership(self.user, self.org)
        self.assertIsNotNone(m)
        self.assertEqual(m.role, Role.OWNER)

    def test_ensure_membership_rejects_a_real_stranger(self):
        stranger = get_user_model().objects.create_user(
            username="s@example.com", email="s@example.com", password="testpass123")
        self.assertIsNone(ensure_membership(stranger, self.org))

    def test_owner_can_create_a_redirect_despite_the_drift(self):
        c = APIClient(); c.force_authenticate(user=self.user)
        # A domain the workspace can use.
        from apps.links.models import ShortDomain
        from django.utils import timezone
        dom = ShortDomain.objects.create(host="ex.cc", organization=self.org,
                                         is_shared=False, active=True,
                                         verified_at=timezone.now())
        r = c.post("/api/links/", {
            "organization": self.org.id, "destination_url": "https://dest.example", "slug": "healtest",
            "domain": dom.id, "bot_action": "decoy",
        }, format="json")
        # The membership false-negative is what we're fixing: the org check must
        # pass now. (A separate paywall may still apply on a trial-less org.)
        self.assertNotIn(b"not a member", r.content)
        self.assertNotEqual(r.status_code, 400, r.content)

    def test_repair_command_backfills(self):
        from django.core.management import call_command
        call_command("repair_memberships", verbosity=0)
        self.assertTrue(OrganizationMember.objects.filter(
            organization=self.org, user=self.user, role=Role.OWNER).exists())

    def test_switcher_lists_a_drifted_owned_workspace(self):
        c = APIClient(); c.force_authenticate(user=self.user)
        rows = c.get("/api/organizations/").json()
        rows = rows if isinstance(rows, list) else rows["results"]
        self.assertIn(self.org.id, [o["id"] for o in rows])
