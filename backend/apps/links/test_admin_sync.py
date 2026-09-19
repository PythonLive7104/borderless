from unittest.mock import patch

from django.contrib.admin.sites import AdminSite
from django.test import RequestFactory, TestCase
from django.utils import timezone

from apps.links.admin import ShortLinkAdmin
from apps.links.models import ShortDomain, ShortLink
from apps.links.tests import _workspace


class AdminPublishesTest(TestCase):
    """An admin edit that never reaches Redis is worse than no edit at all: the
    row says disabled while every click still redirects."""

    def setUp(self):
        self.org = _workspace("admin-sync@example.com")
        self.domain = ShortDomain.objects.create(host="korv.cc", active=True,
                                                 verified_at=timezone.now())
        self.link = ShortLink.objects.create(organization=self.org, domain=self.domain,
                                             slug="bad", destination_url="https://evil.example")
        self.admin = ShortLinkAdmin(ShortLink, AdminSite())
        self.req = RequestFactory().post("/")

    def test_saving_in_admin_republishes(self):
        with patch("apps.links.admin.publish_link") as pub:
            self.admin.save_model(self.req, self.link, None, True)
        pub.assert_called_once_with(self.link)

    def test_disable_action_withdraws_from_the_engine(self):
        with patch("apps.links.admin.publish_link") as pub, \
             patch.object(ShortLinkAdmin, "message_user"):
            self.admin.disable_and_withdraw(self.req, ShortLink.objects.filter(pk=self.link.pk))
        self.link.refresh_from_db()
        self.assertFalse(self.link.active)
        pub.assert_called_once()
