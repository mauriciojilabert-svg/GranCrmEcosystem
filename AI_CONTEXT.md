# Contexto para el Asistente de IA (Antigravity / Gemini)

**Por favor, lee esta información antes de proponer comandos o sugerir flujos de trabajo:**

1. **Entorno Local vs. Servidor**: Los archivos en este directorio (`c:\Users\Mauricio\Documents\GRANCRMecosystem`) representan el entorno de desarrollo local en Windows.
2. **Sin Ejecución Local Directa**: No debes sugerir que el usuario corra comandos localmente (como `npm run build` o `npm start` en Windows) a menos que se te pida explícitamente.
3. **Flujo de Trabajo (Vía GitHub)**:
   - Se realizan los cambios de código a nivel local.
   - **Subir cambios**: Se realiza commit y `git push` a la rama `main` en GitHub.
   - **Bajar cambios en QA**: Se accede al servidor QA mediante PuTTY, se realiza `git pull` en la carpeta del proyecto, y se reinician los contenedores correspondientes (ej. `sudo docker compose up -d` o `sudo docker compose restart`).
4. **Respuestas Esperadas**:
   - Proporciona comandos de git precisos para subir los cambios locales a GitHub.
   - Indica los comandos de git y Docker correspondientes que el usuario debe ejecutar en su consola de PuTTY para descargar y desplegar los cambios en el servidor.

---

## Estado Actual de las Máquinas

### Computadora Local (Windows)
- **Repositorio Git**: Inicializado y conectado al origen remoto `https://github.com/mauriciojilabert-svg/GranCrmEcosystem.git` en la rama `main`.
- **Identidad del Autor**: Configurada localmente como:
  - Nombre: `Mauricio Cáceres Jilabert`
  - Correo: `mauriciocaceresj@gmail.com`
- **Archivos e Ignores**:
  - Excluido por completo el directorio `orquestador` (añadido a `.gitignore`).
  - Únicamente se realiza el rastreo e historial de los archivos y cambios de la aplicación `grancrm` (fases 248 y 249).
  - El primer commit con la estructura inicial fue subido de manera exitosa a GitHub.

### Servidor QA (Linux / Docker)
- **Modo de Despliegue**: Ahora utiliza Git como puente central en lugar de transferencias manuales por WinSCP.
- **Estado del Código**: Pendiente de realizar `git pull` para sincronizar con la estructura limpia subida a GitHub.
- **Estado de la App**: 
  - Nginx configurado y `/incitrack/` cargando la SPA de React.
  - Sidebar del Orquestador incompleto, pendiente de sincronización final y limpieza de caché.

---

## Estado Técnico de QA (Última sesión)
- **Problema Principal Resuelto**: Se corrigió el archivo de configuración `nginx.conf` en el servidor QA (`gateway-nginx-1`) separando las rutas. Ahora `/incitrack/` carga la SPA de React correctamente.
- **Problema de Permisos Resuelto**: Se descubrió que el rol que entrega el Orquestador en QA para el perfil administrador es `admin_0` (en lugar de `admin` estricto).
  - Se modificaron localmente los componentes de React (`RoleGuard`, `DashboardPage`, `TicketListPage`, etc.) para soportar roles dinámicos (`admin_`, `sa_`).
  - Se añadió `admin_0` al archivo `dios.json` local.
- **Despliegue Parcial**: El usuario construyó el frontend en QA (`npm run build`) y copió el `dios.json` a la ruta de Nginx (`/home/admincrm/staticfiles/shell/incitrack/dios.json`). 
- **Síntoma Restante**: La SPA ya se muestra bien, pero el **sidebar lateral del Orquestador sigue incompleto** (faltan "Usuarios", "Cuentas", etc.).

## Siguientes pasos:
1. **Sincronizar el Servidor QA**: Ir a la carpeta del proyecto en QA y realizar `git pull` para bajar el repositorio limpio sin carpetas `.git` anidadas en `grancrm`.
2. **Revisar caché agresiva**: Pedir al usuario que abra F12 y haga un "Vaciar caché y volver a cargar de forma rígida" en su navegador.
3. **Rastrear `dios.json`**: Si el menú sigue incompleto, revisar en la pestaña `Network (Red)` del navegador:
   - ¿Desde qué URL exacta se está intentando descargar `dios.json`?
   - Revisar el "Preview/Response" de esa petición para ver si está llegando el archivo viejo (sin `admin_0`) o el nuevo.
