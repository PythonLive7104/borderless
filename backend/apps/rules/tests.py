from django.test import TestCase
from rest_framework.test import APIClient


def _auth(c, email):
    c.post("/api/auth/register/", {"email": email, "password": "testpass123", "first_name": "T"}, format="json")
    access = c.post("/api/auth/token/", {"email": email, "password": "testpass123"}, format="json").json()["access"]
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    orgs = c.get("/api/organizations/").json()
    return orgs[0]["id"] if isinstance(orgs, list) else orgs["results"][0]["id"]


class RulesSmokeTest(TestCase):
    def setUp(self):
        self.c = APIClient()
        self.org = _auth(self.c, "r@example.com")

    def test_ip_filter_validation_and_create(self):
        ok = self.c.post("/api/rules/ip-filters/", {"organization": self.org, "value": "10.0.0.0/8", "kind": "deny"}, format="json")
        self.assertEqual(ok.status_code, 201)
        bad = self.c.post("/api/rules/ip-filters/", {"organization": self.org, "value": "not-an-ip", "kind": "deny"}, format="json")
        self.assertEqual(bad.status_code, 400)

    def test_rule_create_with_condition(self):
        r = self.c.post("/api/rules/", {
            "organization": self.org, "name": "Block RU", "priority": 10, "action": "block",
            "conditions": [{"field": "country", "operator": "eq", "value": "RU"}],
        }, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()["action"], "block")
