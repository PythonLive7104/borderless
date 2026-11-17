"""Choosing which IPs to hand to the ad platform.

This is money logic. The customer gives us write access to their ad account and
we spend a capped, scarce resource on their behalf — 500 slots per campaign —
so the tests are written around the ways it can cost them:

  * excluding something that was never costing money (a wasted slot, and a
    click still being paid for),
  * excluding something that is not fraud at all (a lost customer, or the
    advertiser's own network),
  * wasting the budget on an address range that can mint new addresses faster
    than we can list them,
  * churning the account — removing and re-adding the same entry every cycle.

The happy path gets one test. The failures get the rest.
"""
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from apps.traffic import exclusions
from apps.traffic.paid_click import campaign_ref


def _row(ip, *, paid=False, flagged=True, days_ago=0, now=None):
    now = now or timezone.now()
    return {"ip": ip, "is_paid_click": paid, "flagged": flagged,
            "created_at": now - timedelta(days=days_ago)}


def _values(candidates):
    return [c.value for c in candidates]


class CampaignRefTest(TestCase):
    """Reading the ad platform's own campaign id out of the landing URL."""

    def test_our_own_suffix_is_read(self):
        cid, gid = campaign_ref("https://shop.example/lp?tnb_cid=12345678&tnb_gid=EAIaIQ")
        self.assertEqual(cid, "12345678")
        self.assertEqual(gid, "EAIaIQ")

    def test_an_existing_campaignid_param_is_honoured(self):
        """Someone already tagging campaigns for another tool should not have to
        redo their URLs to turn this on."""
        cid, _ = campaign_ref("https://shop.example/?campaignid=987&gclid=abc")
        self.assertEqual(cid, "987")

    def test_an_unsubstituted_valuetrack_template_is_not_a_campaign_id(self):
        """The failure that would poison the data: a misconfigured account ships
        the literal template to production. Storing "{campaignid}" as an id
        would group every campaign's traffic under one fake campaign."""
        cid, gid = campaign_ref("https://shop.example/?tnb_cid={campaignid}&tnb_gid={gclid}")
        self.assertEqual(cid, "")
        self.assertEqual(gid, "")

    def test_a_gclid_alone_still_gives_a_click_id(self):
        """The fallback route for accounts that never add the suffix — the
        campaign has to be resolved through the API later, but the click id has
        to be kept now or that route is closed forever."""
        cid, gid = campaign_ref("https://shop.example/?gclid=EAIaIQ")
        self.assertEqual(cid, "")
        self.assertEqual(gid, "EAIaIQ")

    def test_organic_traffic_has_neither(self):
        self.assertEqual(campaign_ref("https://shop.example/blog/post"), ("", ""))

    def test_rubbish_does_not_raise(self):
        self.assertEqual(campaign_ref("not a url at all"), ("", ""))
        self.assertEqual(campaign_ref(""), ("", ""))


