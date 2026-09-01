from django.test import TestCase
from apps.intelligence.botcheck import _validate


class BotCheckSSRFTest(TestCase):
    def test_blocks_private_and_bad_targets(self):
        for bad in ["http://127.0.0.1/", "http://10.0.0.1/", "http://169.254.169.254/", "ftp://example.com/"]:
            url, err = _validate(bad)
            self.assertIsNone(url, f"{bad} should be rejected")
            self.assertTrue(err)

    def test_allows_public_host(self):
        url, err = _validate("https://example.com/")
        self.assertIsNotNone(url)
        self.assertIsNone(err)
