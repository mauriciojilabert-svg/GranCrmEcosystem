"""
Test settings for InciTrack — uses SQLite in-memory so no SQL Server needed.
Usage: python manage.py test --settings=incitrack.test_settings
"""
from .settings import *  # noqa: F401, F403

# Override DB to SQLite for tests
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

# Disable tenant router for tests (no multi-tenant needed)
DATABASE_ROUTERS = []

# Use a fixed test JWT secret
GRANCRM_JWT_SECRET = 'test-secret-for-unit-tests'

# Speed up password hashing in tests
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.MD5PasswordHasher',
]

# Disable email sending in tests
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'

# Don't require HTTPS in tests
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