4. Corregir la ruta o el archivo en el servidor QA dependiendo de lo que descubramos en el punto 2.

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
5. **Caché del Frontend y Mismatch de Modelos (Pydantic / Django Ninja)**:
   - En una SPA construida en React, si se hace `npm run build` o se hornea en una imagen Docker y NO se reconstruye la imagen tras un cambio en GitHub, el frontend queda "viejo" y sigue esperando variables antiguas (ej. `tickets_recientes` vs `tickets_urgentes`).
   - Al usar Django Ninja, si un endpoint define un esquema estricto (ej. `response={200: DashboardStatsOut}`), Pydantic puede filtrar y omitir campos en el JSON resultante si estos son arreglos vacíos o valores por defecto. Si el frontend espera que existan, leer su `.length` explotará con `Cannot read properties of undefined`.
   - **Solución Definitiva**: Para endpoints mixtos que necesitan entregar variables explícitamente vacías por compatibilidad hacia atrás, se debe cambiar el decorador a `response={200: dict}` para bypasear a Pydantic y forzar que Django Ninja devuelva el diccionario crudo tal como se programó.
7. **Ramas Paralelas para Experimentos (React UI)**:
   - Al realizar refactors mayores en React (como cambiar tablas estáticas a pestañas dinámicas con `useState`), siempre crear una rama de Git paralela (ej. `experiment/actividad-reciente`). Esto permite probar en QA sin comprometer la estabilidad del sistema y sin miedo a crasheos.
   - **Cuidado al inyectar código en componentes grandes**: Siempre verificar que no se redeclaren variables locales (ej. `const { session } = useSession()`) porque Vite abortará la compilación (`symbol already declared`).
8. **Botones de Toggle y Filtros de Dashboard**:
   - En lugar de redirigir, los interruptores visuales ("Ver todos") deben manejar parámetros en la URL (`searchParams.set('ver_todos', '1')`) para forzar al `useEffect` a recargar la API en la misma vista.
   - Modificar consultas backend en `api.py` para devolver `total_global` junto al `total_filtrado`, permitiendo a la UI mostrar la estadística de todos los tickets sin perder el filtro actual.
# Contexto para el Asistente de IA (Antigravity / Gemini)

**Por favor, lee esta información antes de proponer comandos o sugerir flujos de trabajo:**

1. **Entorno Local vs. Servidor**: Los archivos en este directorio (`c:\Users\Mauricio\Documents\GRANCRMecosystem`) representan el entorno de desarrollo local en Windows.
2. **Sin Ejecución Local Directa**: No debes sugerir que el usuario corra comandos localmente (como `npm run build` o `npm start` en Windows) a menos que se te pida explícitamente.
3. **Flujo de Trabajo (Vía GitHub)**:
   - Se realizan los cambios de código a nivel local.
   - **Subir cambios**: Se realiza commit y `git push` a la rama `main` en GitHub.
   - **Bajar cambios en QA**: Se accede al servidor QA mediante PuTTY, se realiza `git pull` en la carpeta del proyecto, y se reinician los contenedores correspondientes (ej. `sudo docker compose up -d` o `sudo docker compose restart`).
4. **Respuestas Esperadas**:
   - Proporciona comandos de git precisos para subir los cambios locales a GitHub.
   - Indica los comandos de git y Docker correspondientes que el usuario debe ejecutar en su consola de PuTTY para descargar y desplegar los cambios en el servidor.

---

## Estado Actual de las Máquinas

### Computadora Local (Windows)
- **Repositorio Git**: Inicializado y conectado al origen remoto `https://github.com/mauriciojilabert-svg/GranCrmEcosystem.git` en la rama `main`.
- **Identidad del Autor**: Configurada localmente como:
  - Nombre: `Mauricio Cáceres Jilabert`
  - Correo: `mauriciocaceresj@gmail.com`
- **Archivos e Ignores**:
  - Excluido por completo el directorio `orquestador` (añadido a `.gitignore`).
  - Únicamente se realiza el rastreo e historial de los archivos y cambios de la aplicación `grancrm` (fases 248 y 249).
  - El primer commit con la estructura inicial fue subido de manera exitosa a GitHub.

### Servidor QA (Linux / Docker)
- **Modo de Despliegue**: Ahora utiliza Git como puente central en lugar de transferencias manuales por WinSCP.
- **Estado del Código**: Pendiente de realizar `git pull` para sincronizar con la estructura limpia subida a GitHub.
- **Estado de la App**: 
  - Nginx configurado y `/incitrack/` cargando la SPA de React.
  - Sidebar del Orquestador incompleto, pendiente de sincronización final y limpieza de caché.

