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
            return None
        try:
            secret_env = getattr(settings, "GRANCRM_JWT_SECRET", None)
            secret_key = getattr(settings, "SECRET_KEY", None)
            orquestador_old_secret = "BMkD0_EZLqHEioRFmIjqyT-bDlEBSD8-eNOWiymLfby5Wn9BsULs_9YR84c3Ftt8Sks"
            
            secrets_to_try = [secret_env, secret_key, orquestador_old_secret]
            
            payload = None
            for secret in secrets_to_try:
                if not secret: continue
                try:
                    payload = jwt.decode(token, secret, algorithms=["HS256"])
                    break
                except jwt.InvalidSignatureError:
                    continue
                except Exception:
                    pass
            
            if payload is None:
                return None
                
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
        except jwt.ExpiredSignatureError:
            logger.error("ninja_auth: *** TOKEN EXPIRADO ***")
            return None
        except jwt.InvalidSignatureError:
            logger.error(f"ninja_auth: *** FIRMA INVALIDA *** (secreto usado empieza con {str(secret)[:10]})")
            return None
        except Exception as e:
            logger.error(f"ninja_auth: *** ERROR DESCONOCIDO *** {type(e).__name__}: {e}")
            return None
