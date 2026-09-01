from django.urls import path
from .views import (
    RegisterView, MeView, ForgotPasswordView, ResetPasswordView, VerifyEmailView, ChangePasswordView,
    ResendVerificationView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("me/", MeView.as_view(), name="me"),
    path("password/forgot/", ForgotPasswordView.as_view(), name="password_forgot"),
    path("password/reset/", ResetPasswordView.as_view(), name="password_reset"),
    path("email/verify/", VerifyEmailView.as_view(), name="email_verify"),
    path("email/resend/", ResendVerificationView.as_view(), name="email_resend"),
    path("password/change/", ChangePasswordView.as_view(), name="password_change"),
]
