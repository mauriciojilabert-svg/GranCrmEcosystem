# Plan 001: Backend — expose a JSON API (django-ninja) and align the auth stack

> **Executor instructions**: Follow step by step. Run every verification command
> and confirm its expected result before moving on. If a "STOP condition"
> occurs, stop and report — do not improvise. Read the referenced guide sections
> before coding. When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**:
> `cd /home/admincrm/grancrm && git diff --stat 896ca8e..HEAD -- incitrack/`
> If `incitrack/tickets/views.py`, `incitrack/tickets/mixins.py`, or
> `incitrack/incitrack/settings.py` changed since this plan was written, compare
> against the excerpts below before proceeding; on a real mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED (touches settings/middleware; reversible)
- **Depends on**: plans/000-commit-integration-base.md (MUST be DONE first — see below)
- **Category**: migration
- **Planned at**: commit `896ca8e`, 2026-06-18

## ⛔ Hard precondition (added after a blocked execution attempt)

InciTrack's JWT/SSO + multi-tenant integration (`tickets/grancrm_session.py`,
`utils/`, `dios.json`, `migrations/0001_initial.py`) is **uncommitted** at
`896ca8e`, and the committed `settings.py` references middleware files that
aren't committed → the committed tree does not import. **Do Plan 000 first.**
If you start this plan and find `incitrack/utils/` or
`incitrack/tickets/grancrm_session.py` are untracked
(`git ls-files incitrack/utils/` returns nothing), **STOP** — the base is not
committed; running here will silently build on a broken skeleton and may delete
essential middleware to make `manage.py check` pass.

## Why this matters

A native Module-Federation frontend (Plans 002–003) renders React and gets all
its data from a JSON API — it cannot consume Django HTML templates. InciTrack
has no real API today (only two ad-hoc `JsonResponse` AJAX endpoints). This plan
adds a versioned JSON API with **django-ninja** (the same library Call Reviews
uses), reusing InciTrack's existing visibility rules so the API enforces the
same per-role/per-tenant access the templates do. It also aligns the auth
middleware to the platform contract so API calls authenticate off the shared
`grancrm_session` cookie.

## Read first (authoritative spec)

- `/home/admincrm/orquestador/docs/GUIA_INTEGRACION_APP_SATELITE.md` — **§1.6**
  (obligatory middleware order), **§2.3** (backend rules), **§2.3.2**
  (copy `grancrm_auth`). These are invariants; follow them exactly.
- Reference implementation: `/home/admincrm/call_reviews/` — its
  `config/urls.py` (`path("api/v1/", api.urls)`), its django-ninja API module,
  `grancrm_auth/middleware.py`, and `config/grancrm_session.py`. **Open these and
  mirror their structure.**

## Current state

- `incitrack/incitrack/settings.py` — single settings module (no docker split).
  Current `MIDDLEWARE` (lines ~35-45):

  ```python
  MIDDLEWARE = [
      'django.middleware.security.SecurityMiddleware',
      'django.contrib.sessions.middleware.SessionMiddleware',
      'django.middleware.common.CommonMiddleware',
      'django.middleware.csrf.CsrfViewMiddleware',
      'django.contrib.auth.middleware.AuthenticationMiddleware',
      'tickets.grancrm_session.GranCRMSessionMiddleware',
      'utils.tenant_middleware.TenantDatabaseMiddleware',
      'django.contrib.messages.middleware.MessageMiddleware',
      'django.middleware.clickjacking.XFrameOptionsMiddleware',
  ]
  ```

  Note: InciTrack uses its **own** `tickets/grancrm_session.py` (not a copied
  `grancrm_auth/` package). It currently does NOT set `request.jwt_payload` early
  via a dedicated `GranCRMAuthMiddleware`; `TenantDatabaseMiddleware` decodes the
  JWT itself. The guide's reference stack splits these into three middlewares
  (§1.6). For InciTrack, the minimal correct change is in Step 2.