class NeverExcludeTest(TestCase):
    """Addresses that must never reach an ad account, whatever they did."""

    def test_private_and_reserved_ranges_are_dropped(self):
        """Excluding one of these in a live account is a self-inflicted outage —
        it can also never be the source of a paid click, so there is no reading
        of the data where it belongs in the list.

        The documentation ranges are in here deliberately. Python 3.12 moved
        RFC 5737 (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24) under
        is_private, which is why the rest of this file uses real public
        addresses for its fixtures — the obvious "example" addresses are all
        silently dropped by _usable().
        """
        now = timezone.now()
        rows = [_row(ip, paid=True, now=now) for ip in
                ("10.0.0.5", "192.168.1.9", "127.0.0.1", "169.254.1.1", "0.0.0.0",
                 "192.0.2.1", "198.51.100.1", "203.0.113.1")]
        self.assertEqual(exclusions.score_candidates(rows, now=now), [])

    def test_malformed_addresses_are_dropped(self):
        now = timezone.now()
        rows = [_row(ip, paid=True, now=now) for ip in ("", "not-an-ip", "999.1.1.1")]
        self.assertEqual(exclusions.score_candidates(rows, now=now), [])

    def test_clean_unpaid_traffic_earns_nothing(self):
        """A real visitor who was allowed through is not a candidate. Scoring
        them would spend slots on the customer's actual audience."""
        now = timezone.now()
        rows = [_row("45.33.32.9", paid=False, flagged=False, now=now)] * 20
        self.assertEqual(exclusions.score_candidates(rows, now=now), [])

    def test_a_paid_click_that_was_never_flagged_is_a_real_customer(self):
        """The most expensive mistake available here, so it gets its own test.

        "Paid clicks are what cost money" is true and sounds like the whole
        story, which makes it tempting to score every paid click. But a paid
        click we scored as human and let through is a REAL BUYER arriving from
        the ad the advertiser is paying for. Excluding their address stops that
        customer ever seeing the ad again — worse than any fraud this feature
        prevents, and it would look like the product working.
        """
        now = timezone.now()
        rows = [_row("45.33.32.8", paid=True, flagged=False, now=now)] * 50
        self.assertEqual(exclusions.score_candidates(rows, now=now), [])


class RankingTest(TestCase):
    def setUp(self):
        self.now = timezone.now()

    def test_a_paid_click_outranks_louder_unpaid_traffic(self):
        """The core judgement. Only paid clicks were ever billed, so the noisy
        address that cost nothing must not take the slot from the quiet one
        that did."""
        rows = ([_row("45.33.32.1", paid=True, now=self.now)]
                + [_row("93.184.216.1", paid=False, flagged=True, now=self.now)] * 5)
        ranked = exclusions.score_candidates(rows, now=self.now)
        self.assertEqual(ranked[0].value, "45.33.32.1")

    def test_recent_abuse_outranks_old_abuse(self):
        """A residential address abusive a month ago is probably somebody's home
        connection now."""
        rows = [_row("45.33.32.1", paid=True, days_ago=0, now=self.now),
                _row("93.184.216.1", paid=True, days_ago=21, now=self.now)]
        ranked = exclusions.score_candidates(rows, now=self.now)
        self.assertEqual(ranked[0].value, "45.33.32.1")

    def test_traffic_older_than_the_window_is_ignored(self):
        rows = [_row("45.33.32.1", paid=True,
                     days_ago=exclusions.LOOKBACK_DAYS + 1, now=self.now)]
        self.assertEqual(exclusions.score_candidates(rows, now=self.now), [])

    def test_the_order_is_stable_between_runs(self):
        """An unstable order churns the ad account: the same entries removed and
        re-added every cycle, two mutations each, and a window where the
        customer is paying for those clicks again."""
        rows = [_row(f"45.33.32.{i}", paid=True, now=self.now) for i in (1, 2)] * 3
        first = _values(exclusions.score_candidates(rows, now=self.now))
        second = _values(exclusions.score_candidates(list(reversed(rows)), now=self.now))
        self.assertEqual(first, second)


