# Contexto para el Asistente de IA (Antigravity / Gemini)

**Por favor, lee esta información antes de proponer comandos o sugerir flujos de trabajo:**

1. **Entorno Local vs. Servidor**: Los archivos en este directorio (`c:\Users\Mauricio\Documents\admincrm\grancrm\incitrack\...`) son una **copia local** de los archivos reales que están en el servidor de desarrollo/producción.
2. **Sin Ejecución Local Directa**: No debes sugerir que el usuario corra comandos localmente (como `npm run build` o `npm start` en Windows) a menos que se te pida explícitamente.
3. **Flujo de Trabajo del Usuario (Despliegue Manual)**:
   - El asistente de IA debe modificar los archivos localmente.
   - Una vez listos, **el usuario utiliza WinSCP para subir los archivos modificados** manualmente al servidor.
   - Luego, **el usuario utiliza PuTTY para conectarse por SSH al servidor** (`admincrm@GranCRM-DEV`) y ejecutar comandos como `npm run build`.
4. **Respuestas Esperadas**:
   - Cuando hagas cambios en múltiples archivos, proporciona la lista clara de los archivos modificados con sus rutas completas.
   - Pide al usuario que suba esos archivos específicos vía WinSCP.
   - Si se requiere un comando posterior (ej. reconstruir el proyecto o reiniciar un servicio), indícalo para que el usuario lo corra en su consola de PuTTY.

---

## Estado Actual de QA (Última sesión)
- **Problema Principal Resuelto**: Se corrigió el archivo de configuración `nginx.conf` en el servidor QA (`gateway-nginx-1`) separando las rutas. Ahora `/incitrack/` carga la SPA de React correctamente.
- **Problema de Permisos Resuelto**: Se descubrió que el rol que entrega el Orquestador en QA para el perfil administrador es `admin_0` (en lugar de `admin` estricto).
  - Se modificaron localmente los componentes de React (`RoleGuard`, `DashboardPage`, `TicketListPage`, etc.) para soportar roles dinámicos (`admin_`, `sa_`).
  - Se añadió `admin_0` al archivo `dios.json` local.
- **Despliegue Parcial**: El usuario construyó el frontend en QA (`npm run build`) y copió el `dios.json` a la ruta de Nginx (`/home/admincrm/staticfiles/shell/incitrack/dios.json`). 
- **Síntoma Restante**: La SPA ya se muestra bien, pero el **sidebar lateral del Orquestador sigue incompleto** (faltan "Usuarios", "Cuentas", etc.).

## Siguientes pasos (Para la próxima sesión):
1. **Revisar caché agresiva**: Pedir al usuario que abra F12 y haga un "Vaciar caché y volver a cargar de forma rígida" en su navegador.
2. **Rastrear `dios.json`**: Si el menú sigue incompleto, revisar en la pestaña `Network (Red)` del navegador:
   - ¿Desde qué URL exacta se está intentando descargar `dios.json`?
   - Revisar el "Preview/Response" de esa petición para ver si está llegando el archivo viejo (sin `admin_0`) o el nuevo.
3. Corregir la ruta o el archivo en el servidor QA dependiendo de lo que descubramos en el punto 2.

## Descubrimientos Recientes (InciTrack V2 en QA):
1. **Mapeo de Roles Dinámicos en Backend**: El Orquestador entrega roles con sufijos (ej: `admin_0`, `sa_4`). El archivo `tickets/grancrm_session.py` de InciTrack DEBE separar el prefijo base para no rebajar por error a un admin al rol por defecto `supervisor`.
2. **Configuración de `dios.json` y el Sidebar**:
   - El Orquestador controla los ítems del sidebar (ej: Usuarios, Cuentas, Estadísticas) leyendo el archivo `dios.json` de cada módulo.
   - Si se añaden roles nuevos (como `admin_0`), **tienen que registrarse en el arreglo `"roles"`** de los endpoints en el `dios.json`.
   - `url_interna` debe apuntar al host correcto en QA (ej: `.249`).
   - `source_db` debe indicar la BD correspondiente al entorno (ej: `QAIntouch`).
   - Para que el Orquestador lea los cambios en `dios.json`, se debe subir el archivo al contenedor de InciTrack y **reiniciarlo** (`sudo docker compose restart incitrack-modulo`), lo que dispara la auto-sincronización (`utils/dios_registration.py`).
3. **Migraciones tras Despliegue**: Al subir código nuevo que incluya cambios en la BD (ej. nuevos campos `categoria`, `subcategoria`), es obligatorio ejecutar `sudo docker compose exec incitrack-modulo python manage.py migrate`. Si no se hace, los endpoints arrojarán HTTP 500 al consultar campos inexistentes.
4. **Variables de Entorno (`.env`) vs Containers**:
   - **No confundir** la contraseña de base de datos (`DB_PASSWORD`) con el secreto JWT (`GRANCRM_JWT_SECRET`). Pegar el JWT en el password de SQL Server causará `InterfaceError: Login failed`.
   - Cuando se edita el archivo `.env`, **`restart` no es suficiente**. Para que un contenedor tome variables nuevas, debe usarse obligatoriamente `sudo docker compose up -d`.