- `incitrack/tickets/views.py` — class-based views with the data logic to mirror.
  Key views and the data each returns (read each before writing its endpoint):
  - `DashboardView.get` (line ~109) — ticket stats/counters for the dashboard.
  - `TicketListaView.get` (line ~178) — filtered ticket list (uses
    `tickets_visibles`).
  - `TicketDetalleView.get` (line ~347), `TicketNuevoView` (~269),
    `TicketEditarView` (~373), `TicketCierreView` (~394),
    `ComentarioAgregarView` (~423).
  - `SubcategoriasAjaxView` (~81), `SLAAjaxView` (~106) — lookups already JSON.
  - Admin CRUD: `UsuarioListaView`/`Crear`/`Editar`/`Eliminar` (~443+),
    `CuentaListaView`/… (~510+), `Notificacion*`, `SLA*` (config).
- `incitrack/tickets/mixins.py` — **reuse this**: `tickets_visibles(usuario)`,
  `cuentas_visibles(usuario)`, `puede_ver_ticket`, and the role mixins
  (`SoloAdminMixin`, `AdminOJefeMixin`). The API must apply the **same**
  visibility filters, not re-implement them differently.
- `incitrack/requirements.txt` — has `django==4.2.16`, `mssql-django`, `pyodbc`,
  `gunicorn`, `Pillow`, `python-dotenv`, `PyJWT`. **No** django-ninja, **no**
  whitenoise.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Drift check | `cd /home/admincrm/grancrm && git diff --stat 896ca8e..HEAD -- incitrack/` | reviewed |
| Django check | `cd /home/admincrm/grancrm/incitrack && python manage.py check` | `System check identified no issues` |
| API smoke (ninja auto-docs) | `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8000/incitrack/api/v1/docs` | `200` (when server running) |
| Authed endpoint (needs a valid cookie) | `curl -s -H "Cookie: grancrm_session=<token>" http://127.0.0.1:8000/incitrack/api/v1/tickets/` | JSON list |

> Use the InciTrack venv/interpreter (the one gunicorn runs). `manage.py` is at
> `/home/admincrm/grancrm/incitrack/manage.py`. A valid `grancrm_session` token
> for the last test is obtained by logging into the orquestador in a browser and
> copying the cookie, or ask the operator — **do not fabricate or print secrets.**

## Scope

**In scope:**
- `incitrack/requirements.txt` (add `django-ninja`, `whitenoise`)
- `incitrack/grancrm_auth/` (new — copied from `/home/admincrm/orquestador/grancrm_auth/`)
- `incitrack/incitrack/settings.py` (middleware alignment only)
- `incitrack/tickets/api.py` (new — the django-ninja `Router`/`NinjaAPI`)
- `incitrack/tickets/schemas.py` (new — ninja `Schema` request/response models)
- `incitrack/incitrack/urls.py` (mount the API under `api/v1/`)
- `incitrack/tickets/tests/test_api.py` (new — see Test plan)

**Out of scope (do NOT touch):**
- `tickets/views.py` and the Django templates — they keep working until Plan 005.
  You are **adding** an API beside them, not replacing them yet.
- `tickets/models.py`, `tickets/mixins.py` logic — reuse, don't rewrite. (You may
  import from `mixins.py`; do not change its behavior.)
- `utils/tenant_*.py` — tenant routing already works; leave it.
- Anything under `frontend/` — that's Plans 002/003.

## Git workflow

- Branch: `feature/incitrack-native-api`
  (`cd /home/admincrm/grancrm && git checkout -b feature/incitrack-native-api`).
  Server rule (`SERVER_CONTEXT.md`): work on `feature/...`, never push to main.
- Commit per logical unit (deps, auth, schemas, endpoints, tests). Conventional
  commits, e.g. `feat(incitrack): add django-ninja tickets API`.
- Do not push or open a PR unless asked.

## Steps

### Step 1: Add dependencies

Add to `incitrack/requirements.txt`:

