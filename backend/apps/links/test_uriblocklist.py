"""The email blocklist lookup, and the one mistake it must never make.

A hit means "retire this short domain, every campaign on it is silently
failing". A refused query looks almost identical on the wire and means nothing
at all. Confusing the two in either direction is expensive, so both are pinned
here, as is the decoding of the return codes an operator acts on.
"""
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from apps.links import uriblocklist
from apps.links.models import ShortDomain


def _stub(answers):
    """Patch the resolver with a {query_name: [addrs] | None} map.

    None stands for NXDOMAIN, which is the normal reply and means "not listed".
    """
    def fake(name):
        return answers.get(name)
    return patch.object(uriblocklist, "_resolve", side_effect=fake)


class RefusedQueryTest(TestCase):
    """The damaging mistake, first.

    These zones refuse queries from open and high-volume public resolvers, and
    the refusal arrives as an A record in 127.255.255.x — syntactically a hit.
    Reading it as a listing would retire healthy domains and move every customer
    off a perfectly good domain for no reason.
    """

    def test_a_blocked_resolver_is_not_a_listing(self):
        with _stub({
            "trynb.cc.dbl.spamhaus.org": ["127.255.255.254"],
            "trynb.cc.multi.surbl.org": ["127.255.255.252"],
            "trynb.cc.multi.uribl.com": ["127.255.255.255"],
        }):
            r = uriblocklist.check_domain("trynb.cc")
        self.assertFalse(r["listed"], "a refused query was read as a blocklist hit")
        self.assertEqual(r["listed_on"], [])
        self.assertEqual(len(r["unavailable"]), 3)
        self.assertFalse(r["checked"])
        self.assertIn("unavailable", r["detail"])

    def test_dbls_prohibited_query_code_is_not_a_listing(self):
        with _stub({"trynb.cc.dbl.spamhaus.org": ["127.0.1.255"]}):
            r = uriblocklist.check_domain("trynb.cc")
        self.assertFalse(r["listed"])
        self.assertIn("Spamhaus DBL", r["unavailable"])

    def test_uribl_blocked_code_is_not_a_listing(self):
        """127.0.0.1 is URIBL saying "I refused your query". An earlier version
        of this module treated any unrecognised 127.x as a hit and flagged a
        healthy domain on the strength of it — which is how this test exists."""
        with _stub({"trynb.cc.multi.uribl.com": ["127.0.0.1"]}):
            r = uriblocklist.check_domain("trynb.cc")
        self.assertFalse(r["listed"])
        self.assertIn("URIBL", r["unavailable"])

    def test_only_documented_codes_count_as_a_listing(self):
        """The allow-list, directly: a code a zone documents is a hit, anything
        else is 'no answer'. Getting this backwards retires healthy domains."""
        hits = [
            ("dbl.spamhaus.org", "127.0.1.2"),
            ("dbl.spamhaus.org", "127.0.1.103"),
            ("multi.uribl.com", "127.0.0.2"),
            ("multi.surbl.org", "127.0.0.64"),
        ]
        for zone, addr in hits:
            self.assertIsNotNone(uriblocklist._hit_reason(zone, addr), f"{zone} {addr}")

        not_hits = [
            ("dbl.spamhaus.org", "127.0.1.255"),    # prohibited query
            ("dbl.spamhaus.org", "127.255.255.254"),  # open resolver
            ("multi.uribl.com", "127.0.0.1"),       # blocked
            ("multi.surbl.org", "127.0.0.1"),       # no known bit set
            ("multi.uribl.com", "127.0.0.99"),      # undocumented
        ]
        for zone, addr in not_hits:
            self.assertIsNone(uriblocklist._hit_reason(zone, addr), f"{zone} {addr}")


