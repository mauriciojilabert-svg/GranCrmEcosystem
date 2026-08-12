import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'incitrack.settings')
django.setup()

from tickets.models import Usuario
from tickets.api import dashboard
from django.test import RequestFactory

usuario = Usuario.objects.filter(rol='supervisor').first()
if not usuario:
    print("No supervisor found")
else:
    print(f"Testing dashboard for {usuario.email}")
    request = RequestFactory().get('/incitrack/api/v1/dashboard/')
    request.user = usuario
    request.jwt_payload = {'email': usuario.email, 'rol': usuario.rol}
    
    try:
        response = dashboard(request)
        print("Success:", response)
    except Exception as e:
        import traceback
        traceback.print_exc()