---

## Estado Técnico de QA (Última sesión)
- **Problema Principal Resuelto**: Se corrigió el archivo de configuración `nginx.conf` en el servidor QA (`gateway-nginx-1`) separando las rutas. Ahora `/incitrack/` carga la SPA de React correctamente.
- **Problema de Permisos Resuelto**: Se descubrió que el rol que entrega el Orquestador en QA para el perfil administrador es `admin_0` (en lugar de `admin` estricto).
  - Se modificaron localmente los componentes de React (`RoleGuard`, `DashboardPage`, `TicketListPage`, etc.) para soportar roles dinámicos (`admin_`, `sa_`).
  - Se añadió `admin_0` al archivo `dios.json` local.
- **Despliegue Parcial**: El usuario construyó el frontend en QA (`npm run build`) y copió el `dios.json` a la ruta de Nginx (`/home/admincrm/staticfiles/shell/incitrack/dios.json`). 
- **Síntoma Restante**: La SPA ya se muestra bien, pero el **sidebar lateral del Orquestador sigue incompleto** (faltan "Usuarios", "Cuentas", etc.).

## Siguientes pasos:
1. **Sincronizar el Servidor QA**: Ir a la carpeta del proyecto en QA y realizar `git pull` para bajar el repositorio limpio sin carpetas `.git` anidadas en `grancrm`.
2. **Revisar caché agresiva**: Pedir al usuario que abra F12 y haga un "Vaciar caché y volver a cargar de forma rígida" en su navegador.
3. **Rastrear `dios.json`**: Si el menú sigue incompleto, revisar en la pestaña `Network (Red)` del navegador:
   - ¿Desde qué URL exacta se está intentando descargar `dios.json`?
   - Revisar el "Preview/Response" de esa petición para ver si está llegando el archivo viejo (sin `admin_0`) o el nuevo.
4. Corregir la ruta o el archivo en el servidor QA dependiendo de lo que descubramos en el punto 2.

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
5. **Caché del Frontend y Mismatch de Modelos (Pydantic / Django Ninja)**:
   - En una SPA construida en React, si se hace `npm run build` o se hornea en una imagen Docker y NO se reconstruye la imagen tras un cambio en GitHub, el frontend queda "viejo" y sigue esperando variables antiguas (ej. `tickets_recientes` vs `tickets_urgentes`).
   - Al usar Django Ninja, si un endpoint define un esquema estricto (ej. `response={200: DashboardStatsOut}`), Pydantic puede filtrar y omitir campos en el JSON resultante si estos son arreglos vacíos o valores por defecto. Si el frontend espera que existan, leer su `.length` explotará con `Cannot read properties of undefined`.
   - **Solución Definitiva**: Para endpoints mixtos que necesitan entregar variables explícitamente vacías por compatibilidad hacia atrás, se debe cambiar el decorador a `response={200: dict}` para bypasear a Pydantic y forzar que Django Ninja devuelva el diccionario crudo tal como se programó.
7. **Ramas Paralelas para Experimentos (React UI)**:
   - Al realizar refactors mayores en React (como cambiar tablas estáticas a pestañas dinámicas con `useState`), siempre crear una rama de Git paralela (ej. `experiment/actividad-reciente`). Esto permite probar en QA sin comprometer la estabilidad del sistema y sin miedo a crasheos.
   - **Cuidado al inyectar código en componentes grandes**: Siempre verificar que no se redeclaren variables locales (ej. `const { session } = useSession()`) porque Vite abortará la compilación (`symbol already declared`).
8. **Botones de Toggle y Filtros de Dashboard**:
   - En lugar de redirigir, los interruptores visuales ("Ver todos") deben manejar parámetros en la URL (`searchParams.set('ver_todos', '1')`) para forzar al `useEffect` a recargar la API en la misma vista.
   - Modificar consultas backend en `api.py` para devolver `total_global` junto al `total_filtrado`, permitiendo a la UI mostrar la estadística de todos los tickets sin perder el filtro actual.
