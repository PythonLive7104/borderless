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


class DeeperSignalFieldsTest(TestCase):
    """The new targeting fields (ISP, ASN, connection type, versions, language)
    must validate as rule conditions and reach the engine payload."""

    def setUp(self):
        self.c = APIClient()
        self.org = _auth(self.c, "deep@example.com")

    def test_connection_type_rule_is_accepted(self):
        r = self.c.post("/api/rules/", {
            "organization": self.org, "name": "Only residential", "priority": 5, "action": "block",
            "conditions": [{"field": "connection_type", "operator": "eq", "value": "Data Center"}],
        }, format="json")
        self.assertEqual(r.status_code, 201, r.content)

    def test_all_new_fields_validate(self):
        for field, op, val in [
            ("isp", "contains", "amazon"), ("asn", "eq", "16509"),
            ("is_mobile", "eq", "1"), ("browser_version", "eq", "120"),
            ("os_version", "eq", "10"), ("language", "contains", "ru"),
            ("ja4", "eq", "t13d1516h2_8daaf6152771_b186095e22b6"),
        ]:
            r = self.c.post("/api/rules/", {
                "organization": self.org, "name": f"r-{field}", "priority": 10, "action": "review",
                "conditions": [{"field": field, "operator": op, "value": val}],
            }, format="json")
            self.assertEqual(r.status_code, 201, f"{field}: {r.content}")

    def test_field_reaches_the_engine_payload(self):
        import json
        from apps.rules.sync import build_payload
        self.c.post("/api/rules/", {
            "organization": self.org, "name": "Block DC", "priority": 1, "action": "block",
            "conditions": [{"field": "connection_type", "operator": "eq", "value": "Data Center"}],
        }, format="json")
        payload = json.loads(build_payload(self.org))
        fields = [c["field"] for rule in payload for c in rule["conditions"]]
        self.assertIn("connection_type", fields)

    def test_an_unknown_field_is_still_rejected(self):
        r = self.c.post("/api/rules/", {
            "organization": self.org, "name": "bad", "priority": 1, "action": "block",
            "conditions": [{"field": "not_a_field", "operator": "eq", "value": "x"}],
        }, format="json")
        self.assertEqual(r.status_code, 400)


class RuleActionValidationTest(TestCase):
    """A rule that cannot carry out its action must be refused at save time.

    These used to save happily and then do nothing, which is worse than an
    error: the dashboard shows them enabled and the traffic sails through.
    """

    def setUp(self):
        self.c = APIClient()
        self.c.post("/api/auth/register/", {
            "email": "rv@example.com", "password": "testpass123", "first_name": "R"}, format="json")
        tok = self.c.post("/api/auth/token/", {
            "email": "rv@example.com", "password": "testpass123"}, format="json").json()["access"]
        self.c.credentials(HTTP_AUTHORIZATION=f"Bearer {tok}")
        orgs = self.c.get("/api/organizations/").json()
        self.org = orgs[0]["id"] if isinstance(orgs, list) else orgs["results"][0]["id"]

    def _post(self, **over):
        body = {
            "organization": self.org, "name": "r", "priority": 100,
            "action": "redirect", "redirect_url": "https://example.com/blocked",
            "conditions": [{"field": "is_proxy", "operator": "eq", "value": "1"}],
        }
        body.update(over)
        return self.c.post("/api/rules/", body, format="json")

    def test_redirect_without_a_destination_is_refused(self):
        r = self._post(redirect_url="")
        self.assertEqual(r.status_code, 400)
        self.assertIn("redirect_url", r.json())

    def test_redirect_with_only_whitespace_is_refused(self):
        self.assertEqual(self._post(redirect_url="   ").status_code, 400)

    def test_redirect_with_a_destination_is_accepted(self):
        self.assertEqual(self._post().status_code, 201)

    def test_tag_without_a_label_is_refused(self):
        r = self._post(action="tag", redirect_url="", tag="")
        self.assertEqual(r.status_code, 400)
        self.assertIn("tag", r.json())

    def test_other_actions_need_neither(self):
        """Block and review act on their own; they must not be caught by the
        guards above."""
        for action in ("block", "review", "allow"):
            with self.subTest(action=action):
                self.assertEqual(
                    self._post(action=action, redirect_url="", tag="").status_code, 201)


