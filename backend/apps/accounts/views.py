from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from rest_framework import generics, permissions, status, views
from rest_framework.response import Response

from .models import EmailVerification, PasswordReset
from .serializers import RegisterSerializer, UserSerializer

User = get_user_model()
def _send(subject, body, to):
    # Dev uses the console email backend; swap SMTP creds in settings for prod.
    send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [to], fail_silently=True)


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
        _send("Verify your Borderless email",
              f"Confirm your email: {settings.FRONTEND_URL}/verify-email?token={ev.token}",
              user.email)


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


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
            _send("Reset your Borderless password",
                  f"Reset your password: {settings.FRONTEND_URL}/reset-password/{pr.token}",
                  user.email)
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
