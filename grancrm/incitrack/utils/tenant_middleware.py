import threading
import jwt
from django.conf import settings

_thread_local = threading.local()


def get_current_db():
    return getattr(_thread_local, 'db_name', 'default')


class TenantDatabaseMiddleware:
    """
    Lee el JWT de la cookie grancrm_session, extrae db_name y
    registra la BD del tenant en settings.DATABASES para este request.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        db_name = self._resolve_db(request)
        _thread_local.db_name = db_name or 'default'

        if db_name and db_name not in settings.DATABASES:
            settings.DATABASES[db_name] = {
                **settings.DATABASES['default'],
                'NAME': db_name,
            }

        try:
            response = self.get_response(request)
        finally:
            _thread_local.db_name = 'default'

        return response

    def _resolve_db(self, request):
        # Si otro middleware ya parseó el JWT, usarlo directamente
        payload = getattr(request, 'jwt_payload', None)
        if payload:
            return payload.get('db_name')

        token = request.COOKIES.get('grancrm_session')
        if not token:
            return None
        try:
            payload = jwt.decode(
                token,
                settings.GRANCRM_JWT_SECRET,
                algorithms=['HS256'],
            )
            request.jwt_payload = payload
            request.tenant_id  = payload.get('tenant_id')
            request.tenant_db  = payload.get('db_name')
            return payload.get('db_name')
        except Exception:
            return None