9. **Filtros por Roles en Dashboards (Mis Pendientes)**:
   - Cuidado con usar `asignado_a=usuario` genéricamente. Los Jefes y Usuarios normales **no reciben asignación de tickets** (solo los técnicos Admin TI). Si se aplica ese filtro a un Jefe, el dashboard quedará vacío (0 tickets).
   - La lógica correcta es: `asignado_a=usuario` para Admin TI, `creado_por=usuario` para usuarios normales, y `qs_base` (filtrado por `tickets_visibles`) para Jefes/Supervisores para que vean toda la actividad de su equipo.
10. **Compatibilidad Hacia Atrás y Migración a Producción (Legacy Support)**:
    - Incitrack V2 cambia la clasificación dura (texto) por relaciones de llaves foráneas (Categorías y Subcategorías dinámicas). 
    - Para no perder la historia, el modelo `Ticket` conservó el campo `tipo_incidencia` como "Legacy". Al hacer paso a producción, ejecutar `python manage.py migrate` es 100% seguro: inyectará las columnas nuevas sin borrar los datos viejos. El frontend y backend tienen propiedades (`clasificacion_display`) para leer ambos.
11. **Formato Visual del ShellHeader (Frontend)**:
    - El `ShellHeader` de `@duralux/ui` espera un texto amigable en el prop `rol` (ej. "Jefe de Cuenta" en vez de "jefe"). 
    - Asegurarse siempre de mapear la variable `session.rol` con un `switch` antes de inyectarla al header, y preferir usar `session.nombre` por sobre el email cuando esté disponible.
12. **Sistema de Adjuntos e Imágenes (Tickets y Comentarios)**:
    - **Modelos y Endpoints**: Se extendió `Adjunto` (`tickets/models.py`) para vincularse opcionalmente a `Comentario`. Se añadieron endpoints en `api.py`: `POST /tickets/{id}/adjuntos/` (imágenes y videos mp4) y `POST /tickets/{id}/comentarios/{comentario_id}/adjuntos/` (solo imágenes).
    - **Frontend**: `TicketFormPage.tsx` y `TicketDetailPage.tsx` permiten cargar archivos (imágenes/videos) en la creación de tickets y adjuntar o **pegar (Ctrl+V)** prints de pantalla dentro de las respuestas a comentarios.
    - **Retrocompatibilidad**: Requiere ejecutar `python manage.py makemigrations` y `python manage.py migrate` tras desplegar.
13. **Lógica de Servicio de Correo (`email_service.py`)**:
    - **Destinatarios**: Envía correos al Jefe de Cuenta y a los Admins TI configurados en la regla de `NotificacionServicio` según Categoría/Subcategoría.
    - **Bugfix Crítico**: Se corrigió `email_service.py` donde el envío se abortaba si `to_list` estaba vacío, ignorando la lista de copia `cc_list`. Ahora se valida `if not to_list and not cc_list:`.
    - **Envío en Segundo Plano**: Corre mediante `threading.Thread`. Si falla, las excepciones SMTP se registran en los logs de la consola del contenedor (`docker logs`). Requiere validar credenciales de Gmail (`EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` - Contraseñas de aplicación) y que el usuario receptor tenga un correo asignado en su ficha.
14. **Arquitectura y Delegación de Roles Orquestador ↔ InciTrack**:
    - **Administración de Usuarios**: Totalmente delegada al Orquestador (GranCRM). En InciTrack ya no se gestionan contraseñas; el SSO autentica y `grancrm_session.py` sincroniza el usuario.
    - **Mapeo de Roles (Opción 3 - Bloqueo Estricto)**:
      - `agente` (Orquestador) ➔ **Bloqueado**. El middleware `grancrm_session.py` destruye la sesión y redirige con HTTP 403 / error de acceso (los agentes no tienen autorización para InciTrack).
      - `admin_ti` (Orquestador) ➔ `admin` (InciTrack): Ve y resuelve todos los tickets.
      - `admin_cuenta` (Orquestador) ➔ `jefe` (InciTrack): Ve los tickets de sus cuentas y supervisores dependientes.
      - `supervisor` (Orquestador) ➔ `supervisor` (InciTrack): Ve únicamente los tickets de las cuentas que tiene asignadas.

---

## 📌 Pendientes Próxima Sesión:
1. **Verificar Envío de Notificaciones por Correo**:
   - Confirmar credenciales SMTP/Gmail (`EMAIL_HOST_PASSWORD`) y comprobar la recepción de correos al crear un ticket.
2. **Revisar Gestión / Lista de Usuarios**:
   - Evaluar limpieza o sincronización inicial de la tabla de usuarios en QA/Producción respetando la delegación hacia el Orquestador.
