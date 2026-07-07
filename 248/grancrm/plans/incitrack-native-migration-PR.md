# InciTrack → microfrontend nativo (Module Federation `spa_remote`)

Migra InciTrack de Django server-rendered (modo iframe/legacy) a un **remoto React + Vite Module Federation** montado por el shell GranCRM, igual que Call Reviews. Responsivo, portable, sin iframe.

## Qué incluye (rama `feature/incitrack-native-migration`, 15 commits sobre `main`)
- **Base**: commitea la integración JWT/SSO + multi-tenant de InciTrack que vivía sin commitear (`grancrm_session`, `utils/` tenant, `dios.json`, migración inicial). Saca `incitrack/.env` del tracking (gitignored).
- **Backend**: API JSON con **django-ninja** (`/incitrack/api/v1/`) reutilizando las reglas de visibilidad por rol/tenant; stack de middleware alineado al contrato (`grancrm_auth`); endpoint `/me/`; 401 (no 302) en rutas de API ante sesión expirada.
- **Frontend**: remoto MF (`name: incitrack`, expone `./App`) con todas las páginas en React: Dashboard, Tickets (lista/detalle/crear/editar/comentarios/cierre), Admin (usuarios/cuentas/notificaciones), Config SLA. Gating por rol, responsive, cliente API tipado.
- **Registro/infra**: `dios.json` `modo: spa_remote` + campos MF; snippet de gateway en `incitrack/deploy/nginx-incitrack.conf`; `nav` alineado a las rutas React.

## Cómo se validó
- Backend: `manage.py check` limpio + 10 tests (auth, visibilidad por tenant, create, role-guard) en sqlite.
- Frontend: `tsc --noEmit` 0 + build emitiendo `remoteEntry.js`.
- Preview aislado navegable + **desplegado en DEV (corriendo)**: monta como remoto (sin `<iframe>`), navegación y datos OK.

## Estado de deploy en DEV (referencia para el reviewer)
Ya aplicado en el server dev: contenedor `incitrack-modulo` rebuildeado, bundle en `staticfiles/mf/incitrack`, split de gateway aplicado, DIOS en `spa_remote`. Rollback documentado en `plans/rollback-incitrack.sh`.

## Notas
- **Secreto**: `incitrack/.env` ya no se trackea; el valor sigue en el historial previo → rotar/purgar aparte (decisión del equipo).
- **Pendiente menor**: borrar plantillas Django legacy (`plans/005-...`) una vez estable.
- `/me/` es solo para el dev standalone; en prod el shell pasa la sesión por props.
- Visibilidad admin: dashboard/lista arrancan en "solo mis tickets" salvo "Ver todos" (idéntico al comportamiento Django previo).
