import jwt
from django.conf import settings


class GranCrmCookieAuth:
    """
    Autenticación JWT para django-ninja.
    Lee la cookie `grancrm_session` y valida el JWT con GRANCRM_JWT_SECRET.
    Compatible con la integración MF remote (Fase 3).
    """

    openapi_type = "apiKey"
    openapi_name = "GranCrmCookieAuth"

    def __call__(self, request):
        token = request.COOKIES.get("grancrm_session")
        if not token:
            return None
        try:
            secret = getattr(settings, "GRANCRM_JWT_SECRET", None) or settings.SECRET_KEY
            payload = jwt.decode(token, secret, algorithms=["HS256"])
            request.jwt_payload = payload
            
            # Aprovisionamiento JIT (Just-In-Time)
            email = payload.get('email')
            if email:
                from django.contrib.auth import get_user_model
                Usuario = get_user_model()
                nombre = payload.get('nombre', email.split('@')[0])
                user, created = Usuario.objects.get_or_create(
                    email=email,
                    defaults={
                        'nombre': nombre,
                        'username': email,
                        'rol': 'supervisor',
                        'activo': True,
                    }
                )
                request.user = user

            return payload
        except Exception:
            return None
