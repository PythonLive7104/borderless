from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

User = get_user_model()


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


class AttributionTest(TestCase):
    """Signup attribution: the register endpoint is unauthenticated, so what it
    stores has to be whitelisted and bounded, not trusted."""

    def setUp(self):
        self.c = APIClient()

    def _register(self, email, attribution=None):
        body = {"email": email, "password": "testpass123", "first_name": "A"}
        if attribution is not None:
            body["attribution"] = attribution
        return self.c.post("/api/auth/register/", body, format="json")

    def test_register_without_attribution_still_works(self):
        """Blocked localStorage, an ad blocker, or a direct API call: all must
        register normally rather than 400."""
        self.assertEqual(self._register("none@example.com").status_code, 201)
        self.assertEqual(User.objects.get(email="none@example.com").attribution, {})

    def test_known_keys_are_stored(self):
        r = self._register("paid@example.com", {
            "gclid": "abc123", "utm_source": "google", "utm_medium": "cpc",
            "utm_campaign": "brand", "landing_path": "/compare/clickcease",
        })
        self.assertEqual(r.status_code, 201)
        u = User.objects.get(email="paid@example.com")
        self.assertEqual(u.attribution["gclid"], "abc123")
        self.assertEqual(u.attribution["utm_campaign"], "brand")
        self.assertEqual(u.attribution["landing_path"], "/compare/clickcease")

    def test_unknown_keys_are_dropped(self):
        """Anyone can POST here, so an arbitrary key must not reach the column."""
        r = self._register("junk@example.com", {
            "gclid": "keep", "is_staff": True, "password": "nope", "whatever": "x" * 50,
        })
        self.assertEqual(r.status_code, 201)
        attr = User.objects.get(email="junk@example.com").attribution
        self.assertEqual(set(attr), {"gclid"})

    def test_values_are_bounded(self):
        r = self._register("long@example.com", {"utm_campaign": "z" * 5000})
        self.assertEqual(r.status_code, 201)
        self.assertEqual(len(User.objects.get(email="long@example.com").attribution["utm_campaign"]), 200)

    def test_nested_and_non_string_values_are_rejected(self):
        r = self._register("nested@example.com", {
            "utm_source": {"evil": "payload"}, "utm_medium": ["a", "b"], "utm_campaign": 42,
        })
        self.assertEqual(r.status_code, 201)
        attr = User.objects.get(email="nested@example.com").attribution
        # dicts and lists dropped; a bare number is still a usable campaign id
        self.assertEqual(attr, {"utm_campaign": "42"})

    def test_non_dict_attribution_is_ignored(self):
        self.assertEqual(self._register("str@example.com", "google/cpc").status_code, 201)
        self.assertEqual(User.objects.get(email="str@example.com").attribution, {})

    def test_attribution_is_not_echoed_back(self):
        """write_only: the response is rendered to the browser that just sent
        it, and it has no business reading acquisition data back out."""
        r = self._register("echo@example.com", {"gclid": "secret"})
        self.assertNotIn("attribution", r.json())

    def test_acquisition_source_labels(self):
        cases = [
            ({}, "—"),
            ({"gclid": "x"}, "google / cpc"),
            ({"msclkid": "x"}, "microsoft / cpc"),
            ({"gclid": "x", "utm_source": "google", "utm_medium": "cpc",
              "utm_campaign": "brand"}, "google / cpc / brand"),
            ({"utm_source": "reddit"}, "reddit"),
            ({"referrer": "news.ycombinator.com"}, "referral / news.ycombinator.com"),
            ({"landing_path": "/"}, "direct"),
        ]
        for attribution, expected in cases:
            with self.subTest(attribution=attribution):
                self.assertEqual(User(attribution=attribution).acquisition_source, expected)

    def test_is_paid_acquisition(self):
        self.assertTrue(User(attribution={"gclid": "x"}).is_paid_acquisition)
        self.assertTrue(User(attribution={"msclkid": "x"}).is_paid_acquisition)
        self.assertTrue(User(attribution={"utm_medium": "cpc"}).is_paid_acquisition)
        self.assertFalse(User(attribution={"utm_medium": "organic"}).is_paid_acquisition)
        self.assertFalse(User(attribution={}).is_paid_acquisition)
