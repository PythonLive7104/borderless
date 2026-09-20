from unittest.mock import patch

from django.core import mail
from django.test import TestCase

from .models import ContactMessage


class ContactFormTest(TestCase):
    """The page promises a reply within one business day, so the message has to
    survive even when the notification email doesn't."""

    PAYLOAD = {"name": "Jane Marketer", "email": "jane@acme.co",
               "company": "Acme Media", "message": "How does pricing work?"}

    def test_saves_and_notifies(self):
        res = self.client.post("/api/v1/contact/", self.PAYLOAD, content_type="application/json")
        self.assertEqual(res.status_code, 200)
        msg = ContactMessage.objects.get()
        self.assertEqual(msg.email, "jane@acme.co")
        self.assertEqual(len(mail.outbox), 1)
        # Replying in the inbox must answer the prospect, not ourselves.
        self.assertEqual(mail.outbox[0].reply_to, ["jane@acme.co"])

    def test_message_survives_a_mail_failure(self):
        with patch("django.core.mail.EmailMessage.send", side_effect=RuntimeError("smtp down")):
            res = self.client.post("/api/v1/contact/", self.PAYLOAD, content_type="application/json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(ContactMessage.objects.count(), 1)

    def test_rejects_incomplete_or_invalid(self):
        for bad in [{**self.PAYLOAD, "email": "not-an-email"},
                    {**self.PAYLOAD, "message": ""},
                    {**self.PAYLOAD, "name": ""}]:
            res = self.client.post("/api/v1/contact/", bad, content_type="application/json")
            self.assertEqual(res.status_code, 400, bad)
        self.assertEqual(ContactMessage.objects.count(), 0)


class StatusEndpointTest(TestCase):
    def test_reports_each_component(self):
        res = self.client.get("/api/v1/status/")
        self.assertEqual(res.status_code, 200)
        names = [c["name"] for c in res.json()["components"]]
        self.assertIn("Traffic engine (Go)", names)
        # The database is up — we just queried through it to run this test.
        states = {c["name"]: c["state"] for c in res.json()["components"]}
        self.assertEqual(states["Dashboard & API (Django)"], "operational")

    def test_unreachable_component_is_not_reported_as_operational(self):
        """The whole point: a status page that can't tell must not show green."""
        with patch("apps.support.health._decision", return_value="down"):
            body = self.client.get("/api/v1/status/").json()
        states = {c["name"]: c["state"] for c in body["components"]}
        self.assertEqual(states["Traffic engine (Go)"], "down")
        self.assertIn(body["overall"], ("degraded", "down"))
