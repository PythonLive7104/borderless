from types import SimpleNamespace

from django.contrib.admin.sites import AdminSite
from django.test import RequestFactory, SimpleTestCase

from apps.billing.admin import OrganizationEmailChoiceField, SubscriptionAdmin
from apps.billing.models import Subscription


class SubscriptionAdminOrganizationLabelTest(SimpleTestCase):
    def test_organization_choice_includes_owner_email(self):
        admin_instance = SubscriptionAdmin(Subscription, AdminSite())
        request = RequestFactory().get("/admin/")
        request.user = SimpleNamespace()

        field = admin_instance.formfield_for_foreignkey(
            Subscription._meta.get_field("organization"), request)

        self.assertIsInstance(field, OrganizationEmailChoiceField)
        self.assertEqual(
            field.label_from_instance(SimpleNamespace(
                name="Acme Workspace",
                owner=SimpleNamespace(email="owner@example.com"),
            )),
            "Acme Workspace (owner@example.com)",
        )
