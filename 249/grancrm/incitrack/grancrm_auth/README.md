# grancrm_auth

Middleware compartido para validar la cookie JWT `grancrm_session` emitida
por el orquestador GranCRM.

## Integración en otra app Django

1. Copia la carpeta `grancrm_auth/` al raíz del proyecto Django destino.
2. Agrega al `settings.py`:

```python
GRANCRM_JWT_SECRET = 'el-mismo-valor-que-en-el-orquestador'
LOGIN_URL = 'http://172.20.21.248:9000/login/'

MIDDLEWARE = [
    ...
    'grancrm_auth.middleware.GranCRMAuthMiddleware',
    ...
]
```

3. En las vistas protegidas, verifica `request.jwt_payload`:

```python
def mi_vista(request):
    if not request.jwt_payload:
        from django.conf import settings
        return redirect(settings.LOGIN_URL)
    # usuario autenticado — request.jwt_payload contiene user_id, email, apps, nombre
```

## Seguridad

- Tokens con TTL vencido son rechazados silenciosamente (jwt_payload = None).
- `GRANCRM_JWT_SECRET` debe ser idéntico en todos los servicios. No commitear.
- La cookie es `HttpOnly` — no accesible desde JavaScript.
- Para producción: configurar `SESSION_COOKIE_SECURE=True` y servir por HTTPS.
