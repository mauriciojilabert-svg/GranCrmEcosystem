# Incidente: acceso a InciTrack caído para todos los usuarios

> Detectado: 2026-07-02, reportado por Mauricio Cáceres (`mauriciocaceres@in-touchcrm.cl`)
> Resuelto: 2026-07-02
> Severidad: 🔴 Alta — bloqueaba el acceso a InciTrack para **todos** los usuarios, no solo el que reportó
> Responsable del diagnóstico: sesión asistida con Claude Code (admincrm), revisado por Tomás Valenzuela

---

## Resumen ejecutivo

Un usuario reportó que al entrar a InciTrack veía un error en rojo que no alcanzaba a leer, y lo expulsaba de la página. **No fue un problema del Orquestador GranCRM ni del SSO en sí** — fueron **tres fallas independientes dentro de InciTrack** que quedaron encadenadas:

1. Credencial de base de datos rota (`incitrack_login` sin acceso a SQL Server).
2. Config de autorización desincronizada (`GRANCRM_APP_ID` apuntando a un id que ya no existe).
3. Frontend de InciTrack desactualizado (llamaba rutas de API que el backend ya no expone).

Las tres se diagnosticaron y corrigieron en la misma sesión. El Orquestador funcionó correctamente durante todo el incidente — su única "participación" fue que el JWT que emite usa el `id` numérico de `core_aplicacion`, y ese id cambió en algún momento sin que InciTrack se actualizara (ver mejoras propuestas al final).

---

## ¿Estaba InciTrack listo para QA?

**No.** Este incidente ocurrió directamente en el servidor QA (`GranCRM-QA`, `172.20.21.249`) — no es una promoción pendiente, es la app ya corriendo ahí y sin estar en condiciones. Evidencia concreta:

1. **El proceso de deploy del frontend estaba de facto roto.** `pnpm-workspace.yaml` no tenía la clave `packages` que pnpm 10 exige — nadie podía haber corrido `pnpm install` con éxito en este servidor antes de que se arreglara en esta sesión. Es decir, aunque alguien hubiera querido rehacer el build para corregir el desfase de API, la herramienta de build no funcionaba.
2. **El frontend llevaba ~3 semanas desincronizado del backend** (bundle del 2026-06-12 llamando rutas de API que el backend ya no expone) sin que nadie lo detectara — no hay smoke test ni monitoreo post-deploy que lo hubiera atrapado antes de que un usuario chocara con el 404.
3. **`GRANCRM_APP_ID` nunca estuvo realmente cableado a `settings.py`.** No es un error de "se configuró mal el `.env` al promover" — es un bug de código que estaba ahí desde antes de esta promoción a QA, agravado por el cambio de id en `core_aplicacion`.
4. **La credencial de BD se rotó sin validar que el nuevo password funcionara** antes de reiniciar el contenedor — 17 horas de caída total sin que nadie se enterara hasta que un usuario reportó el error.

**Gap adicional en el proceso de promoción de la organización:** ni `docs/promocion-dev-qa.md` ni `docs/env-promotion-guide.md` (el checklist oficial DEV→QA→PROD) mencionan `GRANCRM_APP_ID` como algo a verificar al promover una app. O sea, ni siquiera siguiendo el checklist existente al pie de la letra se hubiera atrapado la causa raíz #2. Además, en la tabla de `source_db` por entorno de `env-promotion-guide.md`, la fila de PROD para InciTrack sigue en `(TBD)` — la promoción a producción todavía no está planeada formalmente, así que estos puntos hay que cerrarlos antes de que eso avance.

---

## Línea de tiempo

