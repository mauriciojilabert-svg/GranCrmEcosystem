import os
import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "incitrack.test_settings")
django.setup()

from django.test import Client
from tickets.models import Cuenta, Usuario, Ticket, Categoria, Comentario
from tickets.tests.utils import _make_jwt
from django.core.files.uploadedfile import SimpleUploadedFile

cuenta, _ = Cuenta.objects.get_or_create(nombre="Test Cuenta Adjunto")
usuario, _ = Usuario.objects.get_or_create(email="user@test.com", rol="jefe")
ticket, _ = Ticket.objects.get_or_create(titulo="Test", descripcion="Desc", cuenta=cuenta, creado_por=usuario)
comentario, _ = Comentario.objects.get_or_create(ticket=ticket, autor=usuario, contenido="Test")

client = Client()
token = _make_jwt({"email": "user@test.com", "rol": "jefe"})
client.cookies["grancrm_session"] = token

file = SimpleUploadedFile("test.png", b"file_content", content_type="image/png")

res = client.post(f"/incitrack/api/v1/tickets/{ticket.id}/comentarios/{comentario.id}/adjuntos/", {"file": file})
print("STATUS:", res.status_code)
if res.status_code >= 400:
    print(res.content.decode('utf-8'))