```
django-ninja
whitenoise
```

Install into the InciTrack venv (`pip install -r requirements.txt`). If you
cannot install (no venv access), STOP and hand off — the rest needs the package.

**Verify**: `python -c "import ninja, whitenoise; print('ok')"` → `ok`

### Step 2: Align the auth middleware to the contract (guide §1.6 / §2.3.2)

Copy the auth package and add whitenoise, **without** breaking the existing
working middlewares:

1. `cp -r /home/admincrm/orquestador/grancrm_auth /home/admincrm/grancrm/incitrack/grancrm_auth`
   (this sets `request.jwt_payload` early — what the API auth reads).
2. In `incitrack/incitrack/settings.py` `MIDDLEWARE`, add whitenoise right after
   `SecurityMiddleware`, and add `grancrm_auth.middleware.GranCRMAuthMiddleware`
   **before** `tickets.grancrm_session.GranCRMSessionMiddleware` and
   `utils.tenant_middleware.TenantDatabaseMiddleware`. Final order:

   ```python
   MIDDLEWARE = [
       'django.middleware.security.SecurityMiddleware',
       'whitenoise.middleware.WhiteNoiseMiddleware',
       'django.contrib.sessions.middleware.SessionMiddleware',
       'django.middleware.common.CommonMiddleware',
       'django.middleware.csrf.CsrfViewMiddleware',
       'django.contrib.auth.middleware.AuthenticationMiddleware',
       'grancrm_auth.middleware.GranCRMAuthMiddleware',     # sets request.jwt_payload
       'tickets.grancrm_session.GranCRMSessionMiddleware',  # get_or_create local user + login
       'utils.tenant_middleware.TenantDatabaseMiddleware',  # activate tenant DB
       'django.contrib.messages.middleware.MessageMiddleware',
       'django.middleware.clickjacking.XFrameOptionsMiddleware',
   ]
   ```

   > If `grancrm_auth.middleware` expects settings InciTrack lacks, read the
   > package's README and add only what it needs. Keep `GRANCRM_JWT_SECRET`,
   > `GRANCRM_ORCHESTRATOR_URL` as they are (already in settings, from env).

**Verify**: `cd incitrack && python manage.py check` → `System check identified no issues`
**Verify**: `python -c "import incitrack.settings"` does not raise (settings import OK).

### Step 3: Define ninja schemas mirroring the model data

In `incitrack/tickets/schemas.py`, create ninja `Schema` classes for the
read/write shapes the UI needs, derived from `tickets/models.py`. At minimum:
`TicketOut`, `TicketListItemOut`, `TicketCreateIn`, `TicketEditIn`,
`ComentarioIn`/`ComentarioOut`, `DashboardStatsOut`, `UsuarioOut`/`In`,
`CuentaOut`/`In`, `NotificacionOut`/`In`, `SLAOut`/`In`, plus the lookup shapes
already returned by `SubcategoriasAjaxView`/`SLAAjaxView`.

Match field names to the model fields so the React side maps 1:1. Read each
model before writing its schema.

### Step 4: Build the API, reusing the visibility mixins

In `incitrack/tickets/api.py`, create a `NinjaAPI` (or `Router`) with endpoints
that **call the same visibility helpers** the views use. Authenticate every
endpoint off `request.jwt_payload` (set by `GranCRMAuthMiddleware`); return 401
when it's missing (the React client turns 401 into `sessionExpired`, guide
§2.2.3). Endpoints (mirror the view logic referenced in Current state):

- `GET  /dashboard/` → `DashboardStatsOut` (mirror `DashboardView`)
- `GET  /tickets/` (query filters) → `list[TicketListItemOut]`, filtered through
  `tickets_visibles(request.user)`
- `GET  /tickets/{id}/` → `TicketOut` (apply `puede_ver_ticket`)
- `POST /tickets/` → create (mirror `TicketNuevoView`, incl. SLA + notification
  side effects via `email_service.notificar_nuevo_ticket`)
