# Plan 005: Remove the legacy Django templates / navbar

> **Executor instructions**: Do this ONLY after Plan 004 is verified DONE and the
> React SPA fully serves InciTrack in production. Follow step by step, run every
> verification, honor STOP conditions. Update `plans/README.md` when done.
>
> **Drift check (run first)**:
> `git diff --stat 896ca8e..HEAD -- incitrack/tickets/templates incitrack/tickets/urls.py incitrack/incitrack/urls.py`

## Status

- **Priority**: P2 (cleanup — the migration is functionally complete after 004)
- **Effort**: S
- **Depends on**: plans/004-register-spa-remote-and-gateway.md (must be DONE +
  verified live)
- **Risk**: MED (deletes code; reversible via git, but don't do it before the SPA
  is proven)
- **Category**: tech-debt
- **Planned at**: commit `896ca8e`, 2026-06-18

## Why this matters

Once the shell serves InciTrack as a React remote and the gateway routes
`/incitrack/` page requests to the SPA (Plan 004), the Django HTML templates and
their navbar are dead code — never reached, but still carrying their own
sidebar/topbar and a hardcoded "Módulos" menu with absolute
`http://172.20.21.248:PORT` links (`base.html:127-130`). Removing them prevents
confusion ("which navbar is real?"), eliminates the stale absolute URLs, and
leaves the backend as a clean API + admin service.

## Current state

- `incitrack/tickets/templates/` — full Duralux templates incl.
  `base.html` (its own `nav.nxl-navigation` sidebar + `header.nxl-header` topbar
  + hardcoded module links) and per-page templates that extend it.
- `incitrack/tickets/views.py` — class-based views that `render()` those
  templates (the HTML pages). The **API** (Plan 001, `tickets/api.py`) is what
  the SPA uses now; these render-views are superseded.
- `incitrack/incitrack/urls.py` + `tickets/urls.py` — route the `/incitrack/...`
  paths to those render-views. After Plan 004 the gateway sends page requests to
  the SPA, so these Django page routes are no longer hit — **except** any the API
  or admin still need.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Django check | `cd incitrack && python manage.py check` | no issues |
| API still works | `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8000/incitrack/api/v1/docs` | `200` |
| No template refs left | `grep -rn "render(" incitrack/tickets/views.py` | only non-page helpers, if any |

## Scope

**In scope:**
- `incitrack/tickets/templates/` (delete the page templates + `base.html` and the
  `.bak` variants)
- `incitrack/tickets/views.py` (remove the HTML-render views; keep anything the
  API imports)
- `incitrack/tickets/urls.py`, `incitrack/incitrack/urls.py` (remove the page
  routes; **keep** `api/v1/`, `admin/` if used, `media/`, and the `assets/`
  static route only if still needed)

**Out of scope (do NOT delete):**
- `tickets/api.py`, `tickets/schemas.py`, `tickets/mixins.py`, `tickets/models.py`,
  `email_service.py`, `grancrm_session.py`, `grancrm_auth/`, `utils/` — all still
  used by the API/auth/tenant layers.
- The Django **admin** (if InciTrack exposes `/incitrack/admin/`) — leave it.
- `dios.json`, gateway — done in Plan 004.

## Git workflow

- Branch: `feature/incitrack-remove-legacy-templates`.
- One or two commits: `chore(incitrack): remove legacy Django templates and page views`.
- Do not push/PR unless asked.

## Steps

### Step 1: Confirm the SPA is live and the page routes are dead
Before deleting anything, confirm in production that `/incitrack/` serves the
shell SPA (Plan 004 Step 5 passed). If not, **STOP** — do not delete templates
while Django is still serving the UI.

### Step 2: Remove the HTML-render views
In `tickets/views.py`, delete the views that only `render()` a template
(Dashboard/Ticket*/Usuario*/Cuenta*/Notificacion*/SLA* HTML pages). Keep any
function the API imports. If a view mixes API-relevant logic, that logic should
already live in `mixins.py`/`api.py` — confirm before deleting.

**Verify**: `python manage.py check` → no issues (no broken imports).

### Step 3: Remove the page URL routes
In `tickets/urls.py` and `incitrack/incitrack/urls.py`, remove the routes that
pointed at the deleted views. **Keep** `incitrack/api/v1/`, `admin/` (if used),
`media/`. Remove the `assets/` static-serve route only if nothing else needs it.

**Verify**: `python manage.py check` → no issues.
**Verify**: `curl …/incitrack/api/v1/docs` → 200 (API unaffected).

### Step 4: Delete the templates
Delete `incitrack/tickets/templates/` page templates incl. `base.html`,
`base.html.bak`, and the `.bak` page variants. Keep `registration/login.html`
only if the standalone login is still wanted as a fallback (it should not be —
login is the orquestador's job, guide §2.0; remove it unless the operator says
otherwise).

**Verify**: `python manage.py check` → no issues. The app boots and the API
serves; no `TemplateDoesNotExist` on any API path.

## Test plan

- Re-run the Plan 001 API tests: `python manage.py test tickets` → still pass
  (the API must be unaffected by removing the page layer).
- Manual: in the shell, every InciTrack page still works (it's React now);
  hitting an old Django page URL directly returns the SPA (gateway) or 404 from
  Django — either is acceptable, a broken template render is not.

## Done criteria

ALL must hold:

- [ ] `python manage.py check` exits 0
- [ ] `incitrack/tickets/templates/` page templates + `base.html` deleted
- [ ] No remaining view renders a deleted template (`grep` clean)
- [ ] `api/v1/docs` returns 200; `python manage.py test tickets` passes
- [ ] `admin/` (if used) and `media/` still route
- [ ] `git status` shows only in-scope deletions/edits
- [ ] `plans/README.md` row for 005 updated → migration complete

## STOP conditions

Stop and report if:

- The SPA is not confirmed live in production (Step 1) — do not delete.
- A "render view" turns out to contain business logic not present in
  `api.py`/`mixins.py` — extract it first (report), don't lose it.
- Removing a URL route breaks the API or admin (`manage.py check` fails or a
  needed path 404s).

## Maintenance notes

- After this, InciTrack's backend is a pure JSON API + Django admin; its UI lives
  entirely in `frontend/`. Document this in the InciTrack README so nobody looks
  for server-rendered pages.
- The `dios.json` `nav` is now the only place the sidebar is defined.
- Reviewer: confirm nothing user-facing depended on a deleted template (search
  the frontend for any link that assumed a Django page).
