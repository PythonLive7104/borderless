"""Setup progress, and the ways a checklist can lie to a new customer.

A checklist is only worth showing if it is right. The failures that matter are
not "it crashed" — they are the quiet ones that teach a trialling customer to
stop reading it:

  * ticking something they have not done (the list becomes noise),
  * failing to tick something they HAVE done (they redo work that was already
    finished, which is the complaint the install flow already had),
  * pointing at the wrong next step, or nagging about optional work forever,
  * leaking one workspace's progress into another's.

Each of those gets a test. The happy path gets one line.
"""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.links.models import ShortDomain, ShortLink
from apps.organizations.activation import activation_state
from apps.organizations.models import create_workspace
from apps.traffic.models import Session, TrafficEvent, Visitor
from apps.websites.models import Website


def _user(email):
    return get_user_model().objects.create_user(
        username=email, email=email, password="testpass123")


def _event(site, **kw):
    """A traffic event with the fields the checklist reads.

    Visitor and Session are both required by the schema, so they are created
    here rather than in each test — none of them is about the visitor model.
    """
    vid = kw.pop("visitor_id", "v1")
    visitor, _ = Visitor.objects.get_or_create(website=site, visitor_id=vid)
    session, _ = Session.objects.get_or_create(
        website=site, session_id=f"s-{vid}", defaults={"visitor": visitor})
    return TrafficEvent.objects.create(
        website=site, visitor=visitor, session=session,
        created_at=kw.pop("created_at", timezone.now()), **kw)


def _steps(state):
    return {s["key"]: s for s in state["steps"]}


class EmptyWorkspaceTest(TestCase):
    def setUp(self):
        self.org = create_workspace(_user("new@act.example"), "Acme")

    def test_a_brand_new_workspace_has_done_nothing(self):
        state = activation_state(self.org.id)
        self.assertEqual(state["completed"], 0)
        self.assertFalse(state["complete"])
        self.assertFalse(any(s["done"] for s in state["steps"]))

    def test_the_next_step_is_the_first_real_one(self):
        self.assertEqual(activation_state(self.org.id)["next"]["key"], "target")

    def test_the_optional_shield_is_never_the_next_step(self):
        """A finished setup must stop asking for things. The Shield is a real
        upgrade but the tracker alone is a complete install, so listing it as
        outstanding would leave every customer permanently at 'not done'."""
        site = Website.objects.create(organization=self.org, name="s", domain="a.example",
                                      snippet_seen_at=timezone.now(),
                                      last_event_at=timezone.now())
        _event(site, classification="bot", action="block")
        state = activation_state(self.org.id)
        self.assertTrue(state["complete"])
        self.assertIsNone(state["next"])
        self.assertFalse(_steps(state)["shield"]["done"])
        # ...and it does not drag the percentage down.
        self.assertEqual(state["percent"], 100)


