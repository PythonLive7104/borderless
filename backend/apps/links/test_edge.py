"""Edge KV sync: only links that filter no one may be served at the edge, and
the sync must PUT those and DELETE everything else."""
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from apps.links.edge import edge_simple, kv_value, sync_link_kv
from apps.links.models import ShortDomain, ShortLink
from apps.links.tests import _workspace


class EdgeSafetyTest(TestCase):
    def setUp(self):
        self.org = _workspace("edge@example.com")
        self.dom = ShortDomain.objects.create(host="e.cc", active=True,
                                              verified_at=timezone.now())

    def _link(self, **kw):
        f = dict(organization=self.org, domain=self.dom, slug="s",
                 destination_url="https://dest.example", active=True, bot_action="off")
        f.update(kw)
        return ShortLink(**f)

    def test_a_plain_redirect_is_edge_safe(self):
        self.assertTrue(edge_simple(self._link()))

    def test_each_filter_makes_it_unsafe(self):
        for kw in ({"bot_action": "decoy"}, {"challenge": True}, {"deep_check": True},
                   {"block_vpn": True}, {"block_datacenter": True}, {"max_risk": 70},
                   {"country_mode": "allow"}, {"device_mode": "block"}, {"os_mode": "allow"},
                   {"active": False}, {"url_safe": False}):
            self.assertFalse(edge_simple(self._link(**kw)), f"{kw} should NOT be edge-safe")

    def test_a_link_with_its_own_rule_is_not_edge_safe(self):
        link = self._link()
        link.save()
        from apps.rules.models import TrafficRule
        TrafficRule.objects.create(organization=self.org, short_link=link,
                                   name="r", action="block", active=True)
        self.assertFalse(edge_simple(link))

    def test_kv_value_carries_only_what_the_edge_needs(self):
        v = kv_value(self._link(forward_params=True))
        self.assertEqual(v["dest"], "https://dest.example")
        self.assertTrue(v["forward_params"])
        self.assertEqual(v["org"], str(self.org.id))


class EdgeSyncActionTest(TestCase):
    def setUp(self):
        self.org = _workspace("edge2@example.com")
        self.dom = ShortDomain.objects.create(host="e2.cc", active=True,
                                              verified_at=timezone.now())

    def test_edge_safe_link_is_put(self):
        link = ShortLink(organization=self.org, domain=self.dom, slug="ok",
                         destination_url="https://d.example", active=True, bot_action="off")
        with patch("apps.links.edge._cf_call") as cf:
            sync_link_kv(link)
        method, key, body = cf.call_args[0]
        self.assertEqual(method, "PUT")
        self.assertEqual(key, "e2.cc:ok")
        self.assertIn(b"d.example", body)

    def test_filtering_link_is_deleted_from_edge(self):
        link = ShortLink(organization=self.org, domain=self.dom, slug="dec",
                         destination_url="https://d.example", active=True, bot_action="decoy")
        with patch("apps.links.edge._cf_call") as cf:
            sync_link_kv(link)
        method, key, _ = cf.call_args[0]
        self.assertEqual(method, "DELETE")
        self.assertEqual(key, "e2.cc:dec")