| Cuándo | Qué pasó |
|---|---|
| 2026-07-01 20:28 UTC | Se edita `grancrm/incitrack/.env` (rotación de credencial de BD, `DB_PASSWORD`) |
| 2026-07-01 20:30 UTC | Se reinicia el contenedor `grancrm-incitrack` (94 segundos después del edit) |
| 2026-07-01 20:30 → 2026-07-02 ~10:15 (17h) | Todas las operaciones que tocan la BD de InciTrack fallan con `Login failed for user 'incitrack_login' (18456)`. Cualquier intento de login SSO revienta en `_sync_user()` al hacer `get_or_create` |
| 2026-07-02 ~10:12 | Mauricio reporta el error rojo que lo expulsa de la página |
| 2026-07-02 10:15 | Se corrige `DB_PASSWORD` en `.env` y se recrea el contenedor → BD reconectada |
| 2026-07-02 10:18–10:19 | Reintento de Mauricio → ahora falla distinto: `401 Unauthorized: /incitrack/api/dashboard/` |
| 2026-07-02 ~10:20 | Se descubre que `GRANCRM_APP_ID` (default hardcodeado = 4) no coincide con el id real de InciTrack en el orquestador (= 5) → el chequeo de autorización del SSO fallaba para **cualquier** usuario |
| 2026-07-02 10:23 | Se corrige `GRANCRM_APP_ID`, se recrea el contenedor → reintento de Mauricio ahora da `404 Not Found` en vez de `401` |
| 2026-07-02 ~10:25 | Se descubre que el bundle de frontend desplegado (`App-BHrhme6z.js`, compilado 2026-06-12) llama a `/incitrack/api/dashboard/` sin `/v1/`, mientras el backend solo expone `/incitrack/api/v1/...` desde hace semanas |
| 2026-07-02 14:28 UTC | Se reconstruye y despliega el frontend (`pnpm build` → `staticfiles/mf/incitrack/`) |
| 2026-07-02 14:29 | Primer reintento sigue fallando — pestaña del navegador tenía el JS viejo en memoria |
| 2026-07-02 (confirmado) | Mauricio hace hard-refresh → **funciona correctamente** |

---

## Causa raíz 1 — Credencial de BD inválida

**Síntoma:** cualquier acción de InciTrack que tocara la base de datos fallaba.

```
InterfaceError('28000', "...Login failed for user 'incitrack_login'. (18456) (SQLDriverConnect)")
```

**Causa:** `DB_PASSWORD` en `incitrack/.env` se editó el 2026-07-01 20:28 UTC (rotación de credencial) y el contenedor se reinició 94 segundos después, pero el valor nuevo no era válido contra SQL Server (typo, o el password no se había actualizado del lado de SQL Server todavía).

**Por qué nadie lo notó antes:** el contenedor sigue "Up" aunque la BD esté inaccesible — Docker no lo marca unhealthy porque no hay healthcheck configurado (ver mejoras). Nadie más intentó loguearse a InciTrack en esas 17 horas.

**Fix aplicado:** corregir `DB_PASSWORD` en `.env` y recrear el contenedor.

---

## Causa raíz 2 — `GRANCRM_APP_ID` desincronizado

**Síntoma:** con la BD ya funcionando, el login seguía fallando con `401 Unauthorized` en cualquier llamada a `/incitrack/api/...`.

**Causa:** en `tickets/grancrm_session.py`:

```python
INCITRACK_APP_ID = getattr(settings, 'GRANCRM_APP_ID', 4)
```

`settings.py` **nunca leía `GRANCRM_APP_ID` del entorno** (a diferencia de `GRANCRM_JWT_SECRET` y `GRANCRM_ORCHESTRATOR_URL`, que sí estaban cableados dos líneas más abajo). Entonces `settings.GRANCRM_APP_ID` no existía como atributo, y `getattr` siempre devolvía el default `4` — sin importar lo que dijera `.env`.

En el Orquestador, el registro `Aplicacion` de InciTrack **hoy tiene `id=5`**. No existe ningún `Aplicacion` con `id=4` (los ids activos son 1, 2, 3, 5) — probablemente esa fila se borró y se volvió a crear en algún momento, y nadie propagó el cambio a InciTrack.

