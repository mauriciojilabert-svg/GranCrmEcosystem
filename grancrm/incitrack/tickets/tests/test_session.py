import time
import jwt
from django.conf import settings as django_settings
from django.test import TestCase, RequestFactory
from django.contrib.sessions.middleware import SessionMiddleware
from django.contrib.auth import get_user_model

from tickets.models import Usuario
from tickets.grancrm_session import GranCRMSessionMiddleware, INCITRACK_APP_ID

User = get_user_model()

def _make_jwt(extra=None):
    secret = django_settings.GRANCRM_JWT_SECRET
    now = int(time.time())
    payload = {
        "user_id": 1,
        "email": "test@example.com",
        "nombre": "Test User",
        "tenant_id": "test-tenant",
        "db_name": None,
        "rol": "supervisor",
        "apps": [INCITRACK_APP_ID],
        "jti": "test-jti",
        "exp": now + 3600 * 8,
        "iat": now - 3600,
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, secret, algorithm="HS256")

class SessionMiddlewareTest(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.get_response = lambda request: request  # Dummy response
        self.middleware = GranCRMSessionMiddleware(self.get_response)

        self.user_a = Usuario.objects.create(email="userA@example.com", username="userA@example.com", rol="supervisor")
        self.user_b = Usuario.objects.create(email="userB@example.com", username="userB@example.com", rol="supervisor")

    def _add_session(self, request):
        """Helper to add session to a request."""
        middleware = SessionMiddleware(self.get_response)
        middleware.process_request(request)
        request.session.save()

    def test_jwt_email_mismatch_triggers_resync(self):
        """
        If the session has userA logged in, but the JWT cookie has userB's email,
        the middleware should resync and log in userB.
        """
        request = self.factory.get("/")
        self._add_session(request)
        
        # Log in userA in the Django session
        from django.contrib.auth import login
        login(request, self.user_a, backend="django.contrib.auth.backends.ModelBackend")
        
        # Verify userA is initially logged in
        self.assertEqual(request.user, self.user_a)

        # Create a JWT for userB
        token_b = _make_jwt({"email": self.user_b.email, "nombre": "User B"})
        request.COOKIES["grancrm_session"] = token_b

        # Process request through middleware
        self.middleware(request)

        # Verify userB is now logged in
        self.assertEqual(request.user, self.user_b)
        self.assertTrue(request.session.get("_grancrm_synced"))

    def test_sync_sets_correct_role_from_jwt(self):
        token = _make_jwt({"email": "newadmin@example.com", "rol": "admin"})
        request = self.factory.get("/")
        self._add_session(request)
        request.COOKIES["grancrm_session"] = token

        self.middleware(request)

        user = request.user
        self.assertTrue(user.is_authenticated)
        self.assertEqual(user.email, "newadmin@example.com")
        self.assertEqual(user.rol, "admin")
        self.assertTrue(user.es_admin)

    def test_sync_creates_new_user_on_first_login(self):
        email = "newuser@example.com"
        self.assertFalse(Usuario.objects.filter(email=email).exists())

        token = _make_jwt({"email": email, "nombre": "New User", "rol": "admin_cuenta"})
        request = self.factory.get("/")
        self._add_session(request)
        request.COOKIES["grancrm_session"] = token

        self.middleware(request)

        user = Usuario.objects.get(email=email)
        self.assertEqual(user.nombre, "New User")
        self.assertEqual(user.rol, "jefe")
        self.assertEqual(request.user, user)

    def test_invalid_token_returns_401_on_api_path(self):
        request = self.factory.get("/incitrack/api/v1/tickets/")
        self._add_session(request)
        request.COOKIES["grancrm_session"] = "invalid.token"

        response = self.middleware(request)
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response["Content-Type"], "application/json")

    def test_invalid_token_returns_302_on_non_api_path(self):
        request = self.factory.get("/incitrack/tickets/")
        self._add_session(request)
        request.COOKIES["grancrm_session"] = "invalid.token"

        response = self.middleware(request)
        self.assertEqual(response.status_code, 302)
        self.assertTrue(response.url.startswith(django_settings.LOGIN_URL))

    def test_agente_role_blocked(self):
        token = _make_jwt({"email": "agente@example.com", "rol": "agente"})
        request = self.factory.get("/incitrack/api/v1/tickets/")
        self._add_session(request)
        request.COOKIES["grancrm_session"] = token

        response = self.middleware(request)
        self.assertEqual(response.status_code, 403)
