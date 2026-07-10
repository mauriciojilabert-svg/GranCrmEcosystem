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
