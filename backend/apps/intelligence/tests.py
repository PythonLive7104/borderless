from django.test import TestCase
from apps.intelligence.botcheck import _validate, run_check
from apps.intelligence.threatscan import scan_url as run_scan


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


class VirusTotalThresholdTest(TestCase):
    """One VirusTotal engine out of ~90 is usually a false positive. Disabling a
    customer's live link on that costs them real traffic."""

    def _scan(self, vt_hits, sb_threats=None, minimum=3):
        from unittest.mock import patch
        from django.test import override_settings
        with override_settings(THREATSCAN_VT_MIN_DETECTIONS=minimum), \
             patch("apps.intelligence.threatscan.is_enabled", return_value=True), \
             patch("apps.intelligence.threatscan._sb_key", return_value="k"), \
             patch("apps.intelligence.threatscan._vt_key", return_value="k"), \
             patch("apps.intelligence.threatscan._safe_browsing", return_value=sb_threats or []), \
             patch("apps.intelligence.threatscan._vt_scan", return_value=vt_hits):
            return run_scan("https://example.test/x")

    def test_a_single_detection_no_longer_disables(self):
        self.assertTrue(self._scan(1)["safe"])

    def test_two_is_still_below_the_default_bar(self):
        self.assertTrue(self._scan(2)["safe"])

    def test_corroborated_detections_are_unsafe(self):
        r = self._scan(3)
        self.assertFalse(r["safe"])
        self.assertIn("virustotal", r["flagged_by"])

    def test_safe_browsing_alone_is_enough(self):
        r = self._scan(0, sb_threats=["SOCIAL_ENGINEERING"])
        self.assertFalse(r["safe"])
        self.assertIn("google_safe_browsing", r["flagged_by"])

    def test_the_bar_is_configurable(self):
        self.assertFalse(self._scan(1, minimum=1)["safe"])


class JA4BlocklistTest(TestCase):
    """JA4 mirrors JA3: active rows rebuild the ja4:blocklist Redis set the
    engine checks for the known_bad_ja4 signal."""

    def test_sync_pushes_active_rows(self):
        from apps.intelligence.models import JA4Block, sync_ja4_to_redis, JA4_REDIS_SET
        from apps.intelligence.service import _r
        JA4Block.objects.create(ja4="t13d1516h2_8daaf6152771_b186095e22b6", label="curl")
        JA4Block.objects.create(ja4="t13d1516h2_deadbeef0000_cafebabe1111", active=False)
        n = sync_ja4_to_redis()
        self.assertEqual(n, 1)  # only the active row
        r = _r()
        self.assertTrue(r.sismember(JA4_REDIS_SET, "t13d1516h2_8daaf6152771_b186095e22b6"))
        self.assertFalse(r.sismember(JA4_REDIS_SET, "t13d1516h2_deadbeef0000_cafebabe1111"))


from django.test import TestCase as _DjangoTestCase
from django.core import mail as _mail


class BotCheckLeadTest(_DjangoTestCase):
    """The lead endpoint is the funnel's turnstile: a valid email becomes a
    stored lead and gets the report; junk is rejected without a row."""

    def _post(self, **body):
        from django.test import Client
        return Client().post("/api/v1/bot-check/lead/", data=body,
                             content_type="application/json")

    def test_valid_lead_is_stored_and_emailed(self):
        from apps.intelligence.models import BotCheckLead
        r = self._post(email="buyer@shop.example", url="https://shop.example",
                       grade="D", exposure=72)
        self.assertEqual(r.status_code, 200)
        lead = BotCheckLead.objects.get(email="buyer@shop.example")
        self.assertEqual(lead.url, "https://shop.example")
        self.assertEqual(lead.grade, "D")
        self.assertEqual(len(_mail.outbox), 1)
        self.assertIn("shop.example", _mail.outbox[0].subject)

    def test_bad_email_is_rejected_without_a_row(self):
        from apps.intelligence.models import BotCheckLead
        r = self._post(email="not-an-email", url="https://shop.example")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(BotCheckLead.objects.count(), 0)

    def test_missing_url_is_rejected(self):
        r = self._post(email="buyer@shop.example", url="")
        self.assertEqual(r.status_code, 400)


from datetime import timedelta as _td
from django.utils import timezone as _tz
from django.core.management import call_command as _call


