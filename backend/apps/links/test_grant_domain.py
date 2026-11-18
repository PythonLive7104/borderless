"""Allocating a private domain to a workspace directly (no purchase).

The thing that must be true afterwards: a granted domain is a *normal* private
domain — owned, not shared, with a paid-through date — so every downstream check
treats it exactly like a bought one. The tests assert that, plus the two ways a
direct grant can go wrong: handing over a domain that can't serve, and leaving a
previous owner's links resolving on a domain that's now someone else's.
"""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from apps.links import rentals
from apps.links.models import ShortDomain, ShortLink
from apps.organizations.models import create_workspace


def _org(email, name="Acme"):
    user = get_user_model().objects.create_user(
        username=email, email=email, password="testpass123")
    return create_workspace(user, name)


def _stock(host="stock.cc"):
    return ShortDomain.objects.create(host=host, active=True, is_shared=False,
                                      verified_at=timezone.now())


class GrantServiceTest(TestCase):
    def setUp(self):
        self.org = _org("owner@grant.example")

    def test_granting_makes_it_a_normal_private_domain(self):
        d = _stock()
        from unittest.mock import patch
        with patch("apps.links.sync.publish_link"):
            rentals.grant_to_org(d, self.org, notify=False)
        d.refresh_from_db()
        self.assertEqual(d.organization_id, self.org.id)
        self.assertFalse(d.is_shared)
        self.assertIsNotNone(d.private_until)
        # Treated as the workspace's own by every downstream helper.
        self.assertIn(d, ShortDomain.for_org(self.org.id))
        self.assertIn(d, ShortDomain.private_for(self.org.id))
        self.assertEqual(rentals.rental_state(d), rentals.PAID)

    def test_the_term_is_honoured(self):
        d = _stock()
        from unittest.mock import patch
        with patch("apps.links.sync.publish_link"):
            rentals.grant_to_org(d, self.org, days=10, notify=False)
        d.refresh_from_db()
        delta = (d.private_until - timezone.now()).days
        self.assertIn(delta, (9, 10))

    def test_reassigning_withdraws_the_previous_owners_links(self):
        """A domain handed to a new owner must stop serving the old owner's
        redirects — the entitlement check in publish_link is what enforces it."""
        old = _org("old@grant.example", "Old")
        d = _stock("reassign.cc")
        from unittest.mock import patch
        with patch("apps.links.sync.publish_link"):
            rentals.grant_to_org(d, old, notify=False)
        link = ShortLink.objects.create(organization=old, domain=d, slug="x",
                                        destination_url="https://e.example")

        new = _org("new@grant.example", "New")
        with patch("apps.links.sync.publish_link") as pub:
            rentals.grant_to_org(d, new, notify=False)
        # The old owner's link was re-published (which withdraws it, since the
        # domain now belongs to someone else).
        republished = [c.args[0].pk for c in pub.call_args_list]
        self.assertIn(link.pk, republished)
        d.refresh_from_db()
        self.assertEqual(d.organization_id, new.id)

    def test_the_new_owner_is_notified(self):
        from django.core import mail
        d = _stock()
        from unittest.mock import patch
        with patch("apps.links.sync.publish_link"):
            rentals.grant_to_org(d, self.org, notify=True)
        self.assertTrue(any("private domain" in m.subject.lower() or "yours" in m.subject.lower()
                            for m in mail.outbox), [m.subject for m in mail.outbox])


class GrantCommandTest(TestCase):
    def setUp(self):
        self.org = _org("cmd@grant.example", "Acme")

    def _run(self, *args, **kw):
        from io import StringIO
        out = StringIO()
        call_command("grant_private_domain", *args, stdout=out, stderr=StringIO(), **kw)
        return out.getvalue()

    def test_grant_by_slug(self):
        _stock("byslug.cc")
        out = self._run("byslug.cc", self.org.slug)
        self.assertIn("Allocated", out)
        self.assertEqual(ShortDomain.objects.get(host="byslug.cc").organization_id, self.org.id)

    def test_grant_by_id(self):
        _stock("byid.cc")
        self._run("byid.cc", str(self.org.id))
        self.assertEqual(ShortDomain.objects.get(host="byid.cc").organization_id, self.org.id)

    def test_unknown_domain_errors(self):
        from django.core.management.base import CommandError
        with self.assertRaises(CommandError):
            self._run("nope.cc", self.org.slug)

    def test_unknown_org_errors(self):
        from django.core.management.base import CommandError
        _stock("x.cc")
        with self.assertRaises(CommandError):
            self._run("x.cc", "no-such-workspace")

    def test_a_flagged_domain_is_refused_without_force(self):
        from django.core.management.base import CommandError
        d = _stock("flagged.cc")
        ShortDomain.objects.filter(pk=d.pk).update(health=ShortDomain.Health.FLAGGED)
        with self.assertRaises(CommandError):
            self._run("flagged.cc", self.org.slug)
        # unchanged
        self.assertIsNone(ShortDomain.objects.get(host="flagged.cc").organization_id)

    def test_force_allocates_a_flagged_domain(self):
        d = _stock("forced.cc")
        ShortDomain.objects.filter(pk=d.pk).update(health=ShortDomain.Health.FLAGGED)
        self._run("forced.cc", self.org.slug, "--force")
        self.assertEqual(ShortDomain.objects.get(host="forced.cc").organization_id, self.org.id)


class GrantAdminActionTest(TestCase):
    def setUp(self):
        from django.contrib.admin.sites import AdminSite
        from apps.links.admin import ShortDomainAdmin
        self.admin = ShortDomainAdmin(ShortDomain, AdminSite())
        self.org = _org("adm@grant.example", "Acme")
        self.staff = get_user_model().objects.create_user(
            username="staff@grant.example", email="staff@grant.example",
            password="x", is_staff=True, is_superuser=True)

    def _req(self, data=None):
        from django.test import RequestFactory
        r = RequestFactory().post("/admin/links/shortdomain/", data or {})
        r.user = self.staff
        r._messages = _Msgs()
        return r

    def test_first_step_renders_the_picker(self):
        d = _stock("pick.cc")
        resp = self.admin.assign_to_workspace(
            self._req({"_selected_action": [str(d.pk)]}),
            ShortDomain.objects.filter(pk=d.pk))
        self.assertEqual(resp.status_code, 200)   # TemplateResponse, not yet applied
        self.assertIsNone(ShortDomain.objects.get(pk=d.pk).organization_id)

    def test_apply_allocates(self):
        d = _stock("apply.cc")
        req = self._req({"_selected_action": [str(d.pk)], "apply": "1",
                         "organization": str(self.org.id), "notify": "", "days": ""})
        self.admin.assign_to_workspace(req, ShortDomain.objects.filter(pk=d.pk))
        self.assertEqual(ShortDomain.objects.get(pk=d.pk).organization_id, self.org.id)

    def test_apply_without_a_workspace_changes_nothing(self):
        d = _stock("nowork.cc")
        req = self._req({"_selected_action": [str(d.pk)], "apply": "1", "organization": ""})
        self.admin.assign_to_workspace(req, ShortDomain.objects.filter(pk=d.pk))
        self.assertIsNone(ShortDomain.objects.get(pk=d.pk).organization_id)


class _Msgs:
    def __init__(self): self.sent = []
    def add(self, level, message, extra_tags=""): self.sent.append(str(message))
