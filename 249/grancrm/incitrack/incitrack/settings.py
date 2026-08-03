"""
InciTrack Módulo — settings.py
Basado en el original de .245, adaptado para:
  - SQL Server 2019 (en lugar de PostgreSQL)
  - Prefijo /incitrack/ para login/redirect (módulo dentro de GranCRM)
"""
import os
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'django-insecure-cambia-esto-en-produccion-usa-una-clave-segura')

DEBUG = os.environ.get('DEBUG', 'False') == 'True'

ALLOWED_HOSTS = ['*']

# ─── APPS ────────────────────────────────────────────────────────────────────
INSTALLED_APPS = [
    #'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'tickets.apps.TicketsConfig',
    'ninja',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'grancrm_auth.middleware.GranCRMAuthMiddleware',
    'tickets.grancrm_session.GranCRMSessionMiddleware',
    'utils.tenant_middleware.TenantDatabaseMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'incitrack.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'incitrack.wsgi.application'

# ─── BASE DE DATOS — SQL Server 2019 ─────────────────────────────────────────
# Reemplaza PostgreSQL del original (.245)
DATABASES = {
    'default': {
        'ENGINE': 'mssql',
        'NAME':     os.environ.get('DB_NAME', 'InciTrack'),
        'USER':     os.environ.get('DB_USER', 'sa'),
        'PASSWORD': os.environ.get('DB_PASSWORD', ''),
        'HOST':     os.environ.get('DB_HOST', '172.20.21.50'),
        'PORT':     os.environ.get('DB_PORT', '1433'),
        'OPTIONS': {
            'driver': 'ODBC Driver 18 for SQL Server',
            'extra_params': 'TrustServerCertificate=yes',
        },
    }
}

# ─── AUTH ─────────────────────────────────────────────────────────────────────
DATABASE_ROUTERS = ['utils.tenant_router.TenantDatabaseRouter']

AUTH_USER_MODEL = 'tickets.Usuario'
# Prefijo /incitrack/ porque vive como módulo dentro de GranCRM
# LOGIN_URL  # definido abajo via SSO
LOGIN_REDIRECT_URL = '/incitrack/'
LOGOUT_REDIRECT_URL = '/incitrack/login/'  # reemplazado abajo en bloque SSO

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ─── INTERNACIONALIZACIÓN ────────────────────────────────────────────────────
LANGUAGE_CODE = 'es-cl'
TIME_ZONE     = 'America/Santiago'
USE_I18N      = True
USE_TZ        = True

# ─── ARCHIVOS ESTÁTICOS Y MEDIA ───────────────────────────────────────────────
# Assets Duralux los sirve Nginx desde /assets/ — Django no los toca
STATIC_URL  = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL  = '/incitrack/media/'
MEDIA_ROOT = BASE_DIR / 'media'

MAX_ADJUNTOS_POR_TICKET = 3
MAX_UPLOAD_SIZE_MB      = 10

# ─── EMAIL ────────────────────────────────────────────────────────────────────
EMAIL_BACKEND       = os.environ.get('EMAIL_BACKEND', 'django.core.mail.backends.smtp.EmailBackend')
EMAIL_HOST          = os.environ.get('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT          = int(os.environ.get('EMAIL_PORT', '587'))
EMAIL_USE_TLS       = os.environ.get('EMAIL_USE_TLS', 'True') == 'True'
EMAIL_HOST_USER     = os.environ.get('EMAIL_HOST_USER', 'noreply@in-touchcrm.cl')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL  = os.environ.get('DEFAULT_FROM_EMAIL', 'InciTrack <noreply@in-touchcrm.cl>')
EMAIL_TIMEOUT       = 10

# ─── CSRF / HTTPS detras del gateway nginx ───────────────────────────────────
# NO activar SECURE_SSL_REDIRECT: el redirect 80->443 lo hace nginx (evita bucle).
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True
SESSION_COOKIE_SECURE = os.environ.get('SESSION_COOKIE_SECURE', 'true').lower() == 'true'
CSRF_COOKIE_SECURE = os.environ.get('CSRF_COOKIE_SECURE', 'true').lower() == 'true'
SESSION_COOKIE_SAMESITE = 'Lax'
# IP (pruebas directas) + DOMINIO_PENDIENTE (Cloudflare). Reemplazar el dominio
# al publicarlo. Se conservan los origenes http legacy de los dashboards .248/.249.
CSRF_TRUSTED_ORIGINS = [
    'https://172.20.21.248',
    'https://DOMINIO_PENDIENTE',
    'http://172.20.21.248',
    'http://172.20.21.248:3002',
    'http://172.20.21.249',
    'http://172.20.21.249:3002',
]

# ─── LOGGING ─────────────────────────────────────────────────────────────────
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {'class': 'logging.StreamHandler', 'formatter': 'verbose'},
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'tickets': {
            'handlers': ['console'],
            'level': 'DEBUG' if DEBUG else 'INFO',
            'propagate': False,
        },
    },
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
LOGGING['loggers']['django.db.backends'] = {
    'handlers': ['console'],
    'level': 'DEBUG',
    'propagate': False,
}
# Deshabilitar chequeo de permisos por contenttypes
AUTHENTICATION_BACKENDS = ['tickets.backends.EmailBackend', 'django.contrib.auth.backends.ModelBackend']

# ─── SSO GRANCRM ─────────────────────────────────────────────────────────────
GRANCRM_JWT_SECRET        = os.environ.get('GRANCRM_JWT_SECRET', '')
GRANCRM_ORCHESTRATOR_URL  = os.environ.get('GRANCRM_ORCHESTRATOR_URL', 'http://172.20.21.248:9000')
GRANCRM_COOKIE_DOMAIN     = os.environ.get('GRANCRM_COOKIE_DOMAIN', None)
GRANCRM_APP_ID            = int(os.environ.get('GRANCRM_APP_ID', 4))

LOGIN_URL          = GRANCRM_ORCHESTRATOR_URL + '/login/'
LOGOUT_REDIRECT_URL = GRANCRM_ORCHESTRATOR_URL + '/logout-redirect/'
