from django.test import TestCase
from apps.intelligence.botcheck import _validate, run_check


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


class BotCheckOwnTagTest(TestCase):
    """A customer who installs the snippet and then scans their own site must
    not be told they have no bot detection."""

    def _scan(self, body):
        from unittest.mock import patch
        url = "https://site.example/"
        with patch("apps.intelligence.botcheck._validate", return_value=(url, None)), \
             patch("apps.intelligence.botcheck._fetch",
                   return_value=(200, {}, body, url)), \
             patch("apps.intelligence.botcheck._robots", return_value=False):
            return run_check(url)

    def _labels(self, res):
        return [f["label"] for f in res["findings"]]

    def test_our_snippet_is_recognised(self):
        res = self._scan(
            '<script async src="https://trynobot.com/bl.js" '
            'data-site-id="st_5d91b8fc131e14b1"></script>')
        self.assertIn("TryNoBot is installed", self._labels(res))
        self.assertNotIn("No bot detection detected", self._labels(res))

    def test_a_bare_page_still_reports_the_gap(self):
        res = self._scan("<html><body>nothing here</body></html>")
        self.assertIn("No bot detection detected", self._labels(res))

    def test_our_tag_lowers_exposure(self):
        bare = self._scan("<html></html>")["exposure"]
        ours = self._scan('<script data-site-id="st_abc"></script>')["exposure"]
        self.assertLess(ours, bare)
