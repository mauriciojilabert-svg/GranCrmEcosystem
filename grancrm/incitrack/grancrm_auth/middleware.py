import jwt
from django.conf import settings
import logging
logger = logging.getLogger(__name__)


class GranCRMAuthMiddleware:
    """
    Adjunta el payload JWT a request.jwt_payload.
    BYPASS TEMPORAL QA: ignora validación de firma.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        token = request.COOKIES.get('grancrm_session')
        request.jwt_payload = None

        if token:
            try:
                payload = jwt.decode(token, options={"verify_signature": False}, algorithms=["HS256"])
                request.jwt_payload = payload
                print(f"grancrm_auth.middleware: BYPASS OK - {payload.get('email')}", flush=True)
            except Exception as e:
                print(f"grancrm_auth.middleware: ERROR decodificando - {type(e).__name__}: {e}", flush=True)

        return self.get_response(request)
