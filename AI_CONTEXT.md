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
     - **Ruta QA**: `cd /home/admincrm/grancrm`
     - **Ruta Producción**: (Por definir en la máquina productiva)

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

- **Compilar frontend en QA**: No existe un contenedor de frontend. Se debe compilar en el host y luego reconstruir el contenedor de backend que lo absorbe:
  1. `cd incitrack/frontend`
  2. `export PATH="/home/admincrm/.node20/bin:$PATH"`
  3. `pnpm install && pnpm build`
  4. `cd ../..` (volver a la raíz del ecosistema)
  5. `sudo docker compose up -d --build incitrack-modulo`
- **Caché en navegador**: Siempre pedir al usuario vaciar caché (F12 -> Cargar de forma rígida) al actualizar UI.
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

---

## 📌 Próximos Pasos (Paso a Producción):
1. **Configuración de Producción**: La base de datos será `172.20.21.3`, IP física `172.20.21.10`, y la URL será `https://dash.in-touchcrm.cl/login/?next=%2F`.
2. **Archivos Base**: Usar la carpeta `PRODUCCION/` local para almacenar `dios_incitrack.json`, `env_incitrack` u otros configurables para clonar a producción fácilmente.
3. **Desactivar modo compatibilidad JWT**: Cuando el equipo del Orquestador esté listo, se puede cambiar `JWT_ROLES_COMPAT=False` para que el JWT envíe los roles reales directamente en el campo `rol`. InciTrack ya soporta ambos modos gracias al fallback `rol_real → rol`.

