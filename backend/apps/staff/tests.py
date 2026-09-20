"""Admin broadcast email: staff-only, previews accurately, targets the right
audience, and always ships HTML + text so it doesn't look like spam."""
from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase
from rest_framework.test import APIClient

User = get_user_model()


class AdminEmailTest(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user(
            username="boss@trynobot.com", email="boss@trynobot.com",
            password="x", is_staff=True)
        self.c = APIClient()
        self.c.force_authenticate(user=self.staff)

    def test_non_staff_cannot_send(self):
        u = User.objects.create_user(username="joe@x.com", email="joe@x.com", password="x")
        c = APIClient(); c.force_authenticate(user=u)
        r = c.post("/api/admin/email/send/",
                   {"subject": "Hi", "body_html": "<p>Hi</p>", "mode": "test"}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_preview_wraps_body_in_the_branded_shell(self):
        r = self.c.post("/api/admin/email/preview/",
                        {"subject": "Launch", "body_html": "<p>Hello there</p>"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertIn("Hello there", r.data["html"])
        self.assertIn("TryNoBot", r.data["html"])          # shell header
        self.assertIn("unsubscribe", r.data["html"].lower())  # footer
        self.assertIn("Hello there", r.data["text"])        # text fallback derived

    def test_test_mode_sends_only_to_the_admin(self):
        User.objects.create_user(username="other@x.com", email="other@x.com", password="x")
        r = self.c.post("/api/admin/email/send/",
                        {"subject": "Test", "body_html": "<p>Body</p>", "mode": "test"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["recipients"], 1)
        self.assertEqual([m.to for m in mail.outbox], [["boss@trynobot.com"]])
        # multipart: has an HTML alternative
        self.assertTrue(any(mt == "text/html" for _, mt in mail.outbox[0].alternatives))
        self.assertIn("List-Unsubscribe", mail.outbox[0].extra_headers)

    def test_users_mode_targets_all_users_deduped(self):
        User.objects.create_user(username="a@x.com", email="a@x.com", password="x")
        User.objects.create_user(username="b@x.com", email="b@x.com", password="x")
        r = self.c.post("/api/admin/email/send/",
                        {"subject": "News", "body_html": "<p>Hi</p>", "mode": "users"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["recipients"], 3)  # staff + a + b
        self.assertEqual(len(mail.outbox), 3)

    def test_leads_mode_targets_unconverted_bot_check_leads(self):
        from apps.intelligence.models import BotCheckLead
        BotCheckLead.objects.create(email="lead1@x.com", url="https://x.com")
        BotCheckLead.objects.create(email="lead2@x.com", url="https://y.com", converted=True)
        r = self.c.post("/api/admin/email/send/",
                        {"subject": "Offer", "body_html": "<p>Hi</p>", "mode": "leads"}, format="json")
        self.assertEqual(r.data["recipients"], 1)  # only the unconverted lead

    def test_empty_audience_and_missing_fields_are_rejected(self):
        r = self.c.post("/api/admin/email/send/",
                        {"subject": "", "body_html": "", "mode": "test"}, format="json")
        self.assertEqual(r.status_code, 400)
        r2 = self.c.post("/api/admin/email/send/",
                         {"subject": "Hi", "body_html": "<p>x</p>", "mode": "custom", "emails": ""},
                         format="json")
        self.assertEqual(r2.status_code, 400)
