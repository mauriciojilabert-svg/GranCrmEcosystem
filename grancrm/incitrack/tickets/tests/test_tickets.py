import time
import jwt
from django.conf import settings as django_settings
from django.test import TestCase, Client

from tickets.models import Usuario, Cuenta, Ticket, Categoria, Subcategoria, Comentario, TicketAudit
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


class TicketLifecycleTest(TestCase):
    def setUp(self):
        self.admin = Usuario.objects.create(email="admin@test.com", username="admin@test.com", rol="admin")
        self.supervisor = Usuario.objects.create(email="sup@test.com", username="sup@test.com", rol="supervisor")
        
        self.cuenta = Cuenta.objects.create(nombre="Cuenta Test")
        self.cuenta.supervisores.add(self.supervisor)
        
        self.categoria = Categoria.objects.create(nombre="Cat Test")
        self.subcat = Subcategoria.objects.create(nombre="Subcat Test", categoria=self.categoria)

    def test_create_ticket_with_categoria(self):
        client = _auth_client(self.supervisor)
        payload = {
            "titulo": "New Ticket",
            "descripcion": "Some description",
            "prioridad": "media",
            "cuenta_id": self.cuenta.pk,
            "categoria_id": self.categoria.pk,
            "subcategoria_id": self.subcat.pk,
        }
        res = client.post("/incitrack/api/v1/tickets/", data=payload, content_type="application/json")
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["categoria_id"], self.categoria.pk)
        self.assertEqual(data["subcategoria_id"], self.subcat.pk)
        
        ticket = Ticket.objects.get(pk=data["id"])
        self.assertEqual(ticket.categoria, self.categoria)
        self.assertEqual(ticket.subcategoria, self.subcat)

    def test_edit_ticket_creates_audit_trail(self):
        ticket = Ticket.objects.create(titulo="T", descripcion="D", cuenta=self.cuenta, creado_por=self.supervisor, estado="abierto")
        client = _auth_client(self.admin)
        
        payload = {
            "estado": "en_proceso",
            "asignado_a_id": self.admin.pk
        }
        res = client.put(f"/incitrack/api/v1/tickets/{ticket.pk}/", data=payload, content_type="application/json")
        self.assertEqual(res.status_code, 200)
        
        ticket.refresh_from_db()
        self.assertEqual(ticket.estado, "en_proceso")
        self.assertEqual(ticket.asignado_a, self.admin)
        
        audits = TicketAudit.objects.filter(ticket=ticket)
        self.assertEqual(audits.count(), 2)
        campos = [a.campo_modificado for a in audits]
        self.assertIn("Responsable", campos)
        self.assertIn("Estado", campos)

    def test_cerrar_ticket_requires_comentario(self):
        ticket = Ticket.objects.create(titulo="T", descripcion="D", cuenta=self.cuenta, creado_por=self.supervisor, estado="abierto")
        # Admin trying to close without a comment
        client = _auth_client(self.admin)
        res = client.post(f"/incitrack/api/v1/tickets/{ticket.pk}/cerrar/")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()["detail"], "No puedes cerrar el ticket sin haber escrito al menos un comentario")

    def test_cerrar_ticket_sets_fecha_resolucion(self):
        ticket = Ticket.objects.create(titulo="T", descripcion="D", cuenta=self.cuenta, creado_por=self.supervisor, estado="abierto")
        
        # Admin adds a comment
        Comentario.objects.create(ticket=ticket, autor=self.admin, contenido="Fixing")
        
        client = _auth_client(self.admin)
        res = client.post(f"/incitrack/api/v1/tickets/{ticket.pk}/cerrar/")
        self.assertEqual(res.status_code, 200)
        
        ticket.refresh_from_db()
        self.assertEqual(ticket.estado, "cerrado")
        self.assertIsNotNone(ticket.fecha_resolucion)

    def test_closed_ticket_immutable(self):
        ticket = Ticket.objects.create(titulo="T", descripcion="D", cuenta=self.cuenta, creado_por=self.supervisor, estado="cerrado")
        client = _auth_client(self.admin)
        
        payload = {"estado": "abierto"}
        res = client.put(f"/incitrack/api/v1/tickets/{ticket.pk}/", data=payload, content_type="application/json")
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.json()["detail"], "El ticket está cerrado y no puede modificarse")
        
        comment_payload = {"contenido": "Try comment", "interno": False}
        res_comment = client.post(f"/incitrack/api/v1/tickets/{ticket.pk}/comentarios/", data=comment_payload, content_type="application/json")
        self.assertEqual(res_comment.status_code, 403)

    def test_supervisor_cerrar_own_ticket(self):
        ticket = Ticket.objects.create(titulo="T", descripcion="D", cuenta=self.cuenta, creado_por=self.supervisor, estado="abierto")
        client = _auth_client(self.supervisor)
        
        # Supervisor can close their own ticket without comments constraint (constraint is only for admin)
        res = client.post(f"/incitrack/api/v1/tickets/{ticket.pk}/cerrar/")
        self.assertEqual(res.status_code, 200)
        
        ticket.refresh_from_db()
        self.assertEqual(ticket.estado, "cerrado")
