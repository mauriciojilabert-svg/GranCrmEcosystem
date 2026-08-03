# Arquitectura y Flujo del Ecosistema GranCRM e InciTrack

Este documento detalla a nivel arquitectónico e infraestructural cómo se componen y comunican los distintos sistemas del ecosistema GranCRM, haciendo énfasis en el ciclo de vida e inyección del módulo InciTrack.

---

## 1. Mapa Conceptual del Ecosistema

A continuación, se muestra cómo se organiza el universo de componentes en GranCRM:

```mermaid
graph LR
    ECO["GranCRM Ecosistema"]

    ECO --- NG["Nginx Gateway"]
    NG --- NG1["Proxy Inverso"]
    NG --- NG2["Enrutamiento de URLs"]
    NG --- NG3["Archivos Estaticos"]

    ECO --- ORQ["Orquestador"]
    ORQ --- ORQ1["Shell Frontend"]
    ORQ --- ORQ2["Duralux UI Kit"]
    ORQ --- ORQ3["Motor JWT"]
    ORQ --- ORQ4["Mapeo de Roles"]

    ECO --- MOD["Modulos Satelites"]
    MOD --- IT["InciTrack"]
    IT --- IT1["Micro-Frontend React"]
    IT --- IT2["Backend Django Ninja"]
    IT --- IT3["BD SQL Server"]
    MOD --- CR["CallReviews"]
    MOD --- OT["Otros Modulos"]

    style ECO fill:#4a90d9,stroke:#2c5282,color:#fff,font-weight:bold
    style NG fill:#e57373,stroke:#c62828,color:#fff
    style ORQ fill:#81c784,stroke:#2e7d32,color:#fff
    style MOD fill:#ffb74d,stroke:#e65100,color:#fff
    style IT fill:#fff176,stroke:#f9a825,color:#333
```

---

## 2. Descripcion Detallada de Componentes

### A. Nginx — El Proxy Inverso y Puerta de Enlace
Actua como el guardia de trafico de toda la red. Todas las peticiones del navegador de los usuarios llegan primero a Nginx.
*   **Funcion Principal:** Lee la URL de la peticion y decide a que contenedor de Docker redirigirla.
*   **Ejemplo:** Si pides `/`, te envia al Shell del Orquestador. Si pides `/mf/incitrack/`, Nginx sirve los archivos estaticos de React compilados del frontend de InciTrack. Si la peticion es `/incitrack/api/`, redirige el trafico al puerto interno donde escucha el backend en Python.

### B. El Orquestador — Shell y Duralux
Es la plataforma "padre" de la aplicacion.
*   **Shell (Frontend en React):** Es el cascaron que envuelve todo. Se encarga de pintar el menu lateral, la barra superior y mantener el ciclo de vida del usuario activo.
*   **Duralux (Sistema de Diseno):** Es la libreria de componentes propios (UI Kit). Contiene el diseno y la logica de los botones, tablas, pestanas y modales. Esto garantiza que sin importar quien programe un submodulo, todo se vea exactamente igual, manteniendo la coherencia de la marca.
*   **Motor de Autorizacion (JWT):** Genera credenciales estandarizadas. En lugar de compartir contrasenas, entrega un token que contiene la informacion esencial y perfiles dinamicos del usuario (por ejemplo, `admin_0` o `sa_4`).
*   **Gestion del Menu — dios.json:** El orquestador construye su menu de navegacion leyendo los archivos manifiesto de los modulos instalados. Si InciTrack reporta en su archivo `.json` que necesita un boton llamado "Tickets", el Shell lo renderiza dinamicamente.

### C. InciTrack — Modulo Desacoplado
Es la aplicacion especializada en la gestion de tickets. Fue disenada para vivir y morir de forma independiente al Orquestador, con el objetivo de prevenir bloqueos del sistema completo (tolerancia a fallos).

1.  **Frontend Desacoplado (Micro-Frontend en React):**
    En lugar de ser una web que se abre en otra pestana, InciTrack es inyectado dentro del Shell utilizando la tecnologia **Webpack Module Federation** de Vite.
    *   **Inyeccion de Dependencias:** El Shell pasa un objeto de estado (Props) que contiene el `session` (el Token y los roles del usuario) y una API base para que el frontend sepa a que URL comunicarse.
