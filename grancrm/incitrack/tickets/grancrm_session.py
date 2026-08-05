import jwt
from django.contrib.auth import login, get_user_model
from django.http import JsonResponse
from django.shortcuts import redirect
from django.conf import settings

User = get_user_model()

# ID de InciTrack en el orquestador (core_aplicacion.id)
INCITRACK_APP_ID = getattr(settings, 'GRANCRM_APP_ID', 4)

# Mapeo rol GranCRM (JWT `rol`) -> rol InciTrack.
_ROLE_MAP = {
    "sa":           "admin",
    "admin":        "admin",        # Fallback
    "admin_ti":     "admin",
    "admin_cuenta": "jefe",
    "supervisor":   "supervisor",
    "ejecutivo":    "supervisor",   # Fallback legacy
}


class GranCRMSessionMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        token = request.COOKIES.get("grancrm_session")

        if not token:
            print(f"grancrm_session: SIN COOKIE en {request.path}", flush=True)
            print(f"grancrm_session: Cookies disponibles: {list(request.COOKIES.keys())}", flush=True)
            return self.get_response(request)

        payload = self._validate(token)

        if payload is None:
            print(f"grancrm_session: *** TOKEN INVALIDO en {request.path} ***", flush=True)
            if request.path.startswith('/incitrack/api/'):
                response = JsonResponse({"detail": "Sesión expirada (token inválido)"}, status=401)
            else:
                response = redirect(settings.GRANCRM_ORCHESTRATOR_URL + "/login/?error=token_invalido")
            response.delete_cookie(
                "grancrm_session",
                domain=getattr(settings, "GRANCRM_COOKIE_DOMAIN", None),
            )
            return response

        # Verificar que el usuario tiene acceso a InciTrack
        apps_in_token = payload.get("apps", [])
        if INCITRACK_APP_ID not in apps_in_token:
            print(f"grancrm_session: *** SIN ACCESO *** apps en token={apps_in_token}, buscando={INCITRACK_APP_ID} (tipo: {type(INCITRACK_APP_ID)})", flush=True)
            print(f"grancrm_session: tipos en apps: {[type(a) for a in apps_in_token]}")
            if request.path.startswith('/incitrack/api/'):
                response = JsonResponse({"detail": f"Sesión expirada (sin acceso a app {INCITRACK_APP_ID})"}, status=401)
            else:
                response = redirect(settings.GRANCRM_ORCHESTRATOR_URL + "/login/?error=sin_acceso_incitrack")
            response.delete_cookie(
                "grancrm_session",
                domain=getattr(settings, "GRANCRM_COOKIE_DOMAIN", None),
            )
            return response

        # Bloquear acceso a los Agentes (Opción 3 de arquitectura)
        grancrm_rol = payload.get("rol", "")
        base_rol = grancrm_rol.split("_")[0] if "_" in grancrm_rol else grancrm_rol
        if base_rol == "agente":
            print(f"grancrm_session: *** ACCESO DENEGADO (Rol Agente no permitido) ***", flush=True)
            if request.path.startswith('/incitrack/api/'):
                response = JsonResponse({"detail": "Acceso denegado: El perfil Agente no está autorizado en InciTrack."}, status=403)
            else:
                response = redirect(settings.GRANCRM_ORCHESTRATOR_URL + "/login/?error=acceso_denegado_agente")
            response.delete_cookie(
                "grancrm_session",
                domain=getattr(settings, "GRANCRM_COOKIE_DOMAIN", None),
            )
            return response

        print(f"grancrm_session: OK - usuario={payload.get('email')} rol={payload.get('rol')} apps={apps_in_token}", flush=True)

        # Compartir payload con ninja_auth para evitar doble validacion
        request.jwt_payload = payload

        # Sincronizar usuario+rol una vez por sesión (cubre usuarios ya creados).
        if not request.session.get("_grancrm_synced"):
            self._sync_user(request, payload)
            request.session["_grancrm_synced"] = True

        return self.get_response(request)

    def _validate(self, token):
        secret_env = getattr(settings, 'GRANCRM_JWT_SECRET', None)
        secret_key = getattr(settings, 'SECRET_KEY', None)
        orquestador_old_secret = "BMkD0_EZLqHEioRFmIjqyT-bDlEBSD8-eNOWiymLfby5Wn9BsULs_9YR84c3Ftt8Sks"
        
        base_secrets = [secret_env, secret_key, orquestador_old_secret]
        secrets_to_try = []
        for s in base_secrets:
            if s:
                secrets_to_try.extend([s, s + '\r', s + '\n', s + '\r\n', s.strip()])

        for s in secrets_to_try:
            try:
                # Decodificar el JWT. Orquestador usa HS256.
                payload = jwt.decode(token, s, algorithms=["HS256"])
                return payload
            except jwt.ExpiredSignatureError:
                print("grancrm_session: Token expirado.", flush=True)
                return None
            except jwt.InvalidTokenError as e:
                # Si falla, probar con el siguiente secreto de la lista
                print(f"grancrm_session: Intento de decodificar falló con un secreto: {e}", flush=True)
                continue
                
        print("grancrm_session: Todos los intentos de decodificación fallaron.", flush=True)
        return None

    def _sync_user(self, request, payload):
        email = payload["email"]
        nombre = payload.get("nombre", email.split("@")[0])
        grancrm_rol = payload.get("rol", "")
        
        # Eliminar el sufijo si existe (ej: "admin_0" -> "admin")
        base_rol = grancrm_rol.split("_")[0] if "_" in grancrm_rol else grancrm_rol
        
        it_rol = _ROLE_MAP.get(base_rol, "supervisor")
        is_super = base_rol == "sa"

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
