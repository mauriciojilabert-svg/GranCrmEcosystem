# Contexto para el Asistente de IA (Antigravity / Gemini)

**Por favor, lee esta información antes de proponer comandos o sugerir flujos de trabajo:**

1. **Entorno Local vs. Servidor**: Los archivos en este directorio (`c:\Users\Mauricio\Documents\GRANCRMecosystem`) representan el entorno de desarrollo local en Windows.
2. **Estructura del Repositorio Git**: 
   - La raíz del repositorio rastrea la carpeta `grancrm` y otras carpetas troncales (`248`, `PRODUCCION`).
   - La carpeta `249` (QA/Desarrollo) es **estrictamente local** y ha sido añadida a `.gitignore`. NUNCA se debe subir a GitHub.
3. **Flujo de Trabajo (Vía GitHub)**:
   - Se realizan los cambios de código a nivel local.
   - **Subir cambios**: Se realiza commit y `git push` a la rama `main` en GitHub.
   - **Bajar cambios en Servidores**: Se accede al servidor mediante PuTTY, se realiza `git pull` en la carpeta correcta y se compila/reinicia Docker.
     - **Ruta QA/Producción**: `cd /var/www/dash/grancrm`
     - **Git pull requiere sudo**: `sudo git pull origin main` (la carpeta `/var/www/` pertenece a `root`)

---

## Descubrimientos y Reglas Arquitectónicas (InciTrack V2):

### 1. Mapeo de Roles y JWT del Orquestador

El Orquestador tiene un **modo de compatibilidad JWT** (`JWT_ROLES_COMPAT=True` en `core/jwt_utils.py`) que transforma los roles reales antes de enviarlos en el JWT:

**Mapeo de compatibilidad del Orquestador (`_ROL_JWT_COMPAT`):**
| Rol real (Orquestador BD) | Rol en JWT campo `rol` | Rol en JWT campo `rol_real` |
|---|---|---|
| `agente` | `ejecutivo` | `agente` |
| `supervisor` | `ejecutivo` | `supervisor` |
| `admin_cuenta` | `admin` | `admin_cuenta` |
| `admin_ti` | `sa` | `admin_ti` |

**IMPORTANTE**: InciTrack debe leer **`rol_real`** del JWT (no `rol`) para obtener el rol verdadero. El campo `rol` contiene el valor de compatibilidad que NO sirve para el mapeo correcto. Esto se corrigió en `tickets/grancrm_session.py` línea 140:
```python
grancrm_rol = payload.get("rol_real", payload.get("rol", ""))
```

**Mapeo InciTrack (`_ROLE_MAP` en `tickets/grancrm_session.py`):**
- `agente` (Orquestador) → **Bloqueado** con HTTP 403.
- `admin_ti` (Orquestador) → `admin` (InciTrack = "Admin TI").
- `admin_cuenta` (Orquestador) → `jefe` (InciTrack = "Jefe de Cuenta").
- `supervisor` (Orquestador) → `supervisor` (InciTrack = "Supervisor").

El Orquestador también puede entregar roles con sufijos numéricos (ej: `admin_0`, `sa_4`). InciTrack separa el prefijo base con regex.

- **Delegación**: El Orquestador maneja la autenticación y creación de usuarios. InciTrack solo los recibe y sincroniza en cada inicio de sesión.
- **Sincronización**: El middleware `GranCRMSessionMiddleware` re-sincroniza nombre, rol y permisos del usuario cada vez que detecta un cambio en el email del JWT vs. la sesión actual de Django.

### 2. Base de Datos: InciTrack NO es Multi-Tenant

InciTrack tiene **una sola base de datos** propia. El `TenantDatabaseRouter` (`utils/tenant_router.py`) debe **siempre retornar `'default'`** para todas las operaciones de lectura y escritura:

```python
class TenantDatabaseRouter:
    def db_for_read(self, model, **hints):
        return 'default'
    def db_for_write(self, model, **hints):
        return 'default'
```

**⚠️ NO modificar esto.** El `TenantDatabaseMiddleware` sigue en el stack de middlewares porque otros módulos del ecosistema GranCRM podrían necesitarlo, pero InciTrack lo ignora a nivel de router. Si se cambia el router para usar `get_current_db()`, usuarios de otros tenants recibirán `Error 500: Invalid object name 'tickets_ticket'` porque sus BDs de tenant no tienen las tablas de InciTrack.

### 3. Arquitectura de Cuenta → Jefe → Supervisores

En InciTrack V2 (React), la asociación de roles se centraliza en la **Cuenta (Cliente)**:

