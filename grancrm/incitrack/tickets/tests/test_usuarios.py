import time
import jwt
from django.conf import settings as django_settings
from django.test import TestCase, Client

from tickets.models import Usuario, Cuenta
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

class UsuariosCRUDTest(TestCase):
    def setUp(self):
        self.admin = Usuario.objects.create(email="admin@test.com", username="admin@test.com", rol="admin")
        self.supervisor = Usuario.objects.create(email="sup@test.com", username="sup@test.com", rol="supervisor")
        
        self.cuenta_1 = Cuenta.objects.create(nombre="Cuenta 1")
        self.cuenta_2 = Cuenta.objects.create(nombre="Cuenta 2")

    def test_create_usuario_assigns_cuentas(self):
        client = _auth_client(self.admin)
        payload = {
            "email": "newsup@test.com",
            "nombre": "New Supervisor",
            "rol": "supervisor",
            "activo": True,
            "cuentas_asignadas_ids": [self.cuenta_1.pk, self.cuenta_2.pk]
        }
        res = client.post("/incitrack/api/v1/usuarios/", data=payload, content_type="application/json")
        self.assertEqual(res.status_code, 201)
        
        new_sup = Usuario.objects.get(email="newsup@test.com")
        self.assertEqual(new_sup.cuentas_asignadas.count(), 2)
        self.assertIn(self.cuenta_1, new_sup.cuentas_asignadas.all())

    def test_edit_usuario_updates_cuentas(self):
        client = _auth_client(self.admin)
        self.supervisor.cuentas_asignadas.add(self.cuenta_1)
        
        payload = {
            "email": self.supervisor.email,
            "nombre": "Updated Name",
            "rol": "supervisor",
            "activo": True,
            "cuentas_asignadas_ids": [self.cuenta_2.pk]  # Changed from 1 to 2
        }
        res = client.put(f"/incitrack/api/v1/usuarios/{self.supervisor.pk}/", data=payload, content_type="application/json")
        self.assertEqual(res.status_code, 200)
        
        self.supervisor.refresh_from_db()
        self.assertEqual(self.supervisor.cuentas_asignadas.count(), 1)
        self.assertEqual(self.supervisor.cuentas_asignadas.first(), self.cuenta_2)

    def test_change_role_from_supervisor_removes_cuentas(self):
        client = _auth_client(self.admin)
        self.supervisor.cuentas_asignadas.add(self.cuenta_1)
        
        payload = {
            "email": self.supervisor.email,
            "nombre": "Updated Name",
            "rol": "admin", # Changed role to admin
            "activo": True,
            "cuentas_asignadas_ids": [self.cuenta_1.pk]
        }
        res = client.put(f"/incitrack/api/v1/usuarios/{self.supervisor.pk}/", data=payload, content_type="application/json")
        self.assertEqual(res.status_code, 200)
        
        self.supervisor.refresh_from_db()
        self.assertEqual(self.supervisor.rol, "admin")
        self.assertEqual(self.supervisor.cuentas_asignadas.count(), 0)

    def test_non_admin_cannot_create_usuarios(self):
        client = _auth_client(self.supervisor)
        payload = {
            "email": "hacker@test.com",
            "nombre": "Hacker",
            "rol": "admin",
            "activo": True
        }
        res = client.post("/incitrack/api/v1/usuarios/", data=payload, content_type="application/json")
        self.assertEqual(res.status_code, 403)