class RangeCollapseTest(TestCase):
    """The biggest win available, and the one that decides whether 500 slots is
    enough: a datacenter range cycling its address pool."""

    def setUp(self):
        self.now = timezone.now()

    def test_a_busy_range_becomes_one_entry(self):
        rows = [_row(f"45.33.32.{i}", paid=True, now=self.now)
                for i in range(1, exclusions.RANGE_COLLAPSE_AT + 1)]
        ranked = exclusions.score_candidates(rows, now=self.now)
        self.assertEqual(_values(ranked), ["45.33.32.*"])
        self.assertTrue(ranked[0].is_range)
        self.assertEqual(ranked[0].addresses, exclusions.RANGE_COLLAPSE_AT)

    def test_a_quiet_range_is_left_as_individual_addresses(self):
        """Collapsing too eagerly turns away everyone sharing a consumer ISP's
        /24, so below the threshold the addresses stay separate."""
        rows = [_row("45.33.32.1", paid=True, now=self.now),
                _row("45.33.32.2", paid=True, now=self.now)]
        self.assertEqual(sorted(_values(exclusions.score_candidates(rows, now=self.now))),
                         ["45.33.32.1", "45.33.32.2"])

    def test_a_collapsed_range_outranks_any_single_address_in_it(self):
        rows = ([_row(f"45.33.32.{i}", paid=True, now=self.now) for i in range(1, 5)]
                + [_row("93.184.216.7", paid=True, now=self.now)])
        ranked = exclusions.score_candidates(rows, now=self.now)
        self.assertEqual(ranked[0].value, "45.33.32.*")

    def test_one_slot_can_cover_a_whole_range(self):
        """Why this matters at all: 256 addresses for the price of one of 500."""
        rows = [_row(f"45.33.32.{i}", paid=True, now=self.now) for i in range(1, 60)]
        ranked = exclusions.score_candidates(rows, now=self.now)
        self.assertEqual(len(ranked), 1)
        self.assertEqual(ranked[0].addresses, 59)


class AllocationTest(TestCase):
    def setUp(self):
        self.now = timezone.now()

    def _ranked(self, n):
        # Distinct /24s so nothing collapses and the count is predictable.
        rows = [_row(f"45.33.{i}.1", paid=True, now=self.now) for i in range(n)]
        return exclusions.score_candidates(rows, now=self.now)

    def test_the_cap_is_respected(self):
        """Exceeding Google's limit does not truncate politely — the whole
        mutate fails, so nothing gets excluded at all."""
        plan = exclusions.allocate(self._ranked(20), limit=5)
        self.assertEqual(len(plan["add"]), 5)
        self.assertEqual(len(plan["skipped"]), 15)
        self.assertEqual(plan["used"], 5)

    def test_unchanged_entries_are_kept_not_rewritten(self):
        """Leaving an exclusion alone is free; removing and re-adding it is two
        mutations and a gap where the customer is paying again."""
        ranked = self._ranked(3)
        existing = [c.value for c in ranked]
        plan = exclusions.allocate(ranked, limit=10, existing=existing)
        self.assertEqual(sorted(plan["keep"]), sorted(existing))
        self.assertEqual(plan["add"], [])
        self.assertEqual(plan["remove"], [])

    def test_entries_that_no_longer_qualify_are_removed(self):
        """Slots are scarce, so an address that stopped offending has to give
        its slot back rather than hold it forever."""
        plan = exclusions.allocate(self._ranked(2), limit=10,
                                   existing=["93.184.216.99"])
        self.assertEqual(plan["remove"], ["93.184.216.99"])

    def test_an_empty_account_is_all_additions(self):
        plan = exclusions.allocate(self._ranked(3), limit=10, existing=[])
        self.assertEqual(len(plan["add"]), 3)
        self.assertEqual(plan["keep"], [])
        self.assertEqual(plan["remove"], [])

    def test_nothing_to_do_is_not_an_error(self):
        plan = exclusions.allocate([], limit=10, existing=[])
        self.assertEqual(plan, {"keep": [], "add": [], "remove": [], "skipped": [],
                                "limit": 10, "used": 0})


