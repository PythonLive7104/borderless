"""Notifications: the publish endpoint, the quota split (free credits vs paid
daily), and channel management. The quota is the part with teeth — a leak there
is either lost revenue (free users publishing forever) or angry paid users
(cut off below their limit)."""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.billing.models import FREE_NOTIFY_DAILY, Plan, Subscription
from apps.organizations.models import create_workspace

from .models import Notification, NotifyChannel, NotifyQuota


def _clear_rl(channel_id):
    try:
        from apps.intelligence.service import _r
        _r().delete(f"notify:rl:{channel_id}")
    except Exception:
        pass


class _Base(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="n@ex.com", email="n@ex.com", password="testpass123")
        self.org = create_workspace(self.user, "Notify Co")
        self.c = APIClient()
        self.c.force_authenticate(user=self.user)

    def _channel(self):
        raw, prefix, key_hash = NotifyChannel.generate()
        ch = NotifyChannel.objects.create(organization=self.org, name="Leads",
                                          prefix=prefix, key_hash=key_hash)
        return ch, raw

    def _make_paid(self, slug="basic"):
        plan = Plan.objects.get(slug=slug)
        sub, _ = Subscription.objects.get_or_create(organization=self.org, defaults={"plan": plan})
        sub.plan = plan
        sub.status = Subscription.Status.ACTIVE
        sub.period_end = timezone.now() + timedelta(days=7)
        sub.save()
        return sub


