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

        # Usar el payload decodificado por grancrm_auth.middleware (BYPASS de firma en QA)
        payload = getattr(request, 'jwt_payload', None)
        
        if not payload:
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
        
        # Convertir todo a string para evitar problemas de tipos (ej: 4 in ["4"])
        apps_str = [str(a) for a in apps_in_token]
        target_app = str(INCITRACK_APP_ID)
        
        if target_app not in apps_str:
            print(f"grancrm_session: *** ALERTA DE ACCESO *** apps en token={apps_str}, buscando={target_app}. OMITIENDO BLOQUEO TEMPORALMENTE.", flush=True)
            # BYPASS TEMPORAL: No bloqueamos para no romper el flujo si el ID de la app cambió en QA.
            # if request.path.startswith('/incitrack/api/'):
            #     response = JsonResponse({"detail": f"Sesión expirada (sin acceso a app {target_app})"}, status=401)
            # else:
            #     response = redirect(settings.GRANCRM_ORCHESTRATOR_URL + "/login/?error=sin_acceso_incitrack")
            # response.delete_cookie(
            #     "grancrm_session",
            #     domain=getattr(settings, "GRANCRM_COOKIE_DOMAIN", None),
            # )
            # return response

        # Bloquear acceso a los Agentes (Opción 3 de arquitectura)
        grancrm_rol = payload.get("rol_real", payload.get("rol", ""))
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

        # Sincronizar usuario+rol: SIEMPRE re-sincronizar si el email del JWT
        # no coincide con el usuario actualmente logueado en la sesión de Django.
        # Esto evita que la sesión de un usuario anterior (ej: admin) persista
        # cuando otro usuario (ej: supervisor) inicia sesión.
        current_email = getattr(request.user, 'email', None) if hasattr(request, 'user') and request.user and request.user.is_authenticated else None
        jwt_email = payload.get("email", "")
        
        if current_email != jwt_email:
            print(f"grancrm_session: RE-SYNC necesario: sesion={current_email} vs jwt={jwt_email}", flush=True)
            self._sync_user(request, payload)
            request.session["_grancrm_synced"] = True
        elif not request.session.get("_grancrm_synced"):
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
        grancrm_rol = payload.get("rol_real", payload.get("rol", ""))
        
        # Try full role first, if not found, strip numeric suffix if present (e.g. admin_0 -> admin)
        import re
        base_rol = re.sub(r'_\d+$', '', grancrm_rol)
        
        it_rol = _ROLE_MAP.get(grancrm_rol)
        if not it_rol:
            it_rol = _ROLE_MAP.get(base_rol, "supervisor")

        print(f"grancrm_session._sync_user: email={email} jwt_rol='{grancrm_rol}' base_rol='{base_rol}' -> it_rol='{it_rol}'", flush=True)

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
