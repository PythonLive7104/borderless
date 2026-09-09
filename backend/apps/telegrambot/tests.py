"""The bot is another front end onto the same rules — never a second set."""
import json
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.links.models import ShortDomain, ShortLink
from apps.organizations.models import create_workspace
from apps.telegrambot.models import TelegramLink, TelegramLinkToken

SECRET = "s3cret-webhook-value"
CHAT = 4242


def _domain():
    d, _ = ShortDomain.objects.get_or_create(
        host="trynb.cc", defaults={"active": True, "is_default": True,
                                   "verified_at": timezone.now()})
    return d


@override_settings(TELEGRAM_BOT_TOKEN="test:token", TELEGRAM_WEBHOOK_SECRET=SECRET,
                   TELEGRAM_BOT_USERNAME="TryNoBot_bot", SHORTLINK_BASE="https://trynb.cc")
class BotTestBase(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="bot@example.com", email="bot@example.com", password="testpass123")
        self.org = create_workspace(self.user, "Bot Co")
        _domain()
        self.c = APIClient()
        self.sent = []

    def _patch_send(self):
        return patch("apps.telegrambot.api.send",
                     side_effect=lambda cid, text, **kw: self.sent.append(text))

    def _update(self, text, secret=SECRET, header=SECRET):
        body = {"message": {"chat": {"id": CHAT}, "text": text, "from": {"username": "tester"}}}
        return self.c.post(f"/api/telegram/webhook/{secret}/", data=json.dumps(body),
                           content_type="application/json",
                           HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN=header)

    def _connect(self):
        t = TelegramLinkToken.objects.create(user=self.user, organization=self.org)
        with self._patch_send():
            self._update(f"/start {t.token}")
        self.sent.clear()
        return TelegramLink.objects.get(chat_id=CHAT)


class WebhookSecurityTest(BotTestBase):
    def test_wrong_path_secret_is_a_404(self):
        with self._patch_send():
            self.assertEqual(self._update("/help", secret="wrong").status_code, 404)

    def test_missing_header_secret_is_a_404(self):
        # The path alone isn't enough: a leaked URL must not be usable.
        with self._patch_send():
            self.assertEqual(self._update("/help", header="").status_code, 404)

    def test_a_valid_update_is_accepted(self):
        with self._patch_send():
            self.assertEqual(self._update("/help").status_code, 200)

    def test_a_handler_crash_still_answers_200(self):
        # Anything else and Telegram retries, repeating the action.
        with patch("apps.telegrambot.handlers.handle_message", side_effect=RuntimeError("boom")):
            self.assertEqual(self._update("/help").status_code, 200)


class ConnectTest(BotTestBase):
    def test_a_token_connects_the_chat(self):
        link = self._connect()
        self.assertEqual(link.user, self.user)
        self.assertEqual(link.organization, self.org)

    def test_a_token_cannot_be_used_twice(self):
        t = TelegramLinkToken.objects.create(user=self.user, organization=self.org)
        with self._patch_send():
            self._update(f"/start {t.token}")
            TelegramLink.objects.all().delete()
            self.sent.clear()
            self._update(f"/start {t.token}")
        self.assertIn("expired or was already used", self.sent[0])
        self.assertFalse(TelegramLink.objects.exists())

    def test_an_expired_token_is_refused(self):
        t = TelegramLinkToken.objects.create(user=self.user, organization=self.org)
        TelegramLinkToken.objects.filter(pk=t.pk).update(
            created_at=timezone.now() - timedelta(hours=2))
        with self._patch_send():
            self._update(f"/start {t.token}")
        self.assertFalse(TelegramLink.objects.exists())

    def test_an_unconnected_chat_is_told_how_to_connect(self):
        with self._patch_send():
            self._update("📊 My redirects")
        self.assertIn("isn't connected", self.sent[0])


