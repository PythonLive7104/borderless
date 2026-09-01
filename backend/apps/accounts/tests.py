from django.test import TestCase
from rest_framework.test import APIClient


class AuthSmokeTest(TestCase):
    def setUp(self):
        self.c = APIClient()

    def test_register_creates_user_workspace_and_trial_subscription(self):
        r = self.c.post("/api/auth/register/", {
            "email": "a@example.com", "password": "testpass123", "first_name": "A",
        }, format="json")
        self.assertEqual(r.status_code, 201)
        # login
        tok = self.c.post("/api/auth/token/", {"email": "a@example.com", "password": "testpass123"}, format="json")
        self.assertEqual(tok.status_code, 200)
        access = tok.json()["access"]
        self.c.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        # me
        me = self.c.get("/api/auth/me/")
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()["email"], "a@example.com")
        # a workspace with a trialing subscription was auto-created
        orgs = self.c.get("/api/organizations/").json()
        org_id = orgs[0]["id"] if isinstance(orgs, list) else orgs["results"][0]["id"]
        sub = self.c.get(f"/api/billing/subscription/?organization={org_id}").json()
        self.assertEqual(sub["status"], "trialing")
        self.assertFalse(sub["access"]["locked"])

    def test_login_rejects_bad_password(self):
        self.c.post("/api/auth/register/", {"email": "b@example.com", "password": "testpass123", "first_name": "B"}, format="json")
        r = self.c.post("/api/auth/token/", {"email": "b@example.com", "password": "wrong"}, format="json")
        self.assertEqual(r.status_code, 401)
