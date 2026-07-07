# Guía: apps GranCRM como microfrontend MF React + portables con Docker

Reglas e instrucciones para **construir una app nueva** o **migrar una existente** al
ecosistema GranCRM como **microfrontend nativo** (`spa_remote`, React + Vite + Module
Federation) y **100% reproducible con Docker** (build limpio desde cero levanta backend
y SPA, sin pasos manuales).

> **Contrato profundo (SSO/JWT/multi-tenant/manifest):** ver el documento maestro
> `orquestador/docs/GUIA_INTEGRACION_APP_SATELITE.md`. Esta guía **no lo reemplaza**:
> añade las reglas de **portabilidad Docker** y las **lecciones** de migraciones reales.
>
> **Referencias de código (copiar de acá):**
> - Backend + build reproducible: `call_reviews/` (Dockerfile multi-stage + entrypoint).
> - Migración Django→MF completa: `grancrm/incitrack/` (API ninja + frontend + docker).

---

## 0. Reglas de oro (invariantes — no negociables)

1. **Un solo login.** La app NUNCA implementa login propio. Valida el JWT de la cookie
   `grancrm_session` (HS256, secreto compartido). Nunca `Authorization: Bearer`.
2. **`GRANCRM_JWT_SECRET` idéntico** al del orquestador, **siempre desde env**, nunca
   hardcodeado ni commiteado.
3. **`modo: spa_remote`** (no iframe). El frontend expone `./App` y lo monta el shell.
4. **Rutas relativas siempre** (`url_publica`, API, assets, `remote_entry_url`). Nunca
   `http://IP:puerto`.
5. **HTTPS tras el gateway**: `SECURE_PROXY_SSL_HEADER` sí; `SECURE_SSL_REDIRECT` no.
6. **Secretos fuera de git**: `.env` en `.gitignore` desde el commit 1. Si ya se filtró,
   rotar/purgar; nunca subir uno nuevo.
7. **Build reproducible en Docker** (sección §3): el bundle MF se construye DENTRO del
   Dockerfile y se publica por el `entrypoint`. **Nunca** dejar el bundle "puesto a mano"
   en `staticfiles/`.
8. **Datos por tenant**: si toca datos, usar el middleware + router de tenant (`db_name`
   del JWT). Nunca asumir una sola BD.

---

## 1. Arquitectura (resumen)

```
Browser ─HTTPS─► gateway nginx (/home/admincrm/gateway/nginx.conf)
   /                → shell SPA (React MF host)
   /<slug>/         → tu app (split: /api/admin/media → Django ; resto → shell SPA)
   /mf/<scope>/...  → remoteEntry.js (servido desde /home/admincrm/staticfiles/mf/<scope>)
   /api /login /logout → orquestador (DIOS, :9000) — SSO, /api/session, manifest
```
El shell lee `/api/apps/manifest.json`, y para `modo: spa_remote` hace
`import(remote_entry_url)` → `container.get('./App')` → te inyecta `GranCrmRemoteProps`.

---

## 2. Frontend remoto (resumen — detalle en GUIA maestra §2.2)

- `vite.config.ts`: `federation({ name:'<scope>', filename:'remoteEntry.js',
  exposes:{'./App':'./src/App.tsx'}, shared: react/react-dom/react-router-dom **singleton**
  18/18/6 })`. **`outDir` por defecto RELATIVO** (`../static/mf/<scope>`), honrando
  `VITE_MF_OUT_DIR` (clave para que buildee en Docker — ver §3).
- `src/App.tsx`: `export default function App({contractVersion, basename, apiBase, session, bus}: GranCrmRemoteProps)`.
  **Sin `<BrowserRouter>`** (lo provee el shell con `basename`). Rutas **sin prefijo**
  (`path="tickets"`, no `/<slug>/tickets`). Listener `grancrm:sessionExpired` → `bus.emit`.
- `src/api.ts`: `apiFetch` con `credentials:'include'` + `X-CSRFToken`; `401` →
  `dispatchEvent('grancrm:sessionExpired')`. URLs desde `apiBase` (no hardcodear el prefijo).
- `src/types.ts`: copia **verbatim** de `orquestador/frontend/packages/grancrm-ui/src/contract.ts`
  (mantener sincronizada a mano). El frontend NO depende del paquete workspace.
- `src/main.tsx`: solo harness de dev standalone. Si lo usás, necesita un endpoint
  backend `GET /<slug>/api/v1/me/` (devuelve `user_id,email,nombre,rol,tenant_id` del JWT).

---