2.  **Backend Dedicado (Django Ninja):**
    Una API construida con Python que maneja la logica fuerte, validaciones de negocio y creacion de los incidentes.
3.  **Mecanismo grancrm_session.py (Autenticacion Hibrida):**
    Como InciTrack no confia en conectarse a la base de datos principal, este archivo intercepta todas las peticiones, lee el Token JWT proporcionado por el Orquestador y lo valida. Si el usuario es valido, InciTrack lo **sincroniza (lo clona o actualiza)** dentro de su propia base de datos SQL Server, asegurandose de tener siempre un registro fidedigno del creador o responsable del ticket.

---

## 3. Diagrama de Componentes — Conexiones de Red

Este diagrama explica como estan conectadas las piezas a nivel de red y protocolos:

```mermaid
graph TD
    User(("Usuario Web"))
    Nginx["Nginx - Proxy Inverso"]

    subgraph orq ["Orquestador Central"]
        Shell["Shell Orquestador - React SPA"]
        Duralux["Duralux UI - Design System"]
        Auth["API Orquestador - Gestor JWT"]
    end

    subgraph inci ["InciTrack - Modulo"]
        MF["Micro-Frontend - React y Vite"]
        Backend["Backend API - Django Ninja"]
        DB[("SQL Server - QAIntouch")]
    end

    User -->|"HTTPS"| Nginx
    Nginx -->|"ruta /"| Shell
    Nginx -->|"ruta /api/auth"| Auth
    Nginx -->|"ruta /mf/incitrack"| MF
    Nginx -->|"ruta /incitrack/api"| Backend

    Shell -.->|"1 Inyecta remoto"| MF
    MF -.->|"2 Importa componentes"| Duralux
    MF -->|"3 Fetch REST"| Nginx
    Backend -->|"4 Conexion ODBC"| DB

    style User fill:#bbdefb,stroke:#1565c0,color:#333
    style Nginx fill:#ef9a9a,stroke:#c62828,color:#333
    style Shell fill:#c8e6c9,stroke:#2e7d32,color:#333
    style Duralux fill:#c8e6c9,stroke:#2e7d32,color:#333
    style Auth fill:#c8e6c9,stroke:#2e7d32,color:#333
    style MF fill:#fff9c4,stroke:#f9a825,color:#333
    style Backend fill:#fff9c4,stroke:#f9a825,color:#333
    style DB fill:#d1c4e9,stroke:#4527a0,color:#333
```

---

## 4. Diagrama UML de Secuencia — El Flujo Completo

Aqui se describe el ciclo de vida completo de extremo a extremo (End-to-End), desde que un usuario entra a la plataforma hasta que ve sus tickets en InciTrack.

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario
    participant N as Nginx
    participant O as Shell Orquestador
    participant F as InciTrack Frontend
    participant B as InciTrack Backend
    participant DB as SQL Server

    Note over U,O: FASE 1 - Autenticacion Inicial
    U->>N: Inicia sesion con credenciales
    N->>O: Procesa Login
    O-->>U: Devuelve Token JWT, carga Shell y Menu

    Note over U,F: FASE 2 - Inyeccion del Micro-Frontend
    U->>O: Clic en Tickets en el menu lateral
    O->>N: Solicita remoteEntry.js de InciTrack
    N-->>O: Devuelve archivos JS compilados
    O->>F: Inyecta InciTrack en el DOM y transfiere Token JWT

    Note over F,DB: FASE 3 - Intercambio de Datos
    F->>N: fetch /incitrack/api/tickets con JWT en cookie
    N->>B: Enruta peticion al puerto 8000
    Note over B: Middleware grancrm_session.py intercepta
    B->>B: Desencripta y valida Token JWT
    B->>DB: Busca si el usuario existe localmente
    alt Usuario es Nuevo
        B->>DB: Crea registro de usuario clonado
    else Usuario ya Existe
        B->>DB: Actualiza campos y roles dinamicos
    end
    B->>DB: Ejecuta Query SQL de Tickets
    DB-->>B: Retorna datos
    B-->>N: HTTP 200 JSON
    N-->>F: Entrega JSON al Frontend

    Note over U,F: FASE 4 - Renderizado
    F->>F: Procesa JSON con componentes Duralux
    F-->>U: Muestra listado de Tickets en pantalla
