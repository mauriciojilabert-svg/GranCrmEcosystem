"""
InciTrack API tests — Plan 001 / Plan 004

Covers:
  1. auth: no jwt_payload → 401 (no cookie path); invalid JWT on API path → 401
     (Plan 004: GranCRMSessionMiddleware returns JSON 401 for /incitrack/api/
     paths instead of 302, so the React apiFetch can emit grancrm:sessionExpired);
     invalid JWT on non-API path → 302 (redirect to login, unchanged behavior)
  2. visibility: supervisor sees only their visible tickets, not another tenant's
  3. create: POST /tickets/ creates+returns ticket
  4. role guard: non-admin on admin endpoint → 403

Run with:
  python manage.py test tickets.tests.test_api --settings=incitrack.test_settings

Notes:
- GranCRMSessionMiddleware runs BEFORE Ninja. When a cookie is present but
  invalid on a NON-API path, it still redirects (302) to login.
  When there is NO cookie, it passes through and Ninja returns 401.
  When the cookie is invalid and the path starts with /incitrack/api/,
  the middleware returns JSON 401 (Plan 004 change).
- For authenticated API tests, we issue a valid JWT and force_login so that
  GranCRMSessionMiddleware syncs the user.
"""
import json
import time

import jwt
from django.conf import settings as django_settings
from django.test import TestCase, Client

from tickets.models import Usuario, Cuenta, Ticket, Categoria


INCITRACK_APP_ID = 4  # from grancrm_session.py


def _make_jwt(extra=None):
    """Generate a valid test JWT signed with GRANCRM_JWT_SECRET.

    Uses int(time.time()) for timestamps to avoid ImmatureSignatureError
    that occurs with datetime.utcnow().timestamp() due to float precision.
    iat is set 1 hour in the past so the token is immediately valid.
    """
    secret = django_settings.GRANCRM_JWT_SECRET
    now = int(time.time())
    payload = {
        "user_id": 1,
        "email": "test@example.com",
        "nombre": "Test User",
        "tenant_id": "test-tenant",
        "db_name": None,
        "rol": "admin",
        "apps": [INCITRACK_APP_ID],
        "jti": "test-jti",
        "exp": now + 3600 * 8,
        "iat": now - 3600,  # 1 hour ago → token is valid immediately
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, secret, algorithm="HS256")


def _auth_client(user):
    """Return a test Client force-logged in with a valid JWT cookie."""
    token = _make_jwt({
        "user_id": user.pk,
        "email": user.email,
        "nombre": user.nombre,
        "rol": "admin" if user.es_admin else ("jefe" if user.es_jefe else "ejecutivo"),
        "apps": [INCITRACK_APP_ID],
        "jti": f"jti-{user.pk}-{int(time.time())}",
    })
    client = Client()
    # Force Django session login so request.user is set after middleware
    client.force_login(user, backend="django.contrib.auth.backends.ModelBackend")
    client.cookies["grancrm_session"] = token
    return client


# ── 1. AUTH ───────────────────────────────────────────────────────────────────

class APIAuthTest(TestCase):
    """Test authentication behavior at the API boundary."""

    def test_no_cookie_returns_401_dashboard(self):
        """GET /dashboard/ with no cookie → 401 (Ninja auth guard fires)."""
        client = Client()
        response = client.get("/incitrack/api/v1/dashboard/")
        self.assertEqual(response.status_code, 401,
            f"Expected 401 without cookie, got {response.status_code}")

    def test_no_cookie_returns_401_tickets(self):
        """GET /tickets/ with no cookie → 401."""
        client = Client()
        response = client.get("/incitrack/api/v1/tickets/")
        self.assertEqual(response.status_code, 401,
            f"Expected 401 without cookie, got {response.status_code}")

    def test_invalid_jwt_cookie_on_api_path_returns_401(self):
        """An invalid JWT cookie on an /incitrack/api/ path returns 401 JSON (Plan 004).

        GranCRMSessionMiddleware detects the API path and returns a JSON 401
        instead of a 302 redirect, allowing the React apiFetch to emit
        grancrm:sessionExpired rather than failing to parse login HTML.
        """
        client = Client()
        client.cookies["grancrm_session"] = "invalid.jwt.token"
        response = client.get("/incitrack/api/v1/tickets/")
        self.assertEqual(response.status_code, 401,
            f"Expected 401 JSON for invalid JWT on API path, got {response.status_code}")
        data = response.json()
        self.assertIn("detail", data,
            "Response body should contain 'detail' key")

    def test_invalid_jwt_cookie_on_non_api_path_returns_302(self):
        """An invalid JWT cookie on a non-API path still triggers a 302 redirect.

        Non-API (template) views keep the existing redirect-to-login behavior.
        """
        client = Client()
        client.cookies["grancrm_session"] = "invalid.jwt.token"
        response = client.get("/incitrack/tickets/")
        self.assertEqual(response.status_code, 302,
            f"Expected 302 redirect for invalid JWT on non-API path, got {response.status_code}")


# ── 2. VISIBILITY ─────────────────────────────────────────────────────────────

