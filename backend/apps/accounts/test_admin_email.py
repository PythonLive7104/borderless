"""The 'Send an email' action on the Users admin.

The property that matters for anything that sends mail to customers: it does NOT
send until the explicit Send step. Compose and Preview must change nothing.
"""
from django.contrib.admin.sites import AdminSite
from django.contrib.auth import get_user_model
from django.contrib.messages.storage.fallback import FallbackStorage
from django.core import mail
from django.test import RequestFactory, TestCase

from apps.accounts.admin import BorderlessUserAdmin

User = get_user_model()


def _req(data):
    r = RequestFactory().post("/admin/accounts/user/", data)
    r.user = User.objects.get(username="staff@e.com")
    r.session = {}
    r._messages = FallbackStorage(r)
    return r


class AdminSendEmailActionTest(TestCase):
    def setUp(self):
        User.objects.create_user(username="staff@e.com", email="staff@e.com",
                                 password="x", is_staff=True, is_superuser=True)
        self.u1 = User.objects.create_user(username="a@e.com", email="a@e.com", password="x")
        self.u2 = User.objects.create_user(username="b@e.com", email="b@e.com", password="x")
        self.admin = BorderlessUserAdmin(User, AdminSite())

    def _ids(self):
        return [str(self.u1.pk), str(self.u2.pk)]

    def test_compose_step_renders_a_form_and_sends_nothing(self):
        resp = self.admin.send_email(
            _req({"_selected_action": self._ids()}),
            User.objects.filter(pk__in=[self.u1.pk, self.u2.pk]))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(mail.outbox), 0)

    def test_preview_renders_but_sends_nothing(self):
        resp = self.admin.send_email(
            _req({"_selected_action": self._ids(), "preview": "1",
                  "subject": "Big offer", "body_html": "<p>Hi</p>"}),
            User.objects.filter(pk__in=[self.u1.pk, self.u2.pk]))
        html = resp.render().content.decode()
        self.assertIn("Inbox preview", html)
        self.assertEqual(len(mail.outbox), 0)

    def test_send_delivers_to_selected_users(self):
        self.admin.send_email(
            _req({"_selected_action": self._ids(), "send": "1",
                  "subject": "Big offer", "body_html": "<p>Save now <a href='https://trynobot.com/x'>here</a></p>"}),
            User.objects.filter(pk__in=[self.u1.pk, self.u2.pk]))
        self.assertEqual(len(mail.outbox), 2)
        to = sorted(m.to[0] for m in mail.outbox)
        self.assertEqual(to, ["a@e.com", "b@e.com"])
        # The body HTML is carried as the html alternative.
        alts = mail.outbox[0].alternatives
        self.assertTrue(any("trynobot.com/x" in a[0] for a in alts))

    def test_send_requires_subject_and_body(self):
        self.admin.send_email(
            _req({"_selected_action": self._ids(), "send": "1",
                  "subject": "", "body_html": "<p>Hi</p>"}),
            User.objects.filter(pk__in=[self.u1.pk, self.u2.pk]))
        self.assertEqual(len(mail.outbox), 0)

    def test_users_without_an_email_are_skipped(self):
        noemail = User.objects.create_user(username="noemail", email="", password="x")
        self.admin.send_email(
            _req({"_selected_action": [str(noemail.pk), str(self.u1.pk)], "send": "1",
                  "subject": "Hi", "body_html": "<p>Hi</p>"}),
            User.objects.filter(pk__in=[noemail.pk, self.u1.pk]))
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["a@e.com"])
