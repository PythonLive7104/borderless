from django.urls import path

from .health import StatusView
from .views import ContactView

urlpatterns = [
    path("contact/", ContactView.as_view(), name="contact"),
    path("status/", StatusView.as_view(), name="status"),
]
