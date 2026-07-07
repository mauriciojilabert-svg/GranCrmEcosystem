# Plan 003: Frontend — port InciTrack pages to React against the API

> **Executor instructions**: Follow step by step. This is the largest plan — it
> is explicitly OK to split it into sub-PRs per route group (tickets / admin /
> SLA) and update the README status as each lands. Read the referenced guide
> sections first. If a "STOP condition" occurs, stop and report. Update
> `plans/README.md` when done (or per sub-group).
>
> **Drift check (run first)**:
> `git diff --stat 896ca8e..HEAD -- incitrack/tickets/views.py incitrack/tickets/templates`
> Use the live templates/views as the behavioral reference for each page.

## Status

- **Priority**: P1
- **Effort**: L (split as needed)
- **Depends on**: plans/002-frontend-mf-remote-scaffold.md (and 001 for the API)
- **Risk**: MED (functional parity is the bar; reversible — old templates still serve until Plan 004/005)
- **Category**: migration
- **Planned at**: commit `896ca8e`, 2026-06-18

## Why this matters

This is where InciTrack actually becomes native: every page the user uses today
(server-rendered Duralux templates) is reimplemented as React components that
fetch JSON from the Plan 001 API and render inside the shell. The acceptance bar
is **functional parity** with today's app, plus **responsive** layout (the user
asked for this explicitly).

## Read first

- `GUIA_INTEGRACION_APP_SATELITE.md` — §2.2.2 (routes WITHOUT prefix, use
  `session`), §2.2.3 (apiFetch), §2.7 (acceptance checklist).
- The **current InciTrack pages** are the behavioral spec. For each page, open
  both the template and its view:
  - `incitrack/tickets/templates/tickets/dashboard.html` + `DashboardView`
  - `…/ticket_lista.html` + `TicketListaView` (filters!)
  - `…/ticket_detalle.html` + `TicketDetalleView`, `…/ticket_nuevo.html` +
    `TicketNuevoView` (incl. the AJAX subcategoría/SLA behavior — vanilla
    `fetch`, lines ~194-203 of `ticket_nuevo.html`)
  - `…/admin/{usuario,cuenta,notificacion}_*.html` + the admin views
  - `…/sla/sla_*.html` + the SLA views
- Reference React structure: `call_reviews/frontend/src/` (how it lays out pages,
  uses the API client and session context).

## Current state

- Routes to reproduce (from `incitrack/tickets/urls.py`), as React routes under
  the shell `basename` (so paths are **relative**, no `/incitrack/` prefix —
  guide §2.2.2):

  | InciTrack URL (today) | React route `path` | Source view |
  |---|---|---|
  | `/incitrack/` | `index` | `DashboardView` |
  | `/incitrack/tickets/` | `tickets` | `TicketListaView` |
  | `/incitrack/tickets/nuevo/` | `tickets/nuevo` | `TicketNuevoView` |
  | `/incitrack/tickets/<id>/` | `tickets/:id` | `TicketDetalleView` |
  | `/incitrack/tickets/<id>/editar/` | `tickets/:id/editar` | `TicketEditarView` |
  | `/incitrack/admin-panel/usuarios/…` | `admin/usuarios…` | Usuario* views |
  | `/incitrack/admin-panel/cuentas/…` | `admin/cuentas…` | Cuenta* views |
  | `/incitrack/admin-panel/notificaciones/…` | `admin/notificaciones…` | Notificacion* views |
  | `/incitrack/superadmin/sla/…` | `sla…` | SLA* views (superuser only) |

- The shell renders the **sidebar** from `dios.json` `nav` (Plan 004), so React
  does **not** render its own sidebar/topbar. Pages render only content.
- Role gating: use `session.rol` (`sa`/`admin`/`ejecutivo`) to hide/disable admin
  and SLA routes, mirroring the `{% if request.user.es_admin %}` /
  `{% if is_superuser %}` checks in the templates. The API also enforces this
  (Plan 001) — the UI gating is UX, the API is the security boundary.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `cd incitrack/frontend && corepack pnpm exec tsc --noEmit` | exit 0 |
| Dev server | `corepack pnpm dev` | serves on the dev port; pages render against `:8000` API via proxy |
| Build | `corepack pnpm build` | emits `remoteEntry.js` |
| Tests | `corepack pnpm test` (if configured) | pass |

## Scope

**In scope:** everything under `incitrack/frontend/src/` (pages, components,
hooks, the route table in `App.tsx`, typed API calls in `src/api.ts` /
`src/apiTypes.ts`).