## 3. ⭐ Portabilidad Docker (lo que hace falta para reproducible)

**Regla**: `docker compose build && up` debe levantar Django **y** publicar la SPA, sin
tocar `staticfiles` a mano. Patrón (de `call_reviews`/`incitrack`):

### 3.1 `Dockerfile` multi-stage
```dockerfile
# Stage 1: build del bundle MF
FROM node:22-slim AS builder
ENV CI=true
RUN corepack enable && corepack prepare pnpm@11.2.2 --activate
WORKDIR /build/frontend
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm build                      # outDir ../static/mf/<scope> → /build/static/mf/<scope>

# Stage 2: Django
FROM python:3.11-slim
# ... (ODBC msodbcsql18 si usás SQL Server) ...
WORKDIR /app
COPY requirements.txt . && RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Bundle FUERA de /app (para que bind-mounts no lo pisen); lo publica el entrypoint
COPY --from=builder /build/static/mf/<scope> /opt/mf-assets/<scope>
RUN chmod +x entrypoint.sh
EXPOSE 8000
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["gunicorn", "<proj>.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "120"]
```

### 3.2 `entrypoint.sh`
```bash
#!/bin/bash
set -e
if [[ "$1" == gunicorn* ]]; then
  if [ -d /opt/mf-assets/<scope> ]; then
    mkdir -p static/mf/<scope> && cp -r /opt/mf-assets/<scope>/. static/mf/<scope>/
    if [ -n "$NGINX_STATIC_MF_PATH" ]; then        # lo sirve el gateway en /mf/
      mkdir -p "$NGINX_STATIC_MF_PATH" && cp -r /opt/mf-assets/<scope>/. "$NGINX_STATIC_MF_PATH/"
    fi
  fi
  python manage.py migrate --fake-initial --noinput   # --fake-initial: BD que ya existe
  python manage.py collectstatic --noinput
fi
exec "$@"
```

### 3.3 `vite.config.ts` outDir
```ts
const outDir = env.VITE_MF_OUT_DIR ? path.resolve(env.VITE_MF_OUT_DIR)
                                   : path.resolve(__dirname, '../static/mf/<scope>');
```

### 3.4 `docker-compose.yml` (servicio)
```yaml
  <app>:
    build: { context: ./<app>, dockerfile: Dockerfile }
    environment:
      - DJANGO_SETTINGS_MODULE=<proj>.settings
      - NGINX_STATIC_MF_PATH=/mf_host
    env_file: [ ./<app>/.env ]
    volumes:
      - ./<app>/media:/app/media
      - ./<app>/dios.json:/app/dios.json:ro
      - /home/admincrm/staticfiles/mf/<scope>:/mf_host   # el entrypoint publica acá
    # NO montes settings.py/urls.py/código fuente: que viva HORNEADO en la imagen
    #   (los bind-mounts de código rompen la reproducibilidad).
```

### 3.5 `.dockerignore` (en `<app>/`)
```
frontend/node_modules
frontend/dist
frontend/dist-*
**/__pycache__
*.pyc
.env
.env.*
venv
staticfiles
media
.git
```

---

## 4. Backend (resumen — detalle GUIA §2.3)

- Stack: `PyJWT`, `django-ninja` (API JSON en `/<slug>/api/v1/`), `mssql-django`/`pyodbc`
  si SQL Server, `whitenoise`. NO `simplejwt`.
- Middleware (orden): `grancrm_auth.middleware.GranCRMAuthMiddleware` (setea
  `request.jwt_payload`) → tu sync de usuario local → `TenantDatabaseMiddleware` (si
  multi-tenant). **Preservá** los existentes; solo agregás.
- API autenticada por cookie (`GranCrmCookieAuth`). En rutas `/api/`, ante sesión
  inválida devolvé **401 JSON**, no 302 (el `apiFetch` del front espera 401).
- Reusá las reglas de visibilidad por rol/tenant en cada endpoint (no reimplementar).

---

## 5. Registro en DIOS — `dios.json`

```json
{
  "nombre": "Mi App", "url_publica": "/<slug>/", "url_interna": "http://127.0.0.1:<port>",
  "icono": "feather-...", "categoria": "...", "secret": "",
  "modo": "spa_remote", "slug": "<scope>", "route_prefix": "/<slug>",
  "remote_entry_url": "/mf/<scope>/remoteEntry.js", "remote_scope": "<scope>",
  "contract_version": "1",
  "nav": [ { "label": "...", "icon": "feather-...", "inner": "/<slug>/<ruta-react>" } ]
}
```
- `remote_scope` **DEBE** == `name` del vite config.
- ⚠️ **`nav[].inner` DEBE coincidir EXACTO con las rutas del React Router** (no las URLs
  Django viejas). Ej: ruta React `admin/usuarios` → `inner: "/<slug>/admin/usuarios"`.
  (Bug clásico de migración: dejar `inner` con rutas legacy → los botones no navegan.)