class PlanForCampaignTest(TestCase):
    """The query that joins it all up, against a real database.

    The ranking above is pure and tested in isolation; this is the part that can
    be wrong in ways unit tests cannot see — the wrong join, the wrong campaign,
    a filter that silently matches nothing.
    """

    def setUp(self):
        from django.contrib.auth import get_user_model
        from apps.organizations.models import create_workspace
        from apps.websites.models import Website

        user = get_user_model().objects.create_user(
            username="plan@exc.example", email="plan@exc.example", password="testpass123")
        self.org = create_workspace(user, "Acme")
        self.site = Website.objects.create(organization=self.org, name="s",
                                           domain="shop.example")
        self.now = timezone.now()

    def _hit(self, ip, campaign, *, paid=True, classification="bot",
             action="block", reviewer=False, days_ago=0):
        from apps.traffic.models import Session, TrafficEvent, Visitor
        visitor, _ = Visitor.objects.get_or_create(website=self.site, visitor_id=ip)
        session, _ = Session.objects.get_or_create(
            website=self.site, session_id=f"{campaign}-{ip}",
            defaults={"visitor": visitor, "is_paid_click": paid,
                      "ad_platform": "google_ads", "ad_campaign_id": campaign})
        return TrafficEvent.objects.create(
            website=self.site, visitor=visitor, session=session, ip=ip,
            classification=classification, action=action, is_reviewer=reviewer,
            created_at=self.now - timedelta(days=days_ago))

    def test_it_plans_only_for_the_campaign_asked_about(self):
        """Exclusions are per campaign. Leaking another campaign's addresses in
        would spend this campaign's scarce slots on traffic it never saw."""
        self._hit("45.33.32.10", "111")
        self._hit("93.184.216.20", "222")

        plan = exclusions.plan_for_campaign([self.site.id], "111", now=self.now)
        self.assertEqual(plan["campaign_id"], "111")
        self.assertEqual(plan["add"], ["45.33.32.10"])

    def test_a_verified_ad_reviewer_is_never_excluded(self):
        """Google's own landing-page reviewer arrives as automated traffic.
        Excluding it would hide the advertiser's page from the network deciding
        whether their ads may run — the opposite of protecting the budget."""
        self._hit("45.33.32.11", "111", reviewer=True)
        plan = exclusions.plan_for_campaign([self.site.id], "111", now=self.now)
        self.assertEqual(plan["add"], [])

    def test_a_human_who_was_allowed_through_is_not_a_candidate(self):
        self._hit("45.33.32.12", "111", paid=True,
                  classification="human", action="allow")
        plan = exclusions.plan_for_campaign([self.site.id], "111", now=self.now)
        self.assertEqual(plan["add"], [])

    def test_every_proposal_carries_a_reason(self):
        self._hit("45.33.32.13", "111")
        plan = exclusions.plan_for_campaign([self.site.id], "111", now=self.now)
        self.assertEqual(len(plan["candidates"]), 1)
        self.assertIn("paid ad click", plan["candidates"][0]["reason"])

    def test_the_cap_is_applied_end_to_end(self):
        for i in range(6):
            self._hit(f"45.33.{i}.1", "111")
        plan = exclusions.plan_for_campaign([self.site.id], "111",
                                            now=self.now, limit=2)
        self.assertEqual(len(plan["add"]), 2)
        self.assertEqual(len(plan["skipped"]), 4)

    def test_a_campaign_with_no_traffic_plans_nothing(self):
        plan = exclusions.plan_for_campaign([self.site.id], "999", now=self.now)
        self.assertEqual(plan["add"], [])
        self.assertEqual(plan["candidates"], [])


class ReasonTest(TestCase):
    """Every proposed exclusion has to be defensible to the advertiser whose
    account it changes. "Trust the score" is not good enough when a wrong entry
    turns away a real customer."""

    def test_the_reason_names_the_paid_clicks(self):
        now = timezone.now()
        ranked = exclusions.score_candidates(
            [_row("45.33.32.1", paid=True, now=now)] * 3, now=now)
        self.assertIn("3 paid ad clicks", ranked[0].reason)

    def test_a_range_says_how_many_addresses_it_covers(self):
        now = timezone.now()
        rows = [_row(f"45.33.32.{i}", paid=True, now=now) for i in range(1, 5)]
        ranked = exclusions.score_candidates(rows, now=now)
        self.assertIn("4 addresses", ranked[0].reason)