class IngestTest(_Base):
    def test_raw_text_body_becomes_a_notification(self):
        ch, raw = self._channel()
        r = self.client.post(f"/api/v1/notify/{raw}/", data="Form submitted by jane@acme.co",
                             content_type="text/plain")
        self.assertEqual(r.status_code, 200)
        n = Notification.objects.get()
        self.assertEqual(n.message, "Form submitted by jane@acme.co")
        self.assertEqual(n.title, "Leads")  # falls back to channel name

    def test_json_message_and_title(self):
        ch, raw = self._channel()
        r = self.client.post(f"/api/v1/notify/{raw}/",
                             data={"title": "New lead", "message": "jane@acme.co"},
                             content_type="application/json")
        self.assertEqual(r.status_code, 200)
        n = Notification.objects.get()
        self.assertEqual((n.title, n.message), ("New lead", "jane@acme.co"))

    def test_cors_headers_allow_browser_publishing(self):
        """Forms publish via cross-origin fetch(), so the response must carry
        Access-Control-Allow-Origin or the browser blocks it."""
        ch, raw = self._channel()
        r = self.client.post(f"/api/v1/notify/{raw}/", data="hi", content_type="text/plain")
        self.assertEqual(r["Access-Control-Allow-Origin"], "*")

    def test_options_preflight_is_allowed(self):
        ch, raw = self._channel()
        r = self.client.options(f"/api/v1/notify/{raw}/")
        self.assertIn(r.status_code, (200, 204))
        self.assertEqual(r["Access-Control-Allow-Origin"], "*")
        self.assertIn("POST", r["Access-Control-Allow-Methods"])

    def test_put_also_works(self):
        ch, raw = self._channel()
        r = self.client.put(f"/api/v1/notify/{raw}/", data="via PUT", content_type="text/plain")
        self.assertEqual(r.status_code, 200)

    def test_get_publishes_with_query_message(self):
        ch, raw = self._channel()
        r = self.client.get(f"/api/v1/notify/{raw}/?message=Ping%20from%20link&title=Uptime")
        self.assertEqual(r.status_code, 200)
        n = Notification.objects.get()
        self.assertEqual((n.title, n.message), ("Uptime", "Ping from link"))

    def test_bare_get_still_records_a_trigger(self):
        ch, raw = self._channel()
        r = self.client.get(f"/api/v1/notify/{raw}/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(Notification.objects.get().message, "Notification triggered")

    def test_get_short_alias_m(self):
        ch, raw = self._channel()
        self.client.get(f"/api/v1/notify/{raw}/?m=hi")
        self.assertEqual(Notification.objects.get().message, "hi")

    def test_unknown_key_is_404_and_stores_nothing(self):
        r = self.client.post("/api/v1/notify/ntk_nope/", data="x", content_type="text/plain")
        self.assertEqual(r.status_code, 404)
        self.assertEqual(Notification.objects.count(), 0)

    def test_paused_channel_rejects(self):
        ch, raw = self._channel()
        ch.active = False
        ch.save(update_fields=["active"])
        r = self.client.post(f"/api/v1/notify/{raw}/", data="x", content_type="text/plain")
        self.assertEqual(r.status_code, 404)

    def test_empty_message_is_rejected_without_charging_quota(self):
        ch, raw = self._channel()
        r = self.client.post(f"/api/v1/notify/{raw}/", data="   ", content_type="text/plain")
        self.assertEqual(r.status_code, 400)
        self.assertFalse(NotifyQuota.objects.filter(organization=self.org).exists())


class PruneTest(_Base):
    def test_history_capped_per_workspace_across_channels(self):
        """The 500 cap is per workspace, not per channel — two channels can't
        each keep their own 500. Uses a small cap so the test stays fast."""
        from unittest.mock import patch
        from .models import Notification
        a, _ = self._channel()
        b, _ = self._channel()
        # 5 notifications spread across the two channels, oldest first
        for i in range(5):
            ch = a if i % 2 == 0 else b
            Notification.objects.create(channel=ch, title="t", message=f"m{i}")
        with patch("apps.notifications.ingest.KEEP_PER_ORG", 3):
            from apps.notifications.ingest import _prune
            _prune(self.org.id)
        remaining = list(Notification.objects.order_by("-created_at")
                         .values_list("message", flat=True))
        self.assertEqual(remaining, ["m4", "m3", "m2"])  # newest 3 kept, across both channels


class ExpiryTest(_Base):
    def test_write_expires_notifications_older_than_48h(self):
        from datetime import timedelta
        from django.utils import timezone
        from .models import Notification
        ch, raw = self._channel()
        old = Notification.objects.create(channel=ch, title="t", message="old")
        Notification.objects.filter(pk=old.pk).update(
            created_at=timezone.now() - timedelta(hours=49))
        # a fresh publish triggers the sweep
        self.client.post(f"/api/v1/notify/{raw}/", data="new", content_type="text/plain")
        msgs = set(Notification.objects.values_list("message", flat=True))
        self.assertEqual(msgs, {"new"})  # the 49h-old one is gone

    def test_cron_clears_quiet_channels(self):
        from datetime import timedelta
        from io import StringIO
        from django.core.management import call_command
        from django.utils import timezone
        from .models import Notification
        ch, _ = self._channel()
        keep = Notification.objects.create(channel=ch, title="t", message="recent")
        gone = Notification.objects.create(channel=ch, title="t", message="stale")
        Notification.objects.filter(pk=gone.pk).update(
            created_at=timezone.now() - timedelta(hours=50))
        call_command("clear_old_notifications", stdout=StringIO())
        self.assertEqual(list(Notification.objects.values_list("message", flat=True)), ["recent"])


class FreeQuotaTest(_Base):
    def test_free_gets_a_daily_allowance(self):
        from . import quota
        st = quota.status(self.org.id)
        self.assertEqual(st["mode"], "daily")
        self.assertEqual(st["limit"], FREE_NOTIFY_DAILY)

    def test_free_daily_limit_blocks_once_reached(self):
        from django.utils import timezone
        NotifyQuota.objects.create(organization=self.org,
                                   day=timezone.localdate(), day_used=FREE_NOTIFY_DAILY)
        ch, raw = self._channel()
        r = self.client.post(f"/api/v1/notify/{raw}/", data="over", content_type="text/plain")
        self.assertEqual(r.status_code, 429)

    def test_free_allowance_is_per_workspace_across_channels(self):
        from django.utils import timezone
        a, ra = self._channel()
        NotifyQuota.objects.create(organization=self.org,
                                   day=timezone.localdate(), day_used=FREE_NOTIFY_DAILY)
        b, rb = self._channel()
        _clear_rl(b.id)
        r = self.client.post(f"/api/v1/notify/{rb}/", data="x", content_type="text/plain")
        self.assertEqual(r.status_code, 429)


class PaidQuotaTest(_Base):
    def test_paid_uses_daily_limit_not_credits(self):
        self._make_paid("basic")  # 1000/day
        from . import quota
        st = quota.status(self.org.id)
        self.assertEqual(st["mode"], "daily")
        self.assertEqual(st["limit"], 1000)

    def test_daily_counter_resets_the_next_day(self):
        self._make_paid("basic")
        # simulate yesterday's usage sitting at the cap
        NotifyQuota.objects.create(organization=self.org,
                                   day=timezone.localdate() - timedelta(days=1), day_used=1000)
        ch, raw = self._channel()
        r = self.client.post(f"/api/v1/notify/{raw}/", data="today", content_type="text/plain")
        self.assertEqual(r.status_code, 200)  # yesterday's cap doesn't block today
        row = NotifyQuota.objects.get(organization=self.org)
        self.assertEqual(row.day, timezone.localdate())
        self.assertEqual(row.day_used, 1)

    def test_daily_limit_blocks_once_reached(self):
        self._make_paid("basic")
        NotifyQuota.objects.create(organization=self.org,
                                   day=timezone.localdate(), day_used=1000)
        ch, raw = self._channel()
        r = self.client.post(f"/api/v1/notify/{raw}/", data="over", content_type="text/plain")
        self.assertEqual(r.status_code, 429)


class ChannelManagementTest(_Base):
    def test_create_returns_the_key_once(self):
        r = self.c.post("/api/notifications/channels/",
                        {"organization": self.org.id, "name": "Survey"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(r.json()["key"].startswith("ntk_"))
        # the raw key is never stored, only its hash
        self.assertFalse(NotifyChannel.objects.filter(key_hash=r.json()["key"]).exists())

    def test_feed_lists_notifications_and_quota(self):
        ch, raw = self._channel()
        self.client.post(f"/api/v1/notify/{raw}/", data="hi", content_type="text/plain")
        r = self.c.get(f"/api/notifications/feed/?organization={self.org.id}")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.json()["results"]), 1)
        self.assertEqual(r.json()["unread"], 1)
        self.assertEqual(r.json()["quota"]["mode"], "daily")

    def test_mark_read(self):
        ch, raw = self._channel()
        self.client.post(f"/api/v1/notify/{raw}/", data="hi", content_type="text/plain")
        self.c.post("/api/notifications/feed/read/", {"organization": self.org.id}, format="json")
        self.assertEqual(Notification.objects.filter(read=False).count(), 0)

    def test_unread_count_endpoint(self):
        ch, raw = self._channel()
        self.client.post(f"/api/v1/notify/{raw}/", data="a", content_type="text/plain")
        self.client.post(f"/api/v1/notify/{raw}/", data="b", content_type="text/plain")
        r = self.c.get(f"/api/notifications/unread-count/?organization={self.org.id}")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["unread"], 2)

    def test_unread_count_zero_for_non_member(self):
        other = get_user_model().objects.create_user(
            username="x@ex.com", email="x@ex.com", password="testpass123")
        oc = APIClient(); oc.force_authenticate(user=other)
        r = oc.get(f"/api/notifications/unread-count/?organization={self.org.id}")
        self.assertEqual(r.json()["unread"], 0)

    def test_another_workspace_cannot_read_the_feed(self):
        other = get_user_model().objects.create_user(
            username="o@ex.com", email="o@ex.com", password="testpass123")
        oc = APIClient(); oc.force_authenticate(user=other)
        r = oc.get(f"/api/notifications/feed/?organization={self.org.id}")
        self.assertEqual(r.status_code, 403)
