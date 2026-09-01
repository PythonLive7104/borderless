from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from apps.billing.models import Subscription


class AccessGatingTest(TestCase):
    def setUp(self):
        self.c = APIClient()
        self.c.post("/api/auth/register/", {"email": "g@example.com", "password": "testpass123", "first_name": "G"}, format="json")
        access = self.c.post("/api/auth/token/", {"email": "g@example.com", "password": "testpass123"}, format="json").json()["access"]
        self.c.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        orgs = self.c.get("/api/organizations/").json()
        self.org = orgs[0]["id"] if isinstance(orgs, list) else orgs["results"][0]["id"]

    def test_trial_then_expired_then_paid(self):
        sub = Subscription.objects.get(organization_id=self.org)
        self.assertFalse(sub.access_state()["locked"])  # trialing
        sub.trial_end = timezone.now() - timedelta(days=1)
        sub.save()
        self.assertTrue(sub.access_state()["locked"])   # expired
        self.assertEqual(sub.access_state()["reason"], "trial_expired")
        # upgrade (dev checkout activates instantly)
        r = self.c.post("/api/billing/checkout/", {"organization": self.org, "plan": "growth"}, format="json")
        self.assertEqual(r.status_code, 200)
        sub.refresh_from_db()
        self.assertFalse(sub.access_state()["locked"])  # active
        self.assertEqual(sub.status, "active")