Resultado: `INCITRACK_APP_ID (4) not in payload["apps"] ([5, ...])` → siempre `True` → **401 para absolutamente todos los usuarios**, sin importar sus permisos.

**Fix aplicado:**
1. Cablear la variable en `settings.py`:
   ```python
   GRANCRM_APP_ID = int(os.environ.get('GRANCRM_APP_ID', '4'))
   ```
2. Corregir `.env`: `GRANCRM_APP_ID=5`
3. Recrear el contenedor.

---

## Causa raíz 3 — Frontend desactualizado respecto al backend

**Síntoma:** con BD y autorización ya funcionando, ahora daba `404 Not Found` en `/incitrack/api/dashboard/`, `/incitrack/api/tickets/`, `/incitrack/api/categorias/`, `/incitrack/api/admin/usuarios/`, `/incitrack/api/admin/cuentas/`.

**Causa:** el bundle desplegado en `staticfiles/mf/incitrack/assets/App-BHrhme6z.js` estaba compilado el **2026-06-12** y llamaba a esas rutas **sin** el prefijo `/v1/`. El código fuente actual (`frontend/src/api.ts`) ya arma las URLs como `/incitrack/api/v1/...`, que es lo único que expone `urls.py` (`path('incitrack/api/v1/', ninja_api.urls)`) desde hace semanas. El frontend nunca se volvió a compilar/desplegar después de que el backend migró su API a `v1`.

**Por qué nadie lo notó antes:** InciTrack todavía se sirve mayoritariamente vía las vistas clásicas de Django con el tema Duralux (`tickets/views.py` + templates) — el frontend React/MF (`frontend/src`) solo se usa para el panel de administración (dashboard, tickets, admin de usuarios/cuentas). Si nadie con rol admin había entrado desde el 12 de junio, el bug quedó invisible.

**Fix aplicado:**
```bash
export PATH="/home/admincrm/.node20/bin:$PATH"
cd /home/admincrm/grancrm/incitrack/frontend
pnpm install   # requirió arreglar pnpm-workspace.yaml, ver más abajo
pnpm build     # outDir → /home/admincrm/staticfiles/mf/incitrack (emptyOutDir: true)
```

**Bloqueador encontrado en el camino:** `pnpm install` fallaba con `ERR_PNPM_INVALID_WORKSPACE_CONFIGURATION (packages field missing or empty)` porque `frontend/pnpm-workspace.yaml` solo tenía `allowBuilds: esbuild: true` sin la clave `packages` que pnpm 10 exige. Se agregó:
```yaml
packages:
  - '.'

allowBuilds:
  esbuild: true
```

**Otro hallazgo menor:** la documentación (`docs/microfrontend-handoff.md`) indica correr `source /home/admincrm/.nvm/nvm.sh`, pero ese archivo **no existe** en este servidor. Node/pnpm reales están en `/home/admincrm/.node20/bin`. Doc desactualizada — corregir.

**Nota sobre el hard-refresh:** el primer reintento después del build siguió fallando porque la pestaña del navegador ya tenía el JS viejo cargado en memoria (no relee el bundle solo por reintentar dentro de la SPA). Los chunks con hash en el nombre (`App-<hash>.js`) sí tienen caché `immutable` de 1 año en nginx, pero eso no es un problema porque el hash cambia en cada build — el problema fue puramente que el navegador no había vuelto a pedir `index.html`/`remoteEntry.js` en esa sesión.

---

## Sobre el logo "Duralux" arriba a la izquierda

No es un efecto de este incidente. Según `docs/microfrontend-handoff.md`, InciTrack todavía se integra al shell del Orquestador como **iframe transitorio** (`nginx: location /incitrack/ { proxy_pass :8000 }`), no como `spa_remote` nativo — el navegador carga la página completa de InciTrack (con su propio header/logo Duralux) dentro de un iframe, en vez de que el shell monte el componente React vía Module Federation.