- El auto-registro corre en `AppConfig.ready()` → `register_with_dios()`. Dar de alta
  la app a cada `Cuenta`/usuario (`AccesoAplicacion`) o no aparece en su manifest.

---

## 6. Gateway (manual, en `/home/admincrm/gateway/nginx.conf`)

Reemplazar el `location /<slug>/` por el **split** (api/admin/media → backend; resto → SPA):
```nginx
location /<slug>/api/   { proxy_pass http://127.0.0.1:<port>/<slug>/api/; }
location /<slug>/admin/ { proxy_pass http://127.0.0.1:<port>/<slug>/admin/; }
location /<slug>/media/ { proxy_pass http://127.0.0.1:<port>/<slug>/media/; }
location /<slug>/       { root /home/admincrm/staticfiles/shell; try_files /index.html =404; add_header Cache-Control "no-store" always; }
```
`nginx -t && nginx -s reload`. (El bloque `/mf/` y `/assets/` ya existen — no tocar.)
El gateway es un repo aparte; versioná/aplicá ahí.

---

## 7. Playbook de migración (Django legacy → MF nativo)

Ejecutar **en este orden**, commiteando cada fase:

0. **Commitear TODO lo que está sin commitear primero** (base limpia). Una migración no
   se puede hacer sobre working-tree sin commitear: un worktree/clone limpio no la tendría.
   Excluí `.env` y artefactos.
1. **Backend API**: `django-ninja` en `/<slug>/api/v1/` reusando models/visibilidad.
2. **Frontend scaffold**: remoto MF que monte `./App` (copiá de `incitrack/frontend`).
3. **Portar páginas** a React contra la API (responsive, gating por rol).
4. **Docker portable** (§3): Dockerfile multi-stage + entrypoint + vite outDir + compose.
5. **Registrar** (`dios.json` spa_remote, nav = rutas React) + **gateway split**.
6. **Borrar** plantillas/vistas/urls Django legacy (recién con la SPA validada en vivo).

---

## 8. Gotchas (lecciones reales)

- **Nada de bundle a mano**: si el bundle solo vive en `staticfiles/mf/` puesto a mano, un
  rebuild limpio NO lo regenera → no portable. Resolvé con §3.
- **`nav` ≠ rutas React** → botones muertos. Alinealos (§5).
- **401 vs 302** en `/api/`: el redirect a login rompe el `apiFetch`. Devolvé 401 en API.
- **`dist/`, `node_modules/` gitignored**: NO commitear artefactos; el build pasa en Docker.
- **Permisos**: si la carpeta de la app es `755` (sin `g+w`), solo el dueño puede editar/
  rebuildear. Coordiná el deploy con el usuario dueño (o `chmod g+w`).
- **`migrate` en BD existente**: usá `--fake-initial`. Si el modelo cambió sin migración,
  corré `makemigrations` (esquema 100% reproducible vía migraciones).
- **Admin "ver todos"**: si replicás un dashboard que filtra "solo mis tickets" para admin,
  documentá el toggle (o cambiá el default) — si no, parece "BD vacía".
- **`url_publica` relativa**: absoluta `http://IP` rompe HTTPS (mixed-content).

---

## 9. Checklist de aceptación

**Frontend**: `name`/`exposes:'./App'`/singletons 18/18/6; `outDir` relativo; sin
`BrowserRouter`; rutas sin prefijo; `apiFetch` con `credentials:'include'`+CSRF+401.
**Docker**: Dockerfile multi-stage buildea el bundle; entrypoint publica a
`$NGINX_STATIC_MF_PATH`; `.dockerignore`; compose sin bind-mounts de código.
**Backend**: `GRANCRM_JWT_SECRET` == DIOS desde env; middleware en orden; multi-tenant ok.
**Registro/infra**: `dios.json` con campos MF + `nav` = rutas React; `remote_scope`==vite
`name`; `location /<slug>/` split en gateway + `nginx -t` ok.
**Verificación**: desde **checkout limpio** → `docker compose build && up` → login en
shell → la app monta como **remoto (sin `<iframe>`)** con estilos y datos → `/api` 200 →
cambio de tenant cambia datos → logout revoca.