- **Cuenta** tiene un campo `jefe` (FK a Usuario con `rol='jefe'`).
- **Cuenta** tiene un campo `supervisores` (M2M a Usuarios con `rol='supervisor'`).
- **NO existe** un panel de "Supervisores asignados" directamente en el perfil del Jefe (eso era de la versión antigua Django/admin-panel).
- El Jefe hereda automáticamente acceso a todos los Tickets y Supervisores de sus Cuentas asignadas.
- Los Supervisores se asignan a Cuentas desde su propio formulario de edición de usuario (checkboxes de "Cuentas asignadas", visibles solo cuando `rol === 'supervisor'`).

### 4. Sidebar del Frontend React

El sidebar se controla en `frontend/src/App.tsx` y muestra ítems según el rol del usuario:

| Ítem | Admin TI | Jefe de Cuenta | Supervisor |
|---|---|---|---|
| Dashboard | ✅ | ✅ | ✅ |
| Tickets | ✅ | ✅ | ✅ |
| Nuevo Ticket | ✅ | ✅ | ✅ |
| Cuentas | ✅ | ❌ | ❌ |
| Usuarios | ✅ | ❌ | ❌ |
| Config SLA | ✅ | ❌ | ❌ |
| Notificaciones | ✅ | ❌ | ❌ |

**IMPORTANTE**: Supervisores y Jefes de Cuenta **no deben ver** la pestaña de Notificaciones (no tienen acceso y solo verían un mensaje de error). Este filtrado se aplica directamente en el frontend React.

El menú lateral no solo depende de `dios.json`. El frontend en React inyecta dinámicamente los ítems a través de `window.parent.postMessage({ type: 'grancrm:nav', items: ... })`.

### 5. Configuración de `dios.json`

- `dios.json` controla los ítems del sidebar del Orquestador.
- Requiere `url_interna`, `url_publica`, `source_db` correctos según el entorno.
- Cada vez que se modifica, se debe reiniciar InciTrack (`sudo docker compose restart incitrack-modulo`) para que se dispare `dios_registration.py`.

### 6. Migraciones de BD

Al desplegar código que modifique modelos (ej. Categorías dinámicas), es obligatorio ejecutar:
`sudo docker compose exec incitrack-modulo python manage.py migrate`

### 7. Variables de Entorno (`.env`)

- **No confundir** `DB_PASSWORD` con `GRANCRM_JWT_SECRET`.
- Modificar `.env` requiere **`sudo docker compose up -d`** (restart no basta).

### 8. Frontend React y Caché

- **Compilar frontend en QA/Producción**: No existe un contenedor de frontend. Se debe compilar en el host y luego reconstruir el contenedor de backend que lo absorbe:
  1. `cd /var/www/dash/grancrm/grancrm/incitrack/frontend`
  2. Cargar Node.js 20 vía `nvm`:
     ```bash
     export NVM_DIR="$HOME/.nvm"
     [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
     nvm use 20
     ```
  3. `pnpm install && pnpm build`
  4. `cd /var/www/dash/grancrm/grancrm` (donde está `docker-compose.yml`)
  5. `sudo docker compose up -d --build incitrack-modulo`
- **Caché en navegador**: Siempre pedir al usuario vaciar caché (F12 -> Cargar de forma rígida, o `Ctrl+Shift+R`) al actualizar UI.
- Para respuestas de Django Ninja con atributos vacíos, usar `response={200: dict}` para evitar que Pydantic omita claves.
- El pegado de imágenes (Ctrl+V) está soportado visualmente tanto en creación de tickets (`TicketFormPage`) como en comentarios (`TicketDetailPage`).

### 9. Categorías y Subcategorías (Base de Datos)

Las categorías son dinámicas (modelo `Categoria` en BD, no hardcodeadas). Para renombrar una categoría o subcategoría, se hace directamente en la BD sin tocar código:

```bash
# Ejemplo: Renombrar categoría
sudo docker compose exec incitrack-modulo python manage.py shell -c \
  "from tickets.models import Categoria; Categoria.objects.filter(nombre='NombreViejo').update(nombre='NombreNuevo', slug='nombre-nuevo')"

# Ejemplo: Renombrar subcategoría
sudo docker compose exec incitrack-modulo python manage.py shell -c \
  "from tickets.models import Subcategoria; Subcategoria.objects.filter(nombre='NombreViejo').update(nombre='NombreNuevo', slug='nombre-nuevo')"
```

**Cambios realizados (2026-08-11):**
- Categoría "Hardware" → "Equipamiento e Insumos"
- Subcategoría "Cintillo" → "Cintillo Telefónico"

### 10. Servicio de Correos

- `email_service.py` corre en `threading.Thread`.
- Los fallos quedan en `docker logs`. Envía a Jefe de Cuenta y Admins TI asociados.

### 11. Cadena de Middlewares (orden en `settings.py`)

