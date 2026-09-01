from django.urls import path
from .views import OverviewView, VisitorListView, VisitorDetailView, EventListView, SourcesView, ConversionsView, ReportView

urlpatterns = [
    path("overview/", OverviewView.as_view(), name="overview"),
    path("visitors/", VisitorListView.as_view(), name="visitors"),
    path("visitors/<int:pk>/", VisitorDetailView.as_view(), name="visitor-detail"),
    path("events/", EventListView.as_view(), name="events"),
    path("sources/", SourcesView.as_view(), name="sources"),
    path("conversions/", ConversionsView.as_view(), name="conversions"),
    path("report/", ReportView.as_view(), name="report"),
]