class ListedTest(TestCase):
    def test_clean_domain_reads_clean(self):
        with _stub({}):     # every lookup NXDOMAINs
            r = uriblocklist.check_domain("trynb.cc")
        self.assertFalse(r["listed"])
        self.assertTrue(r["checked"])
        self.assertEqual(r["detail"], "not on any email blocklist")

    def test_abused_redirector_is_named_as_such(self):
        """The code a shortener actually earns. Naming it matters: 'spam domain'
        means retire the domain, 'abused spammed redirector' means request
        delisting and tighten abuse handling, and the operator cannot tell which
        to do from a bare 'listed'."""
        with _stub({"trynb.cc.dbl.spamhaus.org": ["127.0.1.103"]}):
            r = uriblocklist.check_domain("trynb.cc")
        self.assertTrue(r["listed"])
        self.assertIn("abused spammed redirector", r["detail"])
        self.assertIn("Spamhaus DBL", r["detail"])

    def test_surbl_bitmask_is_decoded(self):
        # 72 = 64 (abuse) | 8 (phishing)
        with _stub({"trynb.cc.multi.surbl.org": ["127.0.0.72"]}):
            r = uriblocklist.check_domain("trynb.cc")
        self.assertTrue(r["listed"])
        self.assertIn("abuse", r["detail"])
        self.assertIn("phishing", r["detail"])

    def test_an_undocumented_return_code_is_not_treated_as_listed(self):
        """Conservative on purpose. A zone that starts returning a code we do
        not know should make us say "I could not tell", not retire the domain
        and move every customer on it somewhere else."""
        with _stub({"trynb.cc.multi.uribl.com": ["127.0.0.99"]}):
            r = uriblocklist.check_domain("trynb.cc")
        self.assertFalse(r["listed"])
        self.assertIn("URIBL", r["unavailable"])

    def test_one_listing_among_clean_lists_is_still_a_listing(self):
        with _stub({"trynb.cc.multi.surbl.org": ["127.0.0.64"]}):
            r = uriblocklist.check_domain("trynb.cc")
        self.assertTrue(r["listed"])
        self.assertEqual(len(r["listed_on"]), 1)

    def test_empty_host_is_not_a_listing(self):
        r = uriblocklist.check_domain("")
        self.assertFalse(r["listed"])
        self.assertFalse(r["checked"])


class HealthCommandTest(TestCase):
    """The listing has to reach the admin list, or it is a lookup nobody reads."""

    def setUp(self):
        # A host of its own: SHORTLINK_BASE seeds a real short domain through
        # migration 0010, and reusing that name collides on the unique index.
        self.d = ShortDomain.objects.create(host="bl-test.example",
                                            verified_at=timezone.now())

    def _run(self, **kw):
        from django.core.management import call_command
        from io import StringIO
        out = StringIO()
        call_command("check_domain_health", host="bl-test.example",
                     stdout=out, stderr=StringIO(), **kw)
        self.d.refresh_from_db()
        return out.getvalue()

    def test_a_listed_domain_is_flagged_even_though_it_serves_fine(self):
        """The whole point: reachable, serving, browser-clean — and still the
        reason every campaign on it fails to arrive."""
        with patch("apps.links.management.commands.check_domain_health._resolves",
                   return_value=(True, "")), \
             patch("apps.links.management.commands.check_domain_health._serves",
                   return_value=(True, "HTTP 200")), \
             patch("apps.intelligence.threatscan.is_enabled", return_value=False), \
             patch.object(uriblocklist, "check_domain", return_value={
                 "listed": True,
                 "listed_on": ["Spamhaus DBL: abused spammed redirector"],
                 "unavailable": [],
                 "checked": True,
                 "detail": "email blocklist — Spamhaus DBL: abused spammed redirector",
             }):
            self._run(skip_scan=True)
        self.assertEqual(self.d.health, ShortDomain.Health.FLAGGED)
        self.assertIn("email blocklist", self.d.health_detail)

    def test_an_unreachable_domain_is_not_relabelled_by_the_blocklist_check(self):
        """A dead domain is a different problem with a different fix; the
        blocklist lookup must not overwrite the reason it is dead."""
        with patch("apps.links.management.commands.check_domain_health._resolves",
                   return_value=(False, "DNS did not resolve")), \
             patch("apps.intelligence.threatscan.is_enabled", return_value=False):
            self._run(skip_scan=True)
        self.assertEqual(self.d.health, ShortDomain.Health.UNREACHABLE)
        self.assertIn("DNS", self.d.health_detail)

    def test_lookups_can_be_skipped(self):
        with patch("apps.links.management.commands.check_domain_health._resolves",
                   return_value=(True, "")), \
             patch("apps.links.management.commands.check_domain_health._serves",
                   return_value=(True, "HTTP 200")), \
             patch("apps.intelligence.threatscan.is_enabled", return_value=False), \
             patch.object(uriblocklist, "check_domain") as m:
            self._run(skip_scan=True, skip_email_blocklists=True)
        m.assert_not_called()
        self.assertEqual(self.d.health, ShortDomain.Health.OK)
