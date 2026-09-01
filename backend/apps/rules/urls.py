from rest_framework.routers import DefaultRouter
from .views import RuleViewSet, IPListEntryViewSet

router = DefaultRouter()
router.register("ip-filters", IPListEntryViewSet, basename="ip-filter")
router.register("", RuleViewSet, basename="rule")
urlpatterns = router.urls
