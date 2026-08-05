import time
import jwt
from django.conf import settings as django_settings
from django.test import TestCase, Client

from tickets.models import Usuario, Cuenta, Ticket
from tickets.mixins import cuentas_visibles, tickets_visibles
from tickets.grancrm_session import INCITRACK_APP_ID

def _auth_client(user):
    token = jwt.encode({
        "user_id": user.pk,
        "email": user.email,
        "nombre": user.nombre,
        "rol": user.rol,
        "apps": [INCITRACK_APP_ID],
        "jti": f"jti-{user.pk}-{int(time.time())}",
        "exp": int(time.time()) + 3600,
        "iat": int(time.time()) - 3600,
    }, django_settings.GRANCRM_JWT_SECRET, algorithm="HS256")
    client = Client()
    client.force_login(user, backend="django.contrib.auth.backends.ModelBackend")
    client.cookies["grancrm_session"] = token
    return client

class VisibilityTest(TestCase):
    def setUp(self):
        self.cuenta_a = Cuenta.objects.create(nombre="Cuenta A")
        self.cuenta_b = Cuenta.objects.create(nombre="Cuenta B")
        self.cuenta_c = Cuenta.objects.create(nombre="Cuenta C")

        self.supervisor = Usuario.objects.create(email="sup@test.com", username="sup@test.com", rol="supervisor")
        self.cuenta_a.supervisores.add(self.supervisor)
        self.cuenta_b.supervisores.add(self.supervisor)

        self.supervisor_empty = Usuario.objects.create(email="sup_empty@test.com", username="sup_empty@test.com", rol="supervisor")

        self.jefe = Usuario.objects.create(email="jefe@test.com", username="jefe@test.com", rol="jefe")
        self.cuenta_c.jefe = self.jefe
        self.cuenta_c.save()
        # Jefe test will use a separate supervisor
        self.supervisor_jefe = Usuario.objects.create(email="supjefe@test.com", username="supjefe@test.com", rol="supervisor")
        self.cuenta_c.supervisores.add(self.supervisor_jefe)
        self.cuenta_x = Cuenta.objects.create(nombre="Cuenta X")
        self.cuenta_x.supervisores.add(self.supervisor_jefe)

        self.admin = Usuario.objects.create(email="admin@test.com", username="admin@test.com", rol="admin")

        self.ticket_a = Ticket.objects.create(titulo="Ticket A", descripcion="A", cuenta=self.cuenta_a, creado_por=self.admin)
        self.ticket_b = Ticket.objects.create(titulo="Ticket B", descripcion="B", cuenta=self.cuenta_b, creado_por=self.admin)
        self.ticket_c = Ticket.objects.create(titulo="Ticket C", descripcion="C", cuenta=self.cuenta_c, creado_por=self.admin)

    def test_supervisor_sees_only_assigned_cuentas(self):
        cuentas = cuentas_visibles(self.supervisor)
        self.assertEqual(cuentas.count(), 2)
        self.assertIn(self.cuenta_a, cuentas)
        self.assertIn(self.cuenta_b, cuentas)
        self.assertNotIn(self.cuenta_c, cuentas)

    def test_supervisor_no_cuentas_sees_empty(self):
        cuentas = cuentas_visibles(self.supervisor_empty)
        self.assertEqual(cuentas.count(), 0)

    def test_admin_sees_all_cuentas(self):
        cuentas = cuentas_visibles(self.admin)
        self.assertEqual(cuentas.count(), Cuenta.objects.count())

    def test_jefe_sees_direct_plus_supervisor_cuentas(self):
        cuentas = cuentas_visibles(self.jefe)
        self.assertEqual(cuentas.count(), 2)
        self.assertIn(self.cuenta_c, cuentas)
        self.assertIn(self.cuenta_x, cuentas)
        self.assertNotIn(self.cuenta_a, cuentas)

    def test_supervisor_lookup_cuentas_api_filtered(self):
        client = _auth_client(self.supervisor)
        res = client.get("/incitrack/api/v1/lookups/cuentas/")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data), 2)
        nombres = [c["nombre"] for c in data]
        self.assertIn("Cuenta A", nombres)
        self.assertIn("Cuenta B", nombres)
        self.assertNotIn("Cuenta C", nombres)

    def test_supervisor_tickets_filtered_by_cuenta(self):
        client = _auth_client(self.supervisor)
        res = client.get("/incitrack/api/v1/tickets/")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data), 2)
        titulos = [t["titulo"] for t in data]
        self.assertIn("Ticket A", titulos)
        self.assertIn("Ticket B", titulos)
        self.assertNotIn("Ticket C", titulos)

    def test_supervisor_cannot_create_ticket_in_other_cuenta(self):
        cuenta_y = Cuenta.objects.create(nombre="Cuenta Y")
        client = _auth_client(self.supervisor)
        payload = {
            "titulo": "New",
            "descripcion": "Desc",
            "prioridad": "media",
            "cuenta_id": cuenta_y.pk,  # Not assigned
        }
        res = client.post("/incitrack/api/v1/tickets/", data=payload, content_type="application/json")
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.json()["detail"], "Sin acceso a esta cuenta")
