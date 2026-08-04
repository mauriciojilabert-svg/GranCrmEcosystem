# Mejores Prácticas para el Despliegue en Producción (InciTrack V2)

Esta guía complementa la arquitectura existente adaptada para el dominio de producción `https://dash.in-touchcrm.cl/` (IP: `172.20.21.10`).

## 1. Archivos de Configuración (`dios.json` y `.env`)
- **`dios.json`**:
  - `url_interna`: Actualizada a `http://172.20.21.10:8000` para que Nginx enrute correctamente en la red interna.
  - `source_db`: Actualizada a `ProdIntouch`.
  - `roles`: Se agregó el nuevo rol `admin_0` (descubierto en QA) a los menús de administración (Usuarios, Cuentas, SLA, Estadísticas) para evitar que el sidebar se renderice incompleto en Producción.
  - *Acción Crítica*: Al copiar este archivo al servidor, es **obligatorio** ejecutar `sudo docker compose restart incitrack-modulo` para que el script `dios_registration.py` del Orquestador lo asimile y refresque el Sidebar.
- **`.env`**:
  - `DJANGO_SECRET_KEY`: Se ha generado una clave secreta segura y única.
  - *Acción Crítica*: Si Docker lee este archivo modificado, NO es suficiente con un `restart`. Debes recrear el contenedor mediante `sudo docker compose up -d` para que inyecte las variables de sistema.

## 2. Caché Agresiva del Micro-Frontend (React SPA)
- El Orquestador utiliza _Vite Module Federation_. Si despliegas InciTrack en el servidor (a través de `npm run build` o imagen Docker) y el navegador del usuario conserva el caché antiguo, el frontend fallará esperando variables `undefined`.
- **Mitigación**: Siempre, después de un pase, presiona `F12` y usa **"Vaciar la caché y volver a cargar de forma rígida"**. Se recomienda que le pidas esto a tu equipo también la primera vez que se logueen a V2.

## 3. Base de Datos y Migraciones (El paso más importante)
- InciTrack V2 cambia la arquitectura de base de datos introduciendo Modelos dinámicos de `Categoría` y `Subcategoría`, sin romper la data vieja (`tipo_incidencia`).
- **El Peligro**: Si levantas el servidor de Django sin migrar, cualquier petición HTTP a `/incitrack/api/tickets` arrojará un **Error 500** porque Pydantic buscará columnas en SQL Server que no existen aún.
- **Solución Obligatoria**: Justo después de hacer `git pull`, ejecuta:
  ```bash
  sudo docker compose exec incitrack-modulo python manage.py migrate
  ```
  Esto es 100% seguro (retrocompatible) y prevendrá las caídas.

## 4. HTTPS y Reglas CORS (Cross-Origin Resource Sharing)
- Tu sistema está balanceado bajo HTTPS (`https://dash.in-touchcrm.cl/`).
- Como Nginx canaliza todo el tráfico del módulo InciTrack a través del proxy inverso en el mismo dominio (usando la ruta `/incitrack/api/`), **NO** deberías encontrar errores de orígenes cruzados.
- **Recordatorio del Frontend**: El archivo `vite.config.ts` del frontend está preparado para el modo _remote_, por lo tanto, no necesita apuntar localmente en el build. Toda petición `fetch` irá transparente hacia el dominio actual de producción.
