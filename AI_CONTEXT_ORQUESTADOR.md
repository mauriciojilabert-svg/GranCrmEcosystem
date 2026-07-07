# Contexto Arquitectónico de GranCRM (Para la Inteligencia Artificial)

Este documento contiene toda la información vital sobre la arquitectura de **GranCRM**, el **Orquestador (DIOS)** y los submódulos como **InciTrack**.
**Por favor, lee este documento atentamente al iniciar una nueva sesión para entender cómo está estructurado el sistema.**

---

## 1. Topología y Componentes

GranCRM está compuesto por múltiples piezas separadas que trabajan juntas. El servidor QA (`172.20.21.249`) y DEV (`172.20.21.248`) tienen la misma arquitectura:

*   **Gateway Nginx (`:443` y `:80`):** El punto de entrada principal. Enruta las peticiones basándose en la URL.
    *   `/` -> Shell de React (Frontend del Orquestador).
    *   `/incitrack/` -> Contenedor de InciTrack (`:8000`).
    *   `/api/`, `/login/` -> Contenedor del Orquestador Django (`:9000`).
    *   `/mf/` -> Archivos estáticos de los microfrontends y el shell (alojados en `/home/admincrm/staticfiles`).
*   **El "Orquestador" (DIOS) - Backend:** Aplicación Django (puerto 9000) que maneja el inicio de sesión único (JWT), aprovisionamiento de bases de datos de clientes (Tenants) y registro interno de módulos.
*   **El "Shell" - Frontend del Orquestador:** Una SPA en React que sirve como "cascarón". Dibuja el menú lateral, la cabecera (con logos como Duralux o InTouch) y carga los submódulos usando **Module Federation**. Su código fuente vive en `/home/admincrm/orquestador/frontend/`.
*   **Módulos (Ej. InciTrack):** Aplicaciones satélite totalmente independientes. InciTrack es un microfrontend y un backend Django.

## 2. El Mecanismo de `dios.json` y el Menú Lateral

El menú lateral del orquestador NO está hardcodeado (escrito fijo) en el shell. Es totalmente dinámico.

1.  Cada módulo (como InciTrack) tiene un archivo **`dios.json`**. Este archivo declara cómo se llama la app y **qué botones deben ir en el menú lateral** (el bloque `"nav"`).
2.  Al encenderse o reiniciarse un módulo, un script (`dios_registration.py`) lee el `dios.json` de la app y hace un `POST` interno a `http://orquestador:9000/internal/register-app/`.
3.  El Orquestador guarda esta información en su base de datos.
4.  Cuando el Shell se carga, le pide la lista de botones al Orquestador y dibuja el menú.

## 3. Flujo Crítico de Compilación (Build) y Despliegues (Deploy)

Un error muy común es subir archivos al servidor y olvidar compilarlos. La arquitectura obliga a compilar el Frontend **por separado** del Backend.

*   **Backend (Django - Orquestador e InciTrack):** Se actualiza corriendo `sudo docker compose build` y `sudo docker compose restart`.
*   **Frontend (React - Shell y Microfrontends):** **El Dockerfile NO compila el frontend**. Se debe compilar manualmente en el "Host" (servidor Ubuntu) utilizando `pnpm` (Node.js). 
    *   **Proceso para compilar frontend:**
        ```bash
        cd /home/admincrm/[modulo_u_orquestador]/frontend
        pnpm install
        pnpm run build
        ```
    *   *Nota sobre pnpm:* `pnpm` v10 requiere Node.js >= 22. Si el servidor tiene Node 20, se debe forzar la versión 9 con: `sudo npm install -g pnpm@9`.

## 4. Base de Datos (SQL Server) y Variables de Entorno

*   GranCRM usa **SQL Server** alojado centralmente en `172.20.21.50`.
*   La configuración en Django (`settings.py`) lee las credenciales usando `os.environ.get('DB_HOST', '172.20.21.3')`. El archivo `.env` del servidor es la fuente de verdad principal (pisa cualquier fallback).
*   Se utiliza un esquema multitenant. El `tenant_id` viene en el token JWT. Para desarrollo compartido, se usa el schema `DevIntouch` (en DEV) y `QAIntouch` (en QA).

## 5. Estado Actual del Servidor QA (.249)

*   La carpeta de **InciTrack** (`/home/admincrm/grancrm/incitrack`) está completamente actualizada, compilada y reiniciada. Ya incluye el nuevo módulo `grancrm_auth`.
*   La carpeta del **Orquestador** (`/home/admincrm/orquestador/`) ya contiene el nuevo código del UI con el logo de "InTouch". **Pendiente:** Terminar de ejecutar `pnpm run build` usando `pnpm@9` en `/home/admincrm/orquestador/frontend/` para que Nginx deje de servir el viejo logo (Duralux) y tome el nuevo cascarón.