class RedirectFlowTest(BotTestBase):
    def test_the_paywall_applies_in_chat_too(self):
        self._connect()
        with self._patch_send():
            self._update("🔗 New redirect")
        self.assertIn("paid feature", self.sent[0])
        self.assertFalse(ShortLink.objects.exists())

    def test_a_paid_workspace_can_create_a_redirect(self):
        link = self._connect()
        call_command("grant_plan", "--org", str(self.org.id), "--plan", "pro", verbosity=0)
        with self._patch_send():
            self._update("🔗 New redirect")
            link.refresh_from_db()
            self.assertEqual(link.state, "await_destination")
            self._update("https://my-offer.com/landing")
        obj = ShortLink.objects.get()
        self.assertEqual(obj.destination_url, "https://my-offer.com/landing")
        self.assertIn("trynb.cc", self.sent[-1])
        link.refresh_from_db()
        self.assertEqual(link.state, "")          # flow finished

    def test_a_non_url_is_rejected_without_creating_anything(self):
        self._connect()
        call_command("grant_plan", "--org", str(self.org.id), "--plan", "pro", verbosity=0)
        with self._patch_send():
            self._update("🔗 New redirect")
            self._update("not a url")
        self.assertIn("web address", self.sent[-1])
        self.assertFalse(ShortLink.objects.exists())

    def test_the_plan_cap_is_enforced_in_chat(self):
        self._connect()
        call_command("grant_plan", "--org", str(self.org.id), "--plan", "basic",
                     "--interval", "weekly", verbosity=0)   # 2 redirects
        for i in range(2):
            ShortLink.objects.create(organization=self.org, domain=_domain(),
                                     slug=f"x{i}", destination_url="https://e.example")
        with self._patch_send():
            self._update("🔗 New redirect")
        self.assertIn("used all", self.sent[0])

    def test_cancel_clears_a_flow_in_progress(self):
        link = self._connect()
        call_command("grant_plan", "--org", str(self.org.id), "--plan", "pro", verbosity=0)
        with self._patch_send():
            self._update("🔗 New redirect")
            self._update("/cancel")
        link.refresh_from_db()
        self.assertEqual(link.state, "")


class ConnectEndpointTest(BotTestBase):
    def setUp(self):
        super().setUp()
        self.c.force_authenticate(user=self.user)

    def test_it_mints_a_deep_link(self):
        r = self.c.post("/api/telegram/connect/", {"organization": self.org.id}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertIn("t.me/TryNoBot_bot?start=", r.json()["deep_link"])

    def test_a_non_member_cannot_mint_one(self):
        other = get_user_model().objects.create_user(
            username="x@example.com", email="x@example.com", password="testpass123")
        c = APIClient(); c.force_authenticate(user=other)
        r = c.post("/api/telegram/connect/", {"organization": self.org.id}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_status_reports_a_connected_chat(self):
        self._connect()
        r = self.c.get(f"/api/telegram/connect/?organization={self.org.id}")
        self.assertTrue(r.json()["connected"])


class ConnectStatusGatingTest(BotTestBase):
    def setUp(self):
        super().setUp()
        self.c.force_authenticate(user=self.user)

    @override_settings(TELEGRAM_BOT_TOKEN="")
    def test_status_reports_disabled_when_no_bot_token(self):
        # The Settings UI hides itself on this, rather than offering a button
        # that cannot work.
        r = self.c.get(f"/api/telegram/connect/?organization={self.org.id}")
        self.assertFalse(r.json()["enabled"])

    @override_settings(TELEGRAM_BOT_TOKEN="")
    def test_minting_a_link_is_refused_when_the_bot_is_unconfigured(self):
        r = self.c.post("/api/telegram/connect/", {"organization": self.org.id}, format="json")
        self.assertEqual(r.status_code, 503)

    def test_disconnect_removes_the_chat(self):
        self._connect()
        r = self.c.delete(f"/api/telegram/connect/?organization={self.org.id}")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(TelegramLink.objects.filter(organization=self.org).exists())
