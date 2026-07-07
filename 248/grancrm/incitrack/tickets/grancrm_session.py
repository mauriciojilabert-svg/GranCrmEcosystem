import jwt
from django.contrib.auth import login, get_user_model
from django.http import JsonResponse
from django.shortcuts import redirect
from django.conf import settings

User = get_user_model()

# ID de InciTrack en el orquestador (core_aplicacion.id)
INCITRACK_APP_ID = getattr(settings, 'GRANCRM_APP_ID', 4)

# Mapeo rol GranCRM (JWT `rol`) -> rol InciTrack.
# Acepta valores VIEJOS (compat) y NUEVOS a la vez, así funciona con
# JWT_ROLES_COMPAT en True o False sin depender del orden de deploy.
# ponytail: `supervisor`/`agente` nuevos → local "supervisor" (igual que "ejecutivo");
# mapear el `supervisor` nuevo al local "jefe" es decisión de producto, aún sin definir.
_ROLE_MAP = {
    "sa":           "admin",
    "admin":        "admin",
    "ejecutivo":    "supervisor",
    "admin_ti":     "admin",
    "admin_cuenta": "admin",
    "supervisor":   "supervisor",
    "agente":       "supervisor",
}
# Superuser+staff Django: viejo "sa" / nuevo "admin_ti".
_SUPERUSER_ROLES = {"sa", "admin_ti"}
assert _SUPERUSER_ROLES <= _ROLE_MAP.keys()


class GranCRMSessionMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        token = request.COOKIES.get("grancrm_session")

        if not token:
            return self.get_response(request)

        payload = self._validate(token)

        if payload is None:
            if request.path.startswith('/incitrack/api/'):
                response = JsonResponse({"detail": "Sesión expirada"}, status=401)
            else:
                response = redirect(settings.GRANCRM_ORCHESTRATOR_URL + "/login/")
            response.delete_cookie(
                "grancrm_session",
                domain=getattr(settings, "GRANCRM_COOKIE_DOMAIN", None),
            )
            return response

        # Verificar que el usuario tiene acceso a InciTrack
        if INCITRACK_APP_ID not in payload.get("apps", []):
            if request.path.startswith('/incitrack/api/'):
                response = JsonResponse({"detail": "Sesión expirada"}, status=401)
            else:
                response = redirect(settings.GRANCRM_ORCHESTRATOR_URL + "/login/")
            response.delete_cookie(
                "grancrm_session",
                domain=getattr(settings, "GRANCRM_COOKIE_DOMAIN", None),
            )
            return response

        # Sincronizar usuario+rol una vez por sesión (cubre usuarios ya creados).
        if not request.session.get("_grancrm_synced"):
            self._sync_user(request, payload)
            request.session["_grancrm_synced"] = True

        return self.get_response(request)

    def _validate(self, token):
        try:
            return jwt.decode(token, settings.GRANCRM_JWT_SECRET, algorithms=["HS256"])
        except jwt.InvalidTokenError:
            return None

    def _sync_user(self, request, payload):
        email = payload["email"]
        nombre = payload.get("nombre", email.split("@")[0])
        grancrm_rol = payload.get("rol", "")
        it_rol = _ROLE_MAP.get(grancrm_rol, "supervisor")
        is_super = grancrm_rol in _SUPERUSER_ROLES

        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "username": email[:150],
                "nombre": nombre,
                "is_active": True,
                "rol": it_rol,
            },
        )
        if created:
            user.set_unusable_password()

        # GranCRM manda sobre el rol/permisos (fuente de verdad).
        dirty = created
        if user.nombre != nombre:
            user.nombre = nombre
            dirty = True
        if user.rol != it_rol:
            user.rol = it_rol
            dirty = True
        if user.is_staff != is_super or user.is_superuser != is_super:
            user.is_staff = is_super
            user.is_superuser = is_super
            dirty = True
        if dirty:
            user.save()

        login(request, user, backend="django.contrib.auth.backends.ModelBackend")
