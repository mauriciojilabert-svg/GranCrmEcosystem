import jwt
from django.conf import settings


class GranCRMAuthMiddleware:
    """
    Valida la cookie grancrm_session (JWT) emitida por el orquestador.

    Adjunta el payload decodificado a request.jwt_payload.
    Si la cookie está ausente o es inválida, request.jwt_payload queda en None.
    No redirige — cada vista decide qué hacer cuando jwt_payload es None.

    Settings requeridos:
        GRANCRM_JWT_SECRET  ← el mismo secreto del orquestador

    Recomendado:
        LOGIN_URL = 'http://<ip-servidor>:9000/login/'
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        token = request.COOKIES.get('grancrm_session')
        request.jwt_payload = None

        if token:
            try:
                request.jwt_payload = jwt.decode(
                    token,
                    settings.GRANCRM_JWT_SECRET or settings.SECRET_KEY,
                    algorithms=['HS256'],
                )
                
                # Aprovisionamiento JIT (Just-In-Time)
                email = request.jwt_payload.get('email')
                if email:
                    from django.contrib.auth import get_user_model
                    Usuario = get_user_model()
                    nombre = request.jwt_payload.get('nombre', email.split('@')[0])
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

            except jwt.InvalidTokenError:
                pass

        return self.get_response(request)