class DefaultRuleTest(TestCase):
    """A new website must start protected, not permissive."""

    def setUp(self):
        self.c = APIClient()
        self.c.post("/api/auth/register/", {
            "email": "dr@example.com", "password": "testpass123", "first_name": "D"}, format="json")
        tok = self.c.post("/api/auth/token/", {
            "email": "dr@example.com", "password": "testpass123"}, format="json").json()["access"]
        self.c.credentials(HTTP_AUTHORIZATION=f"Bearer {tok}")
        orgs = self.c.get("/api/organizations/").json()
        self.org = orgs[0]["id"] if isinstance(orgs, list) else orgs["results"][0]["id"]

    def _add_site(self, domain="example.com"):
        r = self.c.post("/api/websites/", {
            "organization": self.org, "name": domain, "domain": domain}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        return r.json()["id"]

    def test_a_new_website_gets_a_rule(self):
        from apps.rules.models import TrafficRule
        site = self._add_site()
        rules = TrafficRule.objects.filter(website_id=site)
        self.assertEqual(rules.count(), 1)
        self.assertTrue(rules.first().active)

    def test_it_catches_bots_and_fraud(self):
        from apps.rules.models import TrafficRule
        rule = TrafficRule.objects.get(website_id=self._add_site())
        cond = rule.conditions.get()
        self.assertEqual(cond.field, "classification")
        self.assertEqual(cond.operator, "in")
        self.assertEqual(set(cond.value.split(",")), {"bot", "fraud"})

    def test_it_redirects_somewhere_that_exists(self):
        """A redirect rule with no destination silently does nothing — the
        default must not ship in that state."""
        from apps.rules.models import TrafficRule
        rule = TrafficRule.objects.get(website_id=self._add_site())
        self.assertEqual(rule.action, "redirect")
        self.assertTrue(rule.redirect_url.strip())
        self.assertTrue(rule.redirect_url.endswith("/blocked.html"))

    def test_it_runs_after_the_customers_own_rules(self):
        """First match wins, so the default must sort last — a deliberate
        `allow` written by the customer has to beat it."""
        from apps.rules.defaults import DEFAULT_RULE_PRIORITY
        from apps.rules.models import TrafficRule
        rule = TrafficRule.objects.get(website_id=self._add_site())
        self.assertEqual(rule.priority, DEFAULT_RULE_PRIORITY)
        self.assertGreater(rule.priority, 100)  # the UI's default for new rules

    def test_it_is_an_ordinary_rule_the_customer_can_remove(self):
        from apps.rules.models import TrafficRule
        rule = TrafficRule.objects.get(website_id=self._add_site())
        r = self.c.delete(f"/api/rules/{rule.id}/")
        self.assertIn(r.status_code, (200, 204))
        self.assertFalse(TrafficRule.objects.filter(id=rule.id).exists())

    def test_it_is_not_duplicated(self):
        from apps.rules.defaults import create_default_rule
        from apps.rules.models import TrafficRule
        from apps.websites.models import Website
        site = Website.objects.get(id=self._add_site())
        self.assertIsNone(create_default_rule(site))
        self.assertEqual(TrafficRule.objects.filter(website=site).count(), 1)

    def test_each_website_gets_its_own(self):
        """At the model level: the API path can't add a second site on the free
        trial, but the rule is per-website and must not be shared."""
        from apps.organizations.models import Organization
        from apps.rules.defaults import create_default_rule
        from apps.rules.models import TrafficRule
        from apps.websites.models import Website

        org = Organization.objects.get(id=self.org)
        a = Website.objects.create(organization=org, name="a", domain="a.com")
        b = Website.objects.create(organization=org, name="b", domain="b.com")
        create_default_rule(a)
        create_default_rule(b)

        self.assertEqual(TrafficRule.objects.filter(website=a).count(), 1)
        self.assertEqual(TrafficRule.objects.filter(website=b).count(), 1)
        self.assertNotEqual(
            TrafficRule.objects.get(website=a).id,
            TrafficRule.objects.get(website=b).id)


class BotCoverageBackfillTest(TestCase):
    """A site can have rules and still be wide open to bots.

    This is the case that frustrated a real customer: rules for VPN and OS, and
    a visitor scored 80 and classified a bot walked straight through, because
    no rule acted on the classification.
    """

    def setUp(self):
        from apps.organizations.models import Organization, create_workspace
        User = get_user_model()
        self.user = User.objects.create_user(
            username="bc@example.com", email="bc@example.com", password="testpass123")
        create_workspace(self.user, "W")
        self.org = Organization.objects.filter(members__user=self.user).first()
        from apps.websites.models import Website
        self.site = Website.objects.create(organization=self.org, name="s", domain="s.com")

    def _vpn_rule(self):
        from apps.rules.models import RuleCondition, TrafficRule
        r = TrafficRule.objects.create(
            organization=self.org, website=self.site, name="vpn", priority=100,
            action="redirect", redirect_url="https://example.com/x", active=True)
        RuleCondition.objects.create(rule=r, field="is_proxy", operator="eq", value="1")
        return r

    def test_force_adds_the_bot_rule_to_a_site_that_already_has_rules(self):
        from apps.rules.defaults import create_default_rule
        from apps.rules.models import TrafficRule
        self._vpn_rule()

        # Without force it declines — the site has rules.
        self.assertIsNone(create_default_rule(self.site))
        # With force it adds the missing bot coverage alongside them.
        self.assertIsNotNone(create_default_rule(self.site, force=True))
        self.assertEqual(TrafficRule.objects.filter(website=self.site).count(), 2)

    def test_force_is_still_idempotent(self):
        """Running the backfill twice must not leave two copies."""
        from apps.rules.defaults import create_default_rule
        from apps.rules.models import TrafficRule
        self._vpn_rule()
        create_default_rule(self.site, force=True)
        self.assertIsNone(create_default_rule(self.site, force=True))
        self.assertEqual(TrafficRule.objects.filter(website=self.site).count(), 2)

    def test_the_bot_rule_sorts_after_the_customers_vpn_rule(self):
        from apps.rules.defaults import create_default_rule
        from apps.rules.models import TrafficRule
        vpn = self._vpn_rule()
        bot = create_default_rule(self.site, force=True)
        ordered = list(TrafficRule.objects.filter(website=self.site).order_by("priority", "id"))
        self.assertEqual(ordered, [vpn, bot])
