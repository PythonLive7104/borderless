from django.urls import path

from .views import (AdminTestimonialDetailView, AdminTestimonialListView,
                    MyTestimonialView, PublishedTestimonialsView)

urlpatterns = [
    path("", PublishedTestimonialsView.as_view(), name="testimonials-public"),
    path("mine/", MyTestimonialView.as_view(), name="testimonial-mine"),
    path("admin/", AdminTestimonialListView.as_view(), name="testimonial-admin-list"),
    path("admin/<int:pk>/", AdminTestimonialDetailView.as_view(), name="testimonial-admin-detail"),
]