class StepsReflectRealWorkTest(TestCase):
    def setUp(self):
        self.org = create_workspace(_user("steps@act.example"), "Acme")

    def test_adding_a_website_ticks_the_first_step_only(self):
        Website.objects.create(organization=self.org, name="s", domain="a.example")
        state = _steps(activation_state(self.org.id))
        self.assertTrue(state["target"]["done"])
        self.assertFalse(state["install"]["done"])
        self.assertFalse(state["traffic"]["done"])

    def test_a_redirect_only_customer_has_also_added_a_target(self):
        """They may never own a website. The checklist must not tell someone
        using short links that they have not started."""
        domain = ShortDomain.objects.create(host="t.example", active=True,
                                            verified_at=timezone.now())
        ShortLink.objects.create(organization=self.org, domain=domain, slug="go",
                                 destination_url="https://example.com")
        state = activation_state(self.org.id)
        self.assertTrue(_steps(state)["target"]["done"])
        self.assertTrue(state["has_link"])
        self.assertFalse(state["has_website"])

    def test_seeing_our_tag_counts_as_installed_without_any_traffic(self):
        """The whole point of the snippet probe: a correct install is proven by
        reading the page, so it must not sit un-ticked waiting for a visitor."""
        Website.objects.create(organization=self.org, name="s", domain="a.example",
                               snippet_seen_at=timezone.now())
        state = _steps(activation_state(self.org.id))
        self.assertTrue(state["install"]["done"])
        self.assertFalse(state["traffic"]["done"])

    def test_traffic_arriving_also_counts_as_installed(self):
        """The other proof. A workspace receiving events obviously installed it,
        even if we never managed to read their page."""
        Website.objects.create(organization=self.org, name="s", domain="a.example",
                               last_event_at=timezone.now())
        self.assertTrue(_steps(activation_state(self.org.id))["install"]["done"])

    def test_a_human_visitor_is_not_a_detection(self):
        """Ticking 'caught your first suspicious visitor' on clean traffic is
        the kind of lie that makes a customer distrust the numbers."""
        site = Website.objects.create(organization=self.org, name="s", domain="a.example")
        _event(site, classification="human", action="allow")
        state = _steps(activation_state(self.org.id))
        self.assertTrue(state["traffic"]["done"])
        self.assertFalse(state["detection"]["done"])
        self.assertFalse(state["protection"]["done"])

    def test_a_flagged_visitor_that_was_allowed_is_a_detection_not_protection(self):
        """Detection and protection are different promises. Monitoring without
        acting must not read as 'protection is on'."""
        site = Website.objects.create(organization=self.org, name="s", domain="a.example")
        _event(site, classification="bot", action="allow")
        state = _steps(activation_state(self.org.id))
        self.assertTrue(state["detection"]["done"])
        self.assertFalse(state["protection"]["done"])

    def test_blocking_something_turns_protection_on(self):
        site = Website.objects.create(organization=self.org, name="s", domain="a.example")
        _event(site, classification="fraud", action="block")
        self.assertTrue(_steps(activation_state(self.org.id))["protection"]["done"])

    def test_a_server_check_lights_up_the_shield(self):
        site = Website.objects.create(organization=self.org, name="s", domain="a.example")
        _event(site, type="server_check", classification="human", action="allow")
        self.assertTrue(_steps(activation_state(self.org.id))["shield"]["done"])

    def test_steps_carry_the_date_they_happened(self):
        """So the panel can say when, and so the same data can answer 'how long
        does it take a customer to get installed' later."""
        when = timezone.now() - timedelta(days=2)
        site = Website.objects.create(organization=self.org, name="s", domain="a.example")
        Website.objects.filter(pk=site.pk).update(snippet_seen_at=when)
        self.assertIsNotNone(_steps(activation_state(self.org.id))["install"]["at"])

    def test_the_internal_redirect_holder_is_not_a_website(self):
        """is_system sites are ours, not theirs — counting one would tick 'add
        your website' for a customer who has not added anything."""
        Website.objects.create(organization=self.org, name="sys", domain="sys.example",
                               is_system=True)
        self.assertFalse(_steps(activation_state(self.org.id))["target"]["done"])


class IsolationTest(TestCase):
    def test_one_workspace_cannot_see_another_s_progress(self):
        mine = create_workspace(_user("mine@act.example"), "Mine")
        theirs = create_workspace(_user("theirs@act.example"), "Theirs")
        site = Website.objects.create(organization=theirs, name="s", domain="b.example",
                                      snippet_seen_at=timezone.now())
        _event(site, classification="bot", action="block")

        state = activation_state(mine.id)
        self.assertEqual(state["completed"], 0)
        self.assertFalse(any(s["done"] for s in state["steps"]))


class ActivationApiTest(TestCase):
    def setUp(self):
        self.user = _user("api@act.example")
        self.org = create_workspace(self.user, "Acme")
        self.c = APIClient()
        self.c.force_authenticate(user=self.user)

    def test_a_member_can_read_their_own_progress(self):
        r = self.c.get(f"/api/organizations/{self.org.id}/activation/")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body["completed"], 0)
        self.assertEqual(body["next"]["key"], "target")
        self.assertEqual(len(body["steps"]), 6)

    def test_a_stranger_cannot(self):
        outsider = _user("outsider@act.example")
        other = create_workspace(outsider, "Other")
        r = self.c.get(f"/api/organizations/{other.id}/activation/")
        self.assertIn(r.status_code, (403, 404))

    def test_anonymous_cannot(self):
        r = APIClient().get(f"/api/organizations/{self.org.id}/activation/")
        self.assertIn(r.status_code, (401, 403))