**Out of scope:**
- The Django backend/API (Plan 001) — if you find a missing endpoint or field,
  STOP and note it; don't add ad-hoc backend code here.
- `dios.json`, gateway, registration — Plan 004.
- Deleting Django templates — Plan 005 (they keep serving as fallback until the
  SPA is live and verified).

## Git workflow

- Branch: `feature/incitrack-react-pages` (sub-branches per group are fine).
- Commit per page group. `feat(incitrack): tickets pages in React`, etc.
- Do not push/PR unless asked.

## Steps (suggested order — smallest blast radius first)

### Step 1: Shared building blocks
Typed API functions in `src/api.ts`/`apiTypes.ts` for each Plan 001 endpoint
(return types match the ninja schemas). A small set of shared UI pieces:
loading state, error banner (on `sessionExpired` the shell handles redirect),
a responsive table/card wrapper, form helpers. Use the shell's existing
Bootstrap classes (already loaded globally) so styling matches the rest of
GranCRM — do **not** add a CSS framework.

### Step 2: Dashboard (`index`)
Fetch `GET api/v1/dashboard/`, render the stat cards from `dashboard.html`.
Responsive grid (Bootstrap `row`/`col` that stacks on mobile).
**Verify**: dev server shows the dashboard with real counts.

### Step 3: Tickets group (`tickets`, `tickets/nuevo`, `tickets/:id`, `:id/editar`)
- List with the same filters as `TicketListaView` (status/account/etc.),
  paginated if the view paginates. Rows link to `tickets/:id` (client-side nav).
- New/Edit forms: replicate the subcategoría→SLA cascade (call
  `GET api/v1/lookups/subcategorias/` then `…/lookups/sla/`), submit via
  `POST/PUT`. Show validation errors from the API.
- Detail: ticket fields + comments; add-comment via
  `POST api/v1/tickets/:id/comentarios/`; close via `…/cerrar/`.
**Verify**: create → appears in list → open detail → comment → close, all
without a full page reload.

### Step 4: Admin group (`admin/usuarios`, `admin/cuentas`, `admin/notificaciones`)
CRUD lists + forms, gated to `rol in ['sa','admin']` (mirror the template
guards). Reuse the shared table/form pieces.

### Step 5: SLA config (`sla…`)
Superuser-only (`rol === 'sa'`) CRUD, mirroring the SLA views.

### Step 6: Route table + 404
Wire all routes in `App.tsx` (`<Routes>`, relative paths, `path="*"` →
`<Navigate to="." replace />`). Hide nav-restricted routes for unauthorized
roles.

## Test plan

- Component/integration tests for the **tickets** group at minimum (the core
  flow): list renders from mocked API, create submits the right payload, detail
  adds a comment. Use whatever test runner Call Reviews' frontend uses (mirror
  it); if none is configured, do **not** introduce a heavy framework — add a
  minimal `vitest` setup only if quick, otherwise document manual verification of
  each Step's "Verify" line.
- Manual parity pass: for each page, compare against the live Django page and
  confirm the same data and actions are present.
- **Responsive check (required)**: at ≤768px width, no horizontal scroll; tables
  collapse to cards or scroll within their container; forms are usable.

## Done criteria

ALL must hold:

- [ ] `corepack pnpm exec tsc --noEmit` exits 0
- [ ] `corepack pnpm build` emits `remoteEntry.js`
- [ ] Every route in the Current-state table renders and works against the API
- [ ] Tickets create→list→detail→comment→close works with no full-page reload
- [ ] Admin/SLA routes are hidden for unauthorized roles AND the API rejects them
- [ ] Responsive at ≤768px (no horizontal overflow)
- [ ] Tests for the tickets group pass, or manual verification documented
- [ ] `plans/README.md` row for 003 updated (or per sub-group)

## STOP conditions

Stop and report if:

- An API endpoint or field the page needs is missing/wrong → note exactly what,
  so Plan 001 can be amended; do not patch the backend from here.
- A page's business rule in the template/view is ambiguous and you cannot infer
  it safely (e.g. an SLA calculation) → report it rather than guessing.
- The shell does not pass a usable `session`/`apiBase` when you test-mount →
  that's a Plan 002/004 contract problem; report it.

## Maintenance notes

- Pages read data shapes from the ninja schemas; if a schema changes, update the
  matching `apiTypes.ts` type and the page.
- Keep routes prefix-free and host-free (portability). Any hardcoded `/incitrack/`
  or `http://…` is a bug — derive from `apiBase`/`basename`.
- Reviewer should spot-check role gating on both layers (UI hidden + API 403) and
  the responsive behavior.