```python
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'grancrm_auth.middleware.GranCRMAuthMiddleware',      # 1. Decodifica JWT (BYPASS firma en QA)
    'tickets.grancrm_session.GranCRMSessionMiddleware',   # 2. Sincroniza usuario y rol
    'utils.tenant_middleware.TenantDatabaseMiddleware',    # 3. Switch de BD tenant (ignorado por router)
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
```

**Orden importante**: La sincronización del usuario (paso 2) ocurre ANTES del switch de BD tenant (paso 3), por lo que el usuario siempre se guarda en la BD `default` de InciTrack.

### 12. Rutas del Servidor y Permisos

**Estructura de rutas en el servidor (QA/Producción):**

| Recurso | Ruta en servidor |
|---|---|
| Raíz del repositorio | `/var/www/dash/grancrm` |
| Código InciTrack (backend) | `/var/www/dash/grancrm/grancrm/incitrack` |
| Frontend (fuentes) | `/var/www/dash/grancrm/grancrm/incitrack/frontend` |
| `docker-compose.yml` | `/var/www/dash/grancrm/grancrm/docker-compose.yml` |
| Archivos estáticos compilados | `/home/admincrm/staticfiles/mf/incitrack/` |
| Orquestador | `/home/admincrm/orquestador/` |
| Node.js 20 (vía nvm) | `$HOME/.nvm/versions/node/v20.x.x/` |

**Permisos y `sudo`:**

- La carpeta `/var/www/dash/` pertenece a `root`. Operaciones de git requieren `sudo`:
  ```bash
  sudo git pull origin main
  ```
- El frontend necesita que el usuario `admincrm` tenga permisos de escritura para compilar. Si `pnpm install` falla con `EACCES`, corregir con:
  ```bash
  sudo chown -R admincrm:admincrm /var/www/dash/grancrm/grancrm/incitrack/frontend
  ```
- Docker compose siempre se ejecuta con `sudo`:
  ```bash
  sudo docker compose up -d --build incitrack-modulo
  ```

**Node.js en el servidor:**

- La carpeta `/home/admincrm/.node20/` ya **no existe**. Node.js 20 fue instalado vía `nvm` (Node Version Manager) el 13/Ago/2026.
- Para usar Node.js y `pnpm` en cualquier sesión de PuTTY:
  ```bash
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  nvm use 20
  ```
- `pnpm@9.1.0` es la versión declarada en `package.json`. Si no está instalado:
  ```bash
  npm install -g pnpm@9.1.0
  ```

**Comando rápido de despliegue completo (copiar/pegar en PuTTY):**

```bash
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use 20 && cd /var/www/dash/grancrm && sudo git pull origin main && sudo chown -R admincrm:admincrm grancrm/incitrack/frontend && cd grancrm/incitrack/frontend && pnpm install && pnpm build && cd /var/www/dash/grancrm/grancrm && sudo docker compose up -d --build incitrack-modulo
```

---

## 📌 Próximos Pasos (Paso a Producción):
1. **Configuración de Producción**: La base de datos será `172.20.21.3`, IP física `172.20.21.10`, y la URL será `https://dash.in-touchcrm.cl/login/?next=%2F`.
2. **Archivos Base**: Usar la carpeta `PRODUCCION/` local para almacenar `dios_incitrack.json`, `env_incitrack` u otros configurables para clonar a producción fácilmente.
3. **Desactivar modo compatibilidad JWT**: Cuando el equipo del Orquestador esté listo, se puede cambiar `JWT_ROLES_COMPAT=False` para que el JWT envíe los roles reales directamente en el campo `rol`. InciTrack ya soporta ambos modos gracias al fallback `rol_real → rol`.

---

## 🚀 Estado Actual (Cierre 12 Ago 2026)

**Aprendizajes Críticos de Arquitectura y Despliegue en Producción:**

1. **Cloudflare Cache & Module Federation (Error 522 / "Script error"):** 
   - Cloudflare cachea agresivamente los archivos de Module Federation (`remoteEntry.js`). Esto causa bloqueos y errores 522/520 silenciosos que impiden que el módulo cargue.
   - **Solución implementada:** Se debe inyectar una regla en Nginx (`location /mf/incitrack/`) que incluya `add_header Cache-Control "no-cache, must-revalidate";` para forzar a Cloudflare a ir siempre al servidor de origen (Bypass de caché).

2. **Nginx, Docker y Bind Mounts (Archivos Fantasma):**
   - El archivo `/etc/nginx/nginx.conf` dentro del contenedor `dash-gateway` es un "bind mount" de Solo Lectura (`ro`) hacia `/var/www/dash/gateway/nginx/nginx.conf` en el host.
   - Si se edita el archivo en el host usando scripts (Python `open().write()` o editores que cambian el inodo del archivo), el contenedor de Docker **ignora los cambios** y sigue leyendo el inodo antiguo en la memoria RAM.
   - Consecuencia: Hacer `docker exec dash-gateway nginx -s reload` NO recarga los cambios hechos en el host.
   - **Regla de oro:** Siempre se debe reiniciar el contenedor completo (`sudo docker restart dash-gateway`) después de modificar el archivo `nginx.conf` en el host para que el contenedor monte el inodo nuevo.

