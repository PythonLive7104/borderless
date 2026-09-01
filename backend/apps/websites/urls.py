from rest_framework.routers import DefaultRouter
from .views import WebsiteViewSet

router = DefaultRouter()
router.register("", WebsiteViewSet, basename="website")
urlpatterns = router.urls
