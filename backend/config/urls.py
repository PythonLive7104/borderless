from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from apps.integrations.views import PublicConversionView
from apps.intelligence.views import BotCheckView, BotCheckLeadView
from apps.links.views import AbuseReportView, TLSAllowedView

urlpatterns = [
    # Django admin lives off the default /admin path so the React dashboard
    # admin can own /admin/* (and to keep the default path off bots' radar).
    path("django-admin/", admin.site.urls),
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/organizations/", include("apps.organizations.urls")),
    path("api/websites/", include("apps.websites.urls")),
    path("api/campaigns/", include("apps.campaigns.urls")),
    path("api/rules/", include("apps.rules.urls")),
    path("api/analytics/", include("apps.analytics.urls")),
    path("api/integrations/", include("apps.integrations.urls")),
    path("api/billing/", include("apps.billing.urls")),
    path("api/admin/", include("apps.staff.urls")),
    path("api/links/", include("apps.links.urls")),
    path("api/v1/conversions/", PublicConversionView.as_view()),
    path("api/v1/bot-check/", BotCheckView.as_view()),
    path("api/v1/bot-check/lead/", BotCheckLeadView.as_view()),
    path("api/v1/abuse/", AbuseReportView.as_view()),
    path("api/v1/tls-allowed/", TLSAllowedView.as_view()),  # on-demand TLS ask (Caddy)
    path("api/telegram/", include("apps.telegrambot.urls")),
]
