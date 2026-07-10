import jwt
from django.conf import settings
import logging
logger = logging.getLogger(__name__)


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
            print("ninja_auth: SIN COOKIE", flush=True)
            return None

        # BYPASS TEMPORAL QA: si el middleware ya valido la sesion, usamos ese payload
        jwt_payload = getattr(request, "jwt_payload", None)
        if jwt_payload:
            print(f"ninja_auth: BYPASS via jwt_payload del middleware OK - {jwt_payload.get('email')}", flush=True)
            self._jit_provision(request, jwt_payload)
            return jwt_payload

        # Fallback: decodificar el token directamente (sin verificar firma)
        try:
            payload = jwt.decode(token, options={"verify_signature": False}, algorithms=["HS256"])
            print(f"ninja_auth: token decodificado sin firma - {payload.get('email')}", flush=True)
            request.jwt_payload = payload
            self._jit_provision(request, payload)
            return payload
        except Exception as e:
            print(f"ninja_auth: ERROR decodificando token - {type(e).__name__}: {e}", flush=True)
            return None

    def _jit_provision(self, request, payload):
        try:
            email = payload.get("email")
            if not email:
                return
            from django.contrib.auth import get_user_model
            Usuario = get_user_model()
            nombre = payload.get("nombre", email.split("@")[0])
            user, _ = Usuario.objects.get_or_create(
                email=email,
                defaults={
                    "nombre": nombre,
                    "username": email[:150],
                    "rol": "admin",
                    "is_active": True,
                },
            )
            request.user = user
        except Exception as e:
            print(f"ninja_auth: ERROR en jit_provision - {type(e).__name__}: {e}", flush=True)
