from django.contrib.auth import get_user_model
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


class RedirectRulesTest(TestCase):
    """Rules attached to a single redirect, for customers with no website."""

    def setUp(self):
        from django.utils import timezone
        from apps.links.models import ShortDomain, ShortLink
        from apps.organizations.models import create_workspace
        user = get_user_model().objects.create_user(
            username="rr@example.com", email="rr@example.com", password="testpass123")
        self.org = create_workspace(user, "RR Co")
        d, _ = ShortDomain.objects.get_or_create(
            host="trynb.cc", defaults={"active": True, "is_default": True,
                                       "verified_at": timezone.now()})
        self.link = ShortLink.objects.create(organization=self.org, domain=d, slug="rr",
                                             destination_url="https://e.example")
        self.c = APIClient()
        self.c.force_authenticate(user=user)

    def _rule(self, **kw):
        payload = {"organization": self.org.id, "short_link": self.link.id, "name": "Block NG",
                   "priority": 100, "action": "block",
                   "conditions": [{"field": "country", "operator": "eq", "value": "NG"}]}
        payload.update(kw)
        return self.c.post("/api/rules/", payload, format="json")

    def test_a_rule_can_be_attached_to_a_redirect(self):
        self.assertEqual(self._rule().status_code, 201)

    def test_it_travels_inside_the_link_payload(self):
        import json
        from apps.links.sync import _payload
        self._rule()
        self.link.refresh_from_db()
        rules = json.loads(json.loads(_payload(self.link))["rules"])
        self.assertEqual(rules[0]["action"], "block")
        self.assertEqual(rules[0]["conditions"][0]["value"], "NG")

    def test_a_link_with_no_rules_carries_none(self):
        import json
        from apps.links.sync import _payload
        self.assertEqual(json.loads(_payload(self.link))["rules"], "")

    def test_redirect_rules_do_not_leak_into_website_rules(self):
        # The Traffic Rules page lists website rules; a redirect's rules are
        # managed from the redirect and would be confusing mixed in.
        self._rule()
        listed = self.c.get(f"/api/rules/?organization={self.org.id}").json()["results"]
        self.assertEqual(listed, [])
        scoped = self.c.get(
            f"/api/rules/?organization={self.org.id}&short_link={self.link.id}").json()["results"]
        self.assertEqual(len(scoped), 1)

    def test_a_website_rule_is_not_applied_to_a_redirect(self):
        import json
        from apps.links.sync import _payload
        self.c.post("/api/rules/", {"organization": self.org.id, "name": "Site rule",
                                    "priority": 10, "action": "block",
                                    "conditions": [{"field": "country", "operator": "eq", "value": "RU"}]},
                    format="json")
        self.assertEqual(json.loads(_payload(self.link))["rules"], "")

    def test_a_rule_cannot_be_attached_to_another_workspaces_redirect(self):
        from apps.organizations.models import create_workspace
        other = get_user_model().objects.create_user(
            username="rr2@example.com", email="rr2@example.com", password="testpass123")
        other_org = create_workspace(other, "Other")
        c = APIClient(); c.force_authenticate(user=other)
        r = c.post("/api/rules/", {"organization": other_org.id, "short_link": self.link.id,
                                   "name": "x", "priority": 1, "action": "block",
                                   "conditions": [{"field": "country", "operator": "eq", "value": "NG"}]},
                   format="json")
        self.assertEqual(r.status_code, 400)
