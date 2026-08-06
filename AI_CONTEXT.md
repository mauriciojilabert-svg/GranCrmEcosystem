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
     - **Ruta QA**: `cd /home/admincrm/249`
     - **Ruta Producción**: (Por definir en la máquina productiva)

---

## Descubrimientos y Reglas Arquitectónicas (InciTrack V2):

1. **Mapeo de Roles Dinámicos en Backend**: El Orquestador entrega roles con sufijos (ej: `admin_0`, `sa_4`). El archivo `tickets/grancrm_session.py` de InciTrack separa el prefijo base.
   - **Delegación**: El Orquestador maneja la autenticación y creación de usuarios. InciTrack solo los recibe.
   - `agente` (Orquestador) ➔ **Bloqueado** con HTTP 403.
   - `admin_ti` (Orquestador) ➔ `admin` (InciTrack).
   - `admin_cuenta` (Orquestador) ➔ `jefe` (InciTrack).
   - `supervisor` (Orquestador) ➔ `supervisor` (InciTrack).

2. **Configuración de `dios.json`**:
   - `dios.json` controla los ítems del sidebar del Orquestador.
   - Requiere `url_interna`, `url_publica`, `source_db` correctos según el entorno.
   - Cada vez que se modifica, se debe reiniciar InciTrack (`sudo docker compose restart incitrack-modulo`) para que se dispare `dios_registration.py`.

3. **Migraciones de BD**: Al desplegar código que modifique modelos (ej. Categorías dinámicas), es obligatorio ejecutar:
   `sudo docker compose exec incitrack-modulo python manage.py migrate`

4. **Variables de Entorno (`.env`)**:
   - **No confundir** `DB_PASSWORD` con `GRANCRM_JWT_SECRET`.
   - Modificar `.env` requiere **`sudo docker compose up -d`** (restart no basta).

5. **Frontend React y Caché**:
   - Compilar frontend: `export PATH="/home/admincrm/.node20/bin:$PATH"` y usar `pnpm build`.
   - **Caché en navegador**: Siempre pedir al usuario vaciar caché (F12 -> Cargar de forma rígida) al actualizar UI.
   - Para respuestas de Django Ninja con atributos vacíos, usar `response={200: dict}` para evitar que Pydantic omita claves.
   - El pegado de imágenes (Ctrl+V) está soportado visualmente tanto en creación de tickets (`TicketFormPage`) como en comentarios (`TicketDetailPage`).

6. **Servicio de Correos**:
   - `email_service.py` corre en `threading.Thread`.
   - Los fallos quedan en `docker logs`. Envía a Jefe de Cuenta y Admins TI asociados.

---

## 📌 Próximos Pasos (Paso a Producción):
1. **Configuración de Producción**: La base de datos será `172.20.21.3`, IP física `172.20.21.10`, y la URL será `https://dash.in-touchcrm.cl/login/?next=%2F`.
2. **Archivos Base**: Usar la carpeta `PRODUCCION/` local para almacenar `dios_incitrack.json`, `env_incitrack` u otros configurables para clonar a producción fácilmente.