```

---

## 5. Diagrama de Despliegue — Contenedores Docker

Asi se despliegan los servicios dentro del servidor QA:

```mermaid
graph TB
    subgraph servidor ["Servidor QA - Linux Docker Host"]
        subgraph docker ["Docker Compose"]
            nginx_c["Contenedor: gateway-nginx-1<br/>Puerto: 80/443"]
            orq_c["Contenedor: orquestador<br/>Puerto interno: 8001"]
            inci_c["Contenedor: incitrack-modulo<br/>Puerto interno: 8000"]
        end
    end

    sqlserver[("SQL Server 172.20.21.50<br/>BD: QAIntouch<br/>Puerto: 1433")]

    nginx_c -->|"proxy_pass"| orq_c
    nginx_c -->|"proxy_pass"| inci_c
    inci_c -->|"ODBC Driver 18"| sqlserver

    style servidor fill:#263238,stroke:#546e7a,color:#eceff1
    style docker fill:#37474f,stroke:#78909c,color:#eceff1
    style nginx_c fill:#ef5350,stroke:#b71c1c,color:#fff
    style orq_c fill:#66bb6a,stroke:#2e7d32,color:#fff
    style inci_c fill:#ffa726,stroke:#e65100,color:#fff
    style sqlserver fill:#7e57c2,stroke:#311b92,color:#fff
```

---

## 6. Diagrama de Flujo de Roles — dios.json y Autorizacion

Como se resuelven los roles dinamicos que entrega el Orquestador:

```mermaid
flowchart TD
    A["Orquestador entrega rol: admin_0"] --> B{"grancrm_session.py<br/>separa prefijo"}
    B -->|"Prefijo: admin"| C["Rol normalizado: admin"]
    B -->|"Prefijo: sa"| D["Rol normalizado: supervisor"]
    B -->|"Sin prefijo conocido"| E["Rol por defecto: supervisor"]

    C --> F["RoleGuard en React<br/>permite acceso Admin"]
    D --> G["RoleGuard en React<br/>permite acceso Supervisor"]
    E --> G

    F --> H["Dashboard completo<br/>Usuarios, Cuentas, SLA, Estadisticas"]
    G --> I["Dashboard limitado<br/>Solo Tickets asignados"]

    style A fill:#ffcc80,stroke:#e65100,color:#333
    style B fill:#90caf9,stroke:#1565c0,color:#333
    style C fill:#a5d6a7,stroke:#2e7d32,color:#333
    style D fill:#a5d6a7,stroke:#2e7d32,color:#333
    style E fill:#ef9a9a,stroke:#c62828,color:#333
    style F fill:#c8e6c9,stroke:#2e7d32,color:#333
    style G fill:#c8e6c9,stroke:#2e7d32,color:#333
    style H fill:#e1bee7,stroke:#6a1b9a,color:#333
    style I fill:#e1bee7,stroke:#6a1b9a,color:#333
```

---

## 7. Casos Especiales y Puntos Clave

*   **Problemas de Cache Vite:** A menudo, si se realizan despliegues en el Micro-Frontend de InciTrack sin purgar la cache del navegador, el Orquestador seguira inyectando el codigo viejo (esperando variables antiguas, rompiendo la aplicacion con `Cannot read properties of undefined`).
*   **Roles Dinamicos:** Los roles como `admin_0` deben limpiarse antes de procesarse. El Orquestador entrega sufijos especificos que InciTrack internamente traduce a `admin` global, manejado directamente en los context y componentes como `RoleGuard`.
*   **Esquemas Estrictos de Pydantic:** Puesto que se usa Django Ninja, hay que tener extremo cuidado con las respuestas (Schemas). Si se devuelven objetos que no cumplen al 100% el esquema esperado (ej. valores vacios omitidos por Pydantic), el frontend se rompera. Por eso a veces se fuerza a retornar diccionarios estandar (`dict`) para preservar la retrocompatibilidad.
*   **Variables de Entorno:** Nunca confundir `DB_PASSWORD` con `GRANCRM_JWT_SECRET`. Y tras editar el `.env`, se requiere `docker compose up -d` (no basta con `restart`).
*   **Migraciones Obligatorias:** Si se agregan campos nuevos al modelo (ej. `categoria`, `subcategoria`), se debe ejecutar `python manage.py migrate` dentro del contenedor. Si no, los endpoints devolveran HTTP 500.
