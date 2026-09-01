import os
import sys
from datetime import timedelta
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR.parent / ".env")

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-insecure-key")
DEBUG = os.getenv("DJANGO_DEBUG", "1") == "1"
TESTING = "test" in sys.argv  # Django forces DEBUG=False under tests; skip prod-only hardening
ALLOWED_HOSTS = os.getenv("DJANGO_ALLOWED_HOSTS", "*").split(",")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "apps.accounts",
    "apps.organizations",
    "apps.websites",
    "apps.traffic",
    "apps.campaigns",
    "apps.rules",
    "apps.integrations",
    "apps.billing",
    "apps.staff",
    "apps.analytics",
    "apps.intelligence",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {"context_processors": [
            "django.template.context_processors.request",
            "django.contrib.auth.context_processors.auth",
            "django.contrib.messages.context_processors.messages",
        ]},
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# Database: prefer a single DATABASE_URL (12-factor); fall back to POSTGRES_* vars.
def _database_from_url(url):
    from urllib.parse import urlparse, unquote
    u = urlparse(url)
    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": (u.path or "/").lstrip("/"),
        "USER": unquote(u.username or ""),
        "PASSWORD": unquote(u.password or ""),
        "HOST": u.hostname or "localhost",
        "PORT": str(u.port or 5432),
    }

_DATABASE_URL = os.getenv("DATABASE_URL")
if _DATABASE_URL:
    DATABASES = {"default": _database_from_url(_DATABASE_URL)}
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.getenv("POSTGRES_DB", "borderless"),
            "USER": os.getenv("POSTGRES_USER", "borderless"),
            "PASSWORD": os.getenv("POSTGRES_PASSWORD", "borderless"),
            "HOST": os.getenv("POSTGRES_HOST", "localhost"),
            "PORT": os.getenv("POSTGRES_PORT", "5432"),
        }
    }

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.LimitOffsetPagination",
    "PAGE_SIZE": 50,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
}

CORS_ALLOW_ALL_ORIGINS = DEBUG
# In production CORS is off by default, so list your site origins explicitly.
CORS_ALLOWED_ORIGINS = [o for o in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",") if o]
CSRF_TRUSTED_ORIGINS = [o for o in os.getenv("CSRF_TRUSTED_ORIGINS", "").split(",") if o]

# --- Production hardening (auto-enabled when DEBUG is off) ---
# Assumes TLS is terminated by the reverse proxy (nginx / Cloudflare) in front.
if not DEBUG and not TESTING:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = os.getenv("DJANGO_SSL_REDIRECT", "1") == "1"
    SECURE_HSTS_SECONDS = 31536000  # 1 year
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_CONTENT_TYPE_NOSNIFF = True

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Celery (scheduled maintenance tasks) — reuses the Redis instance.
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", REDIS_URL)
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", REDIS_URL)
CELERY_TASK_ALWAYS_EAGER = os.getenv("CELERY_TASK_ALWAYS_EAGER", "false").lower() == "true"
CELERY_BEAT_SCHEDULE_FILENAME = "/tmp/celerybeat-schedule"

# Email. Backend is chosen by whichever credentials are present, so moving to
# production is a pure .env change:
#   1. RESEND_API_KEY set  -> Resend HTTP API (our custom backend)
#   2. EMAIL_HOST set      -> classic SMTP
#   3. neither             -> dev console (prints to the backend log)
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
EMAIL_HOST = os.getenv("EMAIL_HOST", "")
if RESEND_API_KEY:
    EMAIL_BACKEND = "apps.accounts.resend_backend.ResendBackend"
elif EMAIL_HOST:
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
    EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
    EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
    EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "true").lower() == "true"
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# Resend requires a verified sender domain; onboarding@resend.dev works for tests.
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "no-reply@borderless.local")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# Payments (Bachs — bachs.io). Set these to accept live payments; when blank,
# plan changes activate instantly (dev stub). Environment is derived from the
# key prefix (sk_sandbox_ / sk_live_).
BACHS_API_KEY = os.getenv("BACHS_API_KEY", "")
BACHS_WEBHOOK_SECRET = os.getenv("BACHS_WEBHOOK_SECRET", "")

# Threat scanning (destination-URL safety). Optional; scan no-ops when unset.
GOOGLE_SAFE_BROWSING_KEY = os.getenv("GOOGLE_SAFE_BROWSING_KEY", "")
VIRUSTOTAL_KEY = os.getenv("VIRUSTOTAL_KEY", "")

TRACKER_URL = os.getenv("TRACKER_URL", "https://cdn.borderless.local/bl.js")