class BotCheckFollowupTest(_DjangoTestCase):
    """The 48h follow-up must reach due leads exactly once, carry HTML, and
    never chase a lead that already converted."""

    def _lead(self, age_hours=None, **kw):
        from apps.intelligence.models import BotCheckLead
        f = dict(email="p@shop.example", url="https://shop.example", grade="D", exposure=72)
        f.update(kw)
        lead = BotCheckLead.objects.create(**f)
        # created_at is auto_now_add; backdate it for age-based tests.
        if age_hours is not None:
            BotCheckLead.objects.filter(pk=lead.pk).update(
                created_at=_tz.now() - _td(hours=age_hours))
            lead.refresh_from_db()
        return lead

    def test_due_lead_gets_one_html_email_and_is_stamped(self):
        lead = self._lead(age_hours=49)
        _call("send_botcheck_followups")
        self.assertEqual(len(_mail.outbox), 1)
        m = _mail.outbox[0]
        self.assertIn("shop.example", m.subject)
        html = dict(m.alternatives)  # {content: mimetype} -> invert below
        self.assertTrue(any(mt == "text/html" for _, mt in m.alternatives))
        body_html = next(c for c, mt in m.alternatives if mt == "text/html")
        self.assertIn("shop.example", body_html)
        self.assertIn("/signup", body_html)
        lead.refresh_from_db()
        self.assertIsNotNone(lead.followup_sent_at)

    def test_a_lead_younger_than_48h_is_not_emailed(self):
        self._lead(age_hours=10)
        _call("send_botcheck_followups")
        self.assertEqual(len(_mail.outbox), 0)

    def test_it_never_emails_the_same_lead_twice(self):
        self._lead(age_hours=49)
        _call("send_botcheck_followups")
        _call("send_botcheck_followups")  # second run
        self.assertEqual(len(_mail.outbox), 1)

    def test_converted_leads_are_skipped(self):
        self._lead(age_hours=49, converted=True)
        _call("send_botcheck_followups")
        self.assertEqual(len(_mail.outbox), 0)


class UnsubscribeTest(TestCase):
    """The opt-out is the part with legal teeth (CASL, Spam Act 2003,
    CAN-SPAM): it has to work from a bare email click, survive a forged token,
    and actually stop the next send."""

    def _lead(self, email="prospect@example.com", **kw):
        from apps.intelligence.models import BotCheckLead
        return BotCheckLead.objects.create(email=email, url="acme.co", grade="D",
                                           exposure=71, **kw)

    def test_link_opts_the_lead_out(self):
        from apps.intelligence.unsubscribe import make_token
        lead = self._lead()
        res = self.client.get("/api/v1/unsubscribe/", {"t": make_token(lead)})
        self.assertEqual(res.status_code, 200)
        self.assertIn(b"unsubscribed", res.content.lower())
        lead.refresh_from_db()
        self.assertIsNotNone(lead.unsubscribed_at)

    def test_one_click_post_works(self):
        """Gmail and Yahoo POST to List-Unsubscribe rather than following it."""
        from apps.intelligence.unsubscribe import make_token
        lead = self._lead()
        res = self.client.post(f"/api/v1/unsubscribe/?t={make_token(lead)}")
        self.assertEqual(res.status_code, 200)
        lead.refresh_from_db()
        self.assertIsNotNone(lead.unsubscribed_at)

    def test_forged_token_changes_nothing(self):
        lead = self._lead()
        res = self.client.get("/api/v1/unsubscribe/", {"t": "not-a-real-token"})
        self.assertEqual(res.status_code, 400)
        lead.refresh_from_db()
        self.assertIsNone(lead.unsubscribed_at)

    def test_opt_out_covers_every_row_for_that_address(self):
        """Scanning twice makes two leads. Opting out of one has to silence both."""
        from apps.intelligence.unsubscribe import make_token
        first, second = self._lead(), self._lead()
        self.client.get("/api/v1/unsubscribe/", {"t": make_token(first)})
        second.refresh_from_db()
        self.assertIsNotNone(second.unsubscribed_at)

    def test_followup_skips_opted_out_leads(self):
        from datetime import timedelta
        from io import StringIO
        from django.core import mail
        from django.core.management import call_command
        from django.utils import timezone
        from apps.intelligence.models import BotCheckLead

        stale = timezone.now() - timedelta(hours=72)
        opted_out = self._lead("gone@example.com", unsubscribed_at=timezone.now())
        still_in = self._lead("here@example.com")
        BotCheckLead.objects.update(created_at=stale)

        call_command("send_botcheck_followups", stdout=StringIO(), stderr=StringIO())
        recipients = [addr for m in mail.outbox for addr in m.to]
        self.assertIn(still_in.email, recipients)
        self.assertNotIn(opted_out.email, recipients)

    def test_followup_carries_one_click_headers(self):
        from datetime import timedelta
        from io import StringIO
        from django.core import mail
        from django.core.management import call_command
        from django.utils import timezone
        from apps.intelligence.models import BotCheckLead

        self._lead("here@example.com")
        BotCheckLead.objects.update(created_at=timezone.now() - timedelta(hours=72))
        call_command("send_botcheck_followups", stdout=StringIO(), stderr=StringIO())
        self.assertEqual(len(mail.outbox), 1)
        headers = mail.outbox[0].extra_headers
        self.assertIn("List-Unsubscribe", headers)
        self.assertEqual(headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click")
