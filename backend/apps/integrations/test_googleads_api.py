"""The parts of the Google Ads push that CAN be tested without a live account:
the mutate operations, resource names, and the read-back query.

The network calls are exercised by the operator against a Google test account
(GOOGLE_ADS_LIVE_PUSH), because mocking an HTTP client into passing proves the
mock works, not that the real API accepts the request. What's worth locking down
here is that the request BODIES are shaped the way the API documents — an IP
exclusion is a negative campaign criterion with an ipBlock — and that the
add/remove/keep diff from the allocator survives into those operations.
"""
from django.test import TestCase

from apps.integrations import googleads_api


class ResourceNameTest(TestCase):
    def test_campaign_resource(self):
        self.assertEqual(googleads_api.campaign_resource("1234567890", "99"),
                         "customers/1234567890/campaigns/99")


class BuildOperationsTest(TestCase):
    CID = "1234567890"
    CAMP = "555"

    def test_an_add_is_a_negative_ip_block_criterion(self):
        ops = googleads_api.build_operations(self.CID, self.CAMP, ["45.33.32.10"], [])
        self.assertEqual(len(ops), 1)
        create = ops[0]["create"]
        self.assertEqual(create["campaign"], "customers/1234567890/campaigns/555")
        self.assertTrue(create["negative"])            # exclusion, not a target
        self.assertEqual(create["ipBlock"]["ipAddress"], "45.33.32.10")

    def test_a_wildcard_range_is_passed_through(self):
        """One /24 for the price of one of the 500 slots — the whole point of the
        allocator's range collapsing, and Google Ads accepts the wildcard form."""
        ops = googleads_api.build_operations(self.CID, self.CAMP, ["45.33.32.*"], [])
        self.assertEqual(ops[0]["create"]["ipBlock"]["ipAddress"], "45.33.32.*")

    def test_a_remove_is_addressed_by_resource_name(self):
        rn = "customers/1234567890/campaignCriteria/555~777"
        ops = googleads_api.build_operations(self.CID, self.CAMP, [], [rn])
        self.assertEqual(ops, [{"remove": rn}])

    def test_adds_and_removes_combine_in_one_operation_list(self):
        ops = googleads_api.build_operations(
            self.CID, self.CAMP, ["45.33.32.1", "45.33.32.2"],
            ["customers/1234567890/campaignCriteria/555~1"])
        self.assertEqual(sum("create" in o for o in ops), 2)
        self.assertEqual(sum("remove" in o for o in ops), 1)

    def test_nothing_to_do_is_an_empty_list(self):
        self.assertEqual(googleads_api.build_operations(self.CID, self.CAMP, [], []), [])


class QueryTest(TestCase):
    def test_the_readback_query_scopes_to_ip_blocks_on_the_campaign(self):
        q = googleads_api.existing_ip_query("555")
        self.assertIn("campaign_criterion.type = 'IP_BLOCK'", q)
        self.assertIn("campaign.id = 555", q)
        self.assertIn("campaign_criterion.resource_name", q)
        self.assertIn("campaign_criterion.ip_block.ip_address", q)

    def test_the_campaign_id_is_coerced_to_int_so_the_query_cant_be_injected(self):
        """It's interpolated into GAQL, so a non-numeric id must not slip through."""
        with self.assertRaises(ValueError):
            googleads_api.existing_ip_query("555; DROP")


class VersionTest(TestCase):
    def test_api_version_is_overridable(self):
        from django.test import override_settings
        with override_settings(GOOGLE_ADS_API_VERSION="v30"):
            self.assertEqual(googleads_api.api_version(), "v30")

    def test_it_has_a_sane_default(self):
        from django.test import override_settings
        with override_settings(GOOGLE_ADS_API_VERSION=""):
            self.assertTrue(googleads_api.api_version().startswith("v"))