class APIVisibilityTest(TestCase):
    """Supervisor sees only their visible tickets; other cuenta's tickets → 403."""

    def setUp(self):
        self.cuenta_a = Cuenta.objects.create(nombre="Cuenta A")
        self.cuenta_b = Cuenta.objects.create(nombre="Cuenta B")

        self.supervisor = Usuario.objects.create(
            email="supervisor@example.com",
            username="supervisor@example.com",
            nombre="Supervisor A",
            rol="supervisor",
            activo=True,
        )
        self.supervisor.set_unusable_password()
        self.supervisor.save()
        self.cuenta_a.supervisores.add(self.supervisor)

        self.admin = Usuario.objects.create(
            email="admin@example.com",
            username="admin@example.com",
            nombre="Admin User",
            rol="admin",
            activo=True,
        )
        self.admin.set_unusable_password()
        self.admin.save()

        self.cat = Categoria.objects.create(nombre="Test Cat", slug="test-cat")

        self.ticket_a = Ticket.objects.create(
            titulo="Ticket A",
            descripcion="Desc A",
            cuenta=self.cuenta_a,
            creado_por=self.supervisor,
            categoria=self.cat,
        )
        self.ticket_b = Ticket.objects.create(
            titulo="Ticket B",
            descripcion="Desc B",
            cuenta=self.cuenta_b,
            creado_por=self.admin,
            categoria=self.cat,
        )

    def test_supervisor_sees_only_own_cuenta_tickets(self):
        """Supervisor list → only their cuenta's tickets."""
        client = _auth_client(self.supervisor)
        response = client.get("/incitrack/api/v1/tickets/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        ids = [t["id"] for t in data]
        self.assertIn(self.ticket_a.id, ids,
            "Supervisor should see Ticket A (their cuenta)")
        self.assertNotIn(self.ticket_b.id, ids,
            "Supervisor should NOT see Ticket B (other cuenta)")

    def test_admin_sees_all_tickets(self):
        """Admin list with ver_todos=true → sees all tickets.

        By default (ver_todos=False), admin only sees tickets assigned to them
        (mirrors TicketListaView default behavior). With ver_todos=True, admin
        sees all tickets regardless of cuenta or assignment.
        """
        client = _auth_client(self.admin)
        response = client.get("/incitrack/api/v1/tickets/?ver_todos=true")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        ids = [t["id"] for t in data]
        self.assertIn(self.ticket_a.id, ids, "Admin should see Ticket A with ver_todos=true")
        self.assertIn(self.ticket_b.id, ids, "Admin should see Ticket B with ver_todos=true")

    def test_supervisor_cannot_access_other_tenant_ticket_detail(self):
        """Supervisor GET /tickets/{id}/ for otro cuenta → 403."""
        client = _auth_client(self.supervisor)
        response = client.get(f"/incitrack/api/v1/tickets/{self.ticket_b.id}/")
        self.assertEqual(response.status_code, 403,
            f"Supervisor should get 403 for ticket in another cuenta, got {response.status_code}")


# ── 3. CREATE ─────────────────────────────────────────────────────────────────

class APICreateTest(TestCase):
    """POST /tickets/ creates a ticket and returns 201."""

    def setUp(self):
        self.cuenta = Cuenta.objects.create(nombre="Cuenta Test")
        self.cat = Categoria.objects.create(nombre="Cat Test", slug="cat-test")

        self.admin = Usuario.objects.create(
            email="admin2@example.com",
            username="admin2@example.com",
            nombre="Admin2",
            rol="admin",
            activo=True,
        )
        self.admin.set_unusable_password()
        self.admin.save()

    def test_create_ticket_returns_201(self):
        """Valid POST → 201 with ticket data; ticket persisted in DB."""
        client = _auth_client(self.admin)
        response = client.post(
            "/incitrack/api/v1/tickets/",
            data=json.dumps({
                "titulo": "Test Ticket",
                "descripcion": "Test description",
                "prioridad": "media",
                "cuenta_id": self.cuenta.id,
                "categoria_id": self.cat.id,
            }),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201,
            f"Expected 201, got {response.status_code}: {response.content}")
        data = response.json()
        self.assertEqual(data["titulo"], "Test Ticket")
        self.assertEqual(data["estado"], "abierto")
        self.assertEqual(data["cuenta_id"], self.cuenta.id)
        self.assertTrue(
            Ticket.objects.filter(titulo="Test Ticket").exists(),
            "Ticket should be in DB after creation"
        )


# ── 4. ROLE GUARD ─────────────────────────────────────────────────────────────

class APIRoleGuardTest(TestCase):
    """Non-admin → 403 on admin-only endpoints."""

    def setUp(self):
        self.supervisor = Usuario.objects.create(
            email="sup3@example.com",
            username="sup3@example.com",
            nombre="Supervisor3",
            rol="supervisor",
            activo=True,
        )
        self.supervisor.set_unusable_password()
        self.supervisor.save()

    def test_supervisor_cannot_list_usuarios(self):
        """GET /usuarios/ as supervisor → 403."""
        client = _auth_client(self.supervisor)
        response = client.get("/incitrack/api/v1/usuarios/")
        self.assertEqual(response.status_code, 403,
            f"Expected 403 for supervisor on /usuarios/, got {response.status_code}")

    def test_supervisor_cannot_list_cuentas(self):
        """GET /cuentas/ as supervisor (not jefe) → 403."""
        client = _auth_client(self.supervisor)
        response = client.get("/incitrack/api/v1/cuentas/")
        self.assertEqual(response.status_code, 403,
            f"Expected 403 for supervisor on /cuentas/, got {response.status_code}")