**Dato para la migración pendiente:** el registro `Aplicacion` de InciTrack en el Orquestador ya tiene `modo='spa_remote'` y `remote_entry_url='/mf/incitrack/remoteEntry.js'` configurados — es decir, el lado del Orquestador está listo para consumirlo como remoto nativo. Lo que falta es el lado de nginx/shell (que hoy sigue haciendo el proxy directo tipo iframe) y probablemente algo de wiring en el shell para montar el remoto. Vale la pena retomar esa migración — ver `docs/microfrontend-handoff.md` línea 36.

---

## Checklist para que esto no vuelva a pasar en producción

- [ ] **Antes de rotar cualquier credencial de BD en `.env`:** validar la conexión con la credencial nueva *antes* de reiniciar el contenedor (`docker exec <cont> python manage.py shell -c "from django.db import connection; connection.cursor()"` en un contenedor de prueba, o confirmar con quien administra SQL Server que el cambio ya se aplicó del lado del servidor). No editar `.env` y reiniciar en el mismo minuto sin haber probado.
- [ ] **Recordar la diferencia entre `restart` y recrear:** `docker compose restart <servicio>` **no vuelve a leer `env_file`** (las variables quedan fijas desde que se creó el contenedor). Para que un cambio en `.env` tenga efecto hay que usar `docker compose up -d --force-recreate <servicio>`. Para cambios en archivos bind-mounteados como `settings.py`/`urls.py`, un `restart` normal sí alcanza (el archivo en disco ya cambió).
- [ ] **Cada vez que cambie el prefijo o versión de la API del backend** (ej. agregar `/v1/`), el rebuild+deploy del frontend correspondiente debe ir en el **mismo PR/checklist de release** — no son dos tareas separadas.
- [ ] **Health check post-deploy obligatorio:** después de tocar InciTrack (backend o frontend), correr como mínimo:
  ```bash
  docker exec grancrm-incitrack python manage.py shell -c "from django.db import connection; connection.cursor().execute('SELECT 1')"
  curl -sk -o /dev/null -w "%{http_code}\n" https://<host>/incitrack/api/v1/dashboard/   # debe dar 401 (no 404, no 500)
  ```
- [ ] **Si se borra/recrea una fila de `Aplicacion` en el Orquestador** (en vez de editarla in-place), avisar a todas las apps satélite que dependen de su `id` — hoy eso es 100% manual y silencioso.
- [ ] Antes de dar por buena una corrección en el navegador, pedir **hard refresh** (Ctrl+Shift+R) explícitamente, no solo "reintentar" — evita falsos negativos como el que pasó en este incidente.

---

## Mejoras propuestas — InciTrack

1. **No usar IDs numéricos hardcodeados para `GRANCRM_APP_ID`.** El modelo `Aplicacion` del Orquestador ya tiene un campo `slug` (`incitrack` en este caso). Sería más robusto resolver el id por slug en el arranque de InciTrack (vía el endpoint interno `/internal/...` que ya expone el Orquestador) en vez de fijar un número mágico en `.env` que puede quedar desactualizado sin que nadie lo note.
2. **Fallar ruidosamente, no en silencio.** Hoy, si `GRANCRM_APP_ID` está mal, el síntoma es un 401 genérico e indistinguible de "sesión expirada" real. Convendría loguear explícitamente cuando el check de `apps` falla (qué id se esperaba vs. qué ids trae el JWT), para que el próximo incidente se diagnostique en minutos y no en una hora.
3. **Healthcheck de Docker para el contenedor de InciTrack** que incluya una query real a la BD (`SELECT 1`), no solo que el proceso esté vivo. Así Docker/monitoring detecta el escenario de "contenedor Up pero BD inaccesible" sin depender de que un usuario reporte el error.
4. **Automatizar el build+deploy del frontend** en vez de hacerlo a mano: un script (o step de CI) que corra `pnpm install && pnpm build` y, si falla o el smoke test post-deploy no pasa, no reemplace los archivos en `staticfiles/mf/incitrack/`. Esto también hubiera evitado depender de arreglar `pnpm-workspace.yaml` a mano en medio de un incidente.
5. **Arreglar `pnpm-workspace.yaml`** (ya corregido en esta sesión — agregado `packages: ['.']`) y **corregir `docs/microfrontend-handoff.md`** para que apunte a `/home/admincrm/.node20/bin` en vez de `~/.nvm/nvm.sh`, que no existe en este servidor.
6. **Smoke test post-deploy** que pegue a un par de endpoints clave (`/incitrack/api/v1/dashboard/`, etc.) y verifique que el código HTTP sea el esperado (401 sin sesión, no 404/500), corriendo automáticamente después de cada `pnpm build` + restart.