3. **Sintaxis Estricta de Nginx:**
   - Nginx se rehúsa a arrancar (Error 521 de Cloudflare, `emerg` en logs) si existen bloques `location` afuera del bloque principal `server { ... }`.
   - Al inyectar reglas, SIEMPRE hay que asegurarse de que queden dentro del bloque del servidor y que la llave final del bloque `http` no se rompa o se elimine por error.

4. **Sincronización de Base de Datos (Django y SQL Server):**
   - El ecosistema usa SQL Server. Si se introducen nuevos campos en el código (ej. `contenido` en `tickets_comentario`) y las migraciones no están sincronizadas, la aplicación arrojará **HTTP 500** (`Invalid column name`).
   - Las migraciones `0001_initial` en InciTrack fueron "generadas a mano". Si el campo se agrega directamente al código y al archivo `0001_initial.py` en lugar de generar una migración nueva (vía `makemigrations`), Django creerá falsamente que el esquema ya está aplicado en SQL Server.
   - **Solución temporal:** Inyectar las columnas ausentes usando `ALTER TABLE` directamente en la base de datos (vía `python manage.py shell`).
   - **Regla de oro:** JAMÁS modificar archivos de migración viejos si ya fueron ejecutados en la base de datos productiva. Siempre generar migraciones nuevas (`0004`, `0005`, etc.).

**Estado en Vivo (ÉXITO TOTAL - 12 Ago 2026):**
- El Orquestador ahora enruta exitosamente las peticiones del frontend MFE (`remoteEntry.js`) sin bloqueos de Cloudflare gracias al Bypass de caché.
- Nginx en el `dash-gateway` de producción está correctamente configurado (bloques `location` anidados correctamente) y el contenedor ha sido reiniciado. El proxy-pass hacia el backend de InciTrack (`127.0.0.1:8000`) funciona perfecto.
- Se resolvieron los errores 500 (desincronización fantasma de migraciones en SQL Server) inyectando manualmente las columnas faltantes (`contenido`, `fecha`, `interno` en la tabla `tickets_comentario`) vía sentencias `ALTER TABLE` en el shell de Django.
- El Dashboard de InciTrack carga en producción sin errores, listando todos los tickets y estadísticas correctamente. ¡Despliegue a Producción Completado!

## 🚀 Actualización (13 Ago 2026): Troubleshooting Orquestador y Frontend React

5. **Recompilación Obligatoria del Frontend React:**
   - Hacer `git pull` y reiniciar los contenedores de backend (`docker restart`) **NO actualiza** la interfaz de React.
   - El código fuente `.tsx` debe ser compilado explícitamente en el servidor para que Nginx sirva los nuevos archivos estáticos en `/home/admincrm/staticfiles/mf/incitrack/`.
   - **Regla de oro:** Al subir cambios visuales (frontend), SIEMPRE se debe ejecutar:
     ```bash
     cd /var/www/dash/grancrm/grancrm/incitrack/frontend
     pnpm install && pnpm build
     ```

6. **Error de Montaje Falso en Docker (`not a directory`):**
   - Si el Orquestador falla al arrancar con el error `Are you trying to mount a directory onto a file?` sobre `tenants.json`, significa que el archivo original no existía en el host al momento de arrancar el contenedor.
   - Docker asume erróneamente que es una carpeta y crea un directorio vacío con ese nombre, corrompiendo el montaje.
   - **Solución:** Borrar la carpeta falsa (`rm -rf tenants.json`) y crear un archivo válido vacío (`echo "{}" > tenants.json`) antes de reiniciar el contenedor.

7. **Registro Silencioso en DIOS (`dios.json`):**
   - InciTrack intenta registrarse en el Orquestador al arrancar enviando su configuración a `http://orquestador:9000`.
   - Dado que InciTrack usa `network_mode: host`, no puede resolver el hostname `orquestador` (falla el DNS interno de Docker) y el registro **falla silenciosamente**.
   - **Solución Permanente:** Se debe agregar `DIOS_URL=http://127.0.0.1:9000` en el `.env` de InciTrack.
   - **Solución Rápida (Bypass sin reinicio):** Se puede inyectar la configuración directamente enviando un curl desde el host:
     ```bash
     curl -X POST http://127.0.0.1:9000/internal/register-app/ -H "Content-Type: application/json" -d @/var/www/dash/grancrm/grancrm/incitrack/dios.json
     ```
