from django.urls import path
from .views import (
    RegisterView, MeView, ForgotPasswordView, ResetPasswordView, VerifyEmailView, ChangePasswordView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("me/", MeView.as_view(), name="me"),
    path("password/forgot/", ForgotPasswordView.as_view(), name="password_forgot"),
    path("password/reset/", ResetPasswordView.as_view(), name="password_reset"),
    path("email/verify/", VerifyEmailView.as_view(), name="email_verify"),
    path("password/change/", ChangePasswordView.as_view(), name="password_change"),
]
