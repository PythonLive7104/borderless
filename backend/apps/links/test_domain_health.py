from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from apps.links.models import ShortDomain


def _run(**kw):
    out = StringIO()
    call_command("check_domain_health", stdout=out, stderr=out, **kw)
    return out.getvalue()


class DomainHealthTest(TestCase):
    def setUp(self):
        self.d = ShortDomain.objects.create(host="korv.cc", active=True,
                                            verified_at=timezone.now())

    def test_a_healthy_domain_is_recorded_as_ok(self):
        with patch("apps.links.management.commands.check_domain_health._resolves",
                   return_value=(True, "")), \
             patch("apps.links.management.commands.check_domain_health._serves",
                   return_value=(True, "HTTP 200")):
            _run(skip_scan=True)
        self.d.refresh_from_db()
        self.assertEqual(self.d.health, ShortDomain.Health.OK)
        self.assertIsNotNone(self.d.health_checked_at)

    def test_a_suspended_domain_shows_as_unreachable(self):
        # A registrar suspension looks exactly like this from outside: NXDOMAIN.
        with patch("apps.links.management.commands.check_domain_health._resolves",
                   return_value=(False, "DNS did not resolve (NXDOMAIN)")):
            out = _run(skip_scan=True)
        self.d.refresh_from_db()
        self.assertEqual(self.d.health, ShortDomain.Health.UNREACHABLE)
        self.assertIn("NXDOMAIN", self.d.health_detail)
        self.assertIn("korv.cc", out)

    def test_a_blacklisted_domain_resolves_but_is_flagged(self):
        with patch("apps.links.management.commands.check_domain_health._resolves",
                   return_value=(True, "")), \
             patch("apps.links.management.commands.check_domain_health._serves",
                   return_value=(True, "HTTP 200")), \
             patch("apps.intelligence.threatscan.is_enabled", return_value=True), \
             patch("apps.intelligence.threatscan.scan_url",
                   return_value={"safe": False, "flagged_by": ["google_safe_browsing"],
                                 "threats": ["SOCIAL_ENGINEERING"], "checked": True}):
            _run()
        self.d.refresh_from_db()
        self.assertEqual(self.d.health, ShortDomain.Health.FLAGGED)
        self.assertIn("google_safe_browsing", self.d.health_detail)

    def test_notify_emails_only_about_unhealthy_domains(self):
        from django.core import mail
        ShortDomain.objects.create(host="fine.cc", active=True, verified_at=timezone.now())

        def resolves(host):
            return (False, "DNS did not resolve (NXDOMAIN)") if host == "korv.cc" else (True, "")

        with self.settings(ABUSE_NOTIFY_EMAIL="ops@example.com"), \
             patch("apps.links.management.commands.check_domain_health._resolves",
                   side_effect=resolves), \
             patch("apps.links.management.commands.check_domain_health._serves",
                   return_value=(True, "HTTP 200")):
            _run(skip_scan=True, notify=True)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("korv.cc", mail.outbox[0].body)
        self.assertNotIn("fine.cc", mail.outbox[0].body)

    def test_a_retired_domain_is_not_checked(self):
        # Scoped with --host because migration 0010 seeds a domain from
        # SHORT_DOMAIN, so the unscoped queryset is never empty in tests.
        self.d.active = False
        self.d.save(update_fields=["active"])
        with patch("apps.links.management.commands.check_domain_health._resolves") as r:
            _run(skip_scan=True, host="korv.cc")
        r.assert_not_called()
