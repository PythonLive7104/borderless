from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from rest_framework import generics, permissions, status, views
from rest_framework.response import Response

from .models import EmailVerification, PasswordReset
from .serializers import RegisterSerializer, UserSerializer

User = get_user_model()


def _email_html(title, message, button_url=None, button_label=None):
    brand = settings.BRAND_NAME
    btn = ""
    if button_url:
        btn = (f'<tr><td style="padding:4px 0 24px">'
               f'<a href="{button_url}" style="display:inline-block;background:#2563eb;color:#ffffff;'
               f'text-decoration:none;font-weight:600;padding:12px 26px;border-radius:8px">'
               f'{button_label or "Open"}</a></td></tr>')
    return (
        '<!doctype html><html><body style="margin:0;background:#f4f6fb;'
        'font-family:Arial,Helvetica,sans-serif;color:#0f172a">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0">'
        '<tr><td align="center">'
        '<table role="presentation" cellpadding="0" cellspacing="0" width="480" '
        'style="background:#ffffff;border-radius:14px;padding:32px;max-width:480px;text-align:left">'
        f'<tr><td style="font-weight:800;font-size:18px;color:#2563eb;padding-bottom:18px">{brand}</td></tr>'
        f'<tr><td style="font-size:20px;font-weight:700;padding-bottom:10px">{title}</td></tr>'
        f'<tr><td style="font-size:15px;line-height:1.6;color:#334155;padding-bottom:18px">{message}</td></tr>'
        f'{btn}'
        '<tr><td style="font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:16px">'
        f'You received this email because it was used to create or manage a {brand} account. '
        'If this wasn\'t you, you can safely ignore it.</td></tr>'
        '</table></td></tr></table></body></html>'
    )


def _send(subject, message, to, button_url=None, button_label=None):
    """Send a branded HTML email (with a plain-text fallback) via the configured backend."""
    from django.core.mail import EmailMultiAlternatives
    text = message + (f"\n\n{button_label or 'Open'}: {button_url}" if button_url else "")
    msg = EmailMultiAlternatives(subject, text, settings.DEFAULT_FROM_EMAIL, [to])
    msg.attach_alternative(_email_html(subject, message, button_url, button_label), "text/html")
    msg.send(fail_silently=True)


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def perform_create(self, serializer):
        user = serializer.save()
        # give every new user a personal workspace they own
        from apps.organizations.models import create_workspace
        ws_name = (user.first_name and f"{user.first_name}'s Workspace") or "My Workspace"
        create_workspace(user, ws_name)
        ev = EmailVerification.objects.create(user=user)
        _send(
            f"Confirm your {settings.BRAND_NAME} email",
            "Welcome! Please confirm your email address to activate your account.",
            user.email,
            f"{settings.FRONTEND_URL}/verify-email?token={ev.token}",
            "Confirm email",
        )


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        user = self.request.user
        # Safety net: guarantee every account has a workspace (superusers created
        # via createsuperuser, or edge cases, would otherwise have none and the
        # dashboard would spin forever).
        from apps.organizations.models import OrganizationMember, create_workspace
        if not OrganizationMember.objects.filter(user=user).exists():
            create_workspace(user, (user.first_name or "My") + " Workspace")
        return user


class ChangePasswordView(views.APIView):
    def post(self, request):
        current = request.data.get("current_password") or ""
        new = request.data.get("new_password") or ""
        if not request.user.check_password(current):
            return Response({"detail": "Your current password is incorrect."}, status=status.HTTP_400_BAD_REQUEST)
        if len(new) < 8:
            return Response({"detail": "New password must be at least 8 characters."}, status=status.HTTP_400_BAD_REQUEST)
        request.user.set_password(new)
        request.user.save(update_fields=["password"])
        return Response({"detail": "Password updated."})


class ForgotPasswordView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = (request.data.get("email") or "").lower()
        user = User.objects.filter(email__iexact=email).first()
        if user:  # silent when not found — never reveal account existence
            pr = PasswordReset.objects.create(user=user)
            _send(
                f"Reset your {settings.BRAND_NAME} password",
                "We received a request to reset your password. Use the button below to choose a new one. This link will expire soon.",
                user.email,
                f"{settings.FRONTEND_URL}/reset-password/{pr.token}",
                "Reset password",
            )
        return Response({"detail": "If the account exists, a reset link has been sent."})


class ResetPasswordView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        token = request.data.get("token")
        password = request.data.get("password") or ""
        pr = PasswordReset.objects.filter(token=token).first()
        if not pr or not pr.is_valid():
            return Response({"detail": "This reset link is invalid or has expired."},
                            status=status.HTTP_400_BAD_REQUEST)
        if len(password) < 8:
            return Response({"detail": "Password must be at least 8 characters."},
                            status=status.HTTP_400_BAD_REQUEST)
        user = pr.user
        user.set_password(password)
        user.save(update_fields=["password"])
        pr.used_at = timezone.now()
        pr.save(update_fields=["used_at"])
        return Response({"detail": "Password updated."})


class VerifyEmailView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        token = request.data.get("token")
        ev = EmailVerification.objects.filter(token=token).first()
        if not ev or not ev.is_valid():
            return Response({"detail": "This verification link is invalid or has expired."},
                            status=status.HTTP_400_BAD_REQUEST)
        user = ev.user
        user.is_verified = True
        user.save(update_fields=["is_verified"])
        ev.used_at = timezone.now()
        ev.save(update_fields=["used_at"])
        return Response({"detail": "Email verified."})


class ResendVerificationView(views.APIView):
    """Re-send the email-verification link to the signed-in user."""

    def post(self, request):
        user = request.user
        if user.is_verified:
            return Response({"detail": "Your email is already verified."})
        ev = EmailVerification.objects.create(user=user)
        _send(
            f"Confirm your {settings.BRAND_NAME} email",
            "Welcome! Please confirm your email address to activate your account.",
            user.email,
            f"{settings.FRONTEND_URL}/verify-email?token={ev.token}",
            "Confirm email",
        )
        return Response({"detail": "Verification email sent. Check your inbox."})
