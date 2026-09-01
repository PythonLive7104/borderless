from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import CampaignViewSet, CampaignVariantViewSet
from .public import VariantAssignView

router = DefaultRouter()
# register variants first so /variants/ isn't captured as a campaign pk
router.register("variants", CampaignVariantViewSet, basename="campaign-variant")
router.register("", CampaignViewSet, basename="campaign")

urlpatterns = [
    path("<int:campaign_id>/assign/", VariantAssignView.as_view(), name="variant-assign"),
] + router.urls