- `PUT  /tickets/{id}/` → edit; `POST /tickets/{id}/cerrar/` → close;
  `POST /tickets/{id}/comentarios/` → add comment
- `GET  /lookups/subcategorias/`, `GET /lookups/sla/` → reuse existing AJAX logic
- Admin (guard with the role check from `SoloAdminMixin`/`AdminOJefeMixin`):
  `GET/POST/PUT/DELETE /usuarios/`, `/cuentas/`, `/notificaciones/`, `/sla/`

For roles, read `request.jwt_payload["rol"]` (`sa`/`admin`/`ejecutivo`) and/or
`request.user.rol` (already synced). Reuse the mapping in `grancrm_session.py`.

**Verify** (server running): `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8000/incitrack/api/v1/docs` → `200`

### Step 5: Mount the API under `/incitrack/api/v1/`

In `incitrack/incitrack/urls.py`, include the ninja api so it serves at
`api/v1/` *within* the `/incitrack/` prefix the gateway proxies (Call Reviews
serves at `/callreviews/api/v1/` — mirror that). Example:

```python
from tickets.api import api as ninja_api
urlpatterns = [
    path('incitrack/api/v1/', ninja_api.urls),
    # ... existing incitrack/ template routes stay for now ...
]
```

**Verify**: `python manage.py check` → no issues; `curl` the `/docs` URL → 200.

## Test plan

Create `incitrack/tickets/tests/test_api.py` (Django `TestCase` +
ninja `TestClient` or Django `Client`). InciTrack has no test suite yet; keep it
one file, no new framework (use Django's built-in test runner). Cover:

- **Auth**: request without a valid `grancrm_session` / `request.jwt_payload` →
  401.
- **Visibility**: a `supervisor` user sees only their visible tickets
  (`tickets_visibles`), not another tenant's — assert the list is filtered.
- **Create**: `POST /tickets/` creates a ticket and returns it.
- **Role guard**: a non-admin calling an admin endpoint → 403.

Run: `cd incitrack && python manage.py test tickets` → all pass.

> If the test DB cannot be created against SQL Server in this environment, set up
> a sqlite test DB in test settings OR document that tests were run manually with
> `curl` and report which cases you verified. Do not skip the visibility test
> silently.

## Done criteria

ALL must hold:

- [ ] `python manage.py check` exits 0
- [ ] `requirements.txt` includes `django-ninja` and `whitenoise`
- [ ] `grancrm_auth/` exists in InciTrack and `GranCRMAuthMiddleware` is in
      `MIDDLEWARE` before the tenant/session middlewares
- [ ] `/incitrack/api/v1/docs` returns 200 with the server running
- [ ] Every endpoint in Step 4 exists and an unauthenticated call returns 401
- [ ] `tickets/tests/test_api.py` exists; `python manage.py test tickets` passes
      (or manual verification is documented per the note)
- [ ] No file outside the in-scope list is modified (`git status`)
- [ ] `plans/README.md` row for 001 updated

## STOP conditions

Stop and report (do not improvise) if:

- `tickets/views.py` / `mixins.py` differ materially from the references above
  (drift since `896ca8e`).
- `grancrm_auth.middleware` requires settings or a `User` shape InciTrack can't
  satisfy (InciTrack uses a custom `AUTH_USER_MODEL = tickets.Usuario`).
- The test DB cannot be created and you cannot configure a sqlite test fallback.
- You find an endpoint whose view logic you cannot faithfully reproduce — report
  which view and why, rather than guessing the business rule.

## Maintenance notes

- The API and the old template views temporarily coexist; both read the same
  models/mixins, so behavior stays consistent. Plan 005 deletes the templates.
- A reviewer should check that **every** endpoint applies `tickets_visibles` /
  `cuentas_visibles` / the role guards — a missing filter is a tenant data leak.
- If new ticket fields are added later, update both the model and the ninja
  schema (they're decoupled on purpose).