## Mejoras propuestas — Orquestador

1. **El contrato de `apps` en el JWT usa el `id` numérico de `core_aplicacion`.** Es fráncamente frágil: si una fila se borra y se re-crea, el id cambia y cualquier app satélite con el id viejo hardcodeado queda rota sin ningún aviso. El modelo ya tiene `slug` (único, estable) — considerar incluir también `apps_slugs` en el payload del JWT, o documentar fuertemente que `Aplicacion` nunca debe borrarse/recrearse, solo editarse in-place.
2. **El campo `Aplicacion.modo` de InciTrack ya dice `spa_remote`** (con `remote_entry_url` configurado), pero nginx todavía lo sirve como iframe/proxy directo (`location /incitrack/ { proxy_pass :8000 }`), y no hay evidencia de que el shell realmente esté consumiendo el remoto vía Module Federation. Ese desfase entre "lo que dice la config" y "lo que realmente pasa en producción" es confuso — vale la pena o bien completar la migración a `spa_remote` real (ver `docs/microfrontend-handoff.md`), o volver `modo` a `iframe` mientras tanto para que la config no mienta.
3. **La caché de `remoteEntry.js` en nginx ya está bien resuelta** (regla regex `location ~ ^/mf/[^/]+/remoteEntry\.js$` con `no-store`, aplicada de forma genérica a todos los MF remotes) — se verificó explícitamente durante este incidente que **no** es la causa de bundles viejos servidos con caché larga. No hace falta tocar nada ahí; lo dejo anotado para que quede claro que se revisó y está bien, por si alguien lo sospecha en el futuro.
4. **Exponer en el panel SA o en `/internal/`** una forma rápida de ver "qué app satélite tiene qué `GRANCRM_APP_ID` configurado" vs. el id real en `core_aplicacion`, para detectar este tipo de desincronización de forma proactiva en vez de reactiva.

---

## Apéndice — comandos usados en el diagnóstico y fix

```bash
# Diagnóstico BD
docker exec grancrm-incitrack python manage.py shell -c "
from django.db import connection
with connection.cursor() as c:
    c.execute('SELECT 1'); print(c.fetchone())
"

# Recrear contenedor tras editar .env (restart NO relee env_file)
cd /home/admincrm/grancrm
docker compose up -d --force-recreate incitrack-modulo

# Verificar accesos/permisos de un usuario en el Orquestador
docker exec orquestador-web-1 python manage.py shell -c "
from core.models import Usuario, Aplicacion, AccesoAplicacion
u = Usuario.objects.get(email__iexact='<email>')
app = Aplicacion.objects.get(slug='incitrack')
print(AccesoAplicacion.objects.filter(usuario=u, aplicacion=app).exists())
"

# Rebuild + deploy del frontend MF de InciTrack
export PATH="/home/admincrm/.node20/bin:$PATH"
cd /home/admincrm/grancrm/incitrack/frontend
pnpm install
pnpm build   # outDir → /home/admincrm/staticfiles/mf/incitrack

# Smoke test de rutas API
curl -sk -o /dev/null -w "%{http_code}\n" https://127.0.0.1/incitrack/api/v1/dashboard/   # esperado: 401
```
