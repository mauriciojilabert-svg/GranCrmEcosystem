# Plan 004: Register InciTrack as `spa_remote` + gateway split + deploy & verify

> **Executor instructions**: Follow step by step. Several steps are operational
> (gateway reload, service restart) and may need operator access — they are
> marked. Run every verification. If a "STOP condition" occurs, stop and report.
> Update `plans/README.md` when done.
>
> **Drift check (run first)**:
> `git diff --stat 896ca8e..HEAD -- incitrack/dios.json` and
> `grep -n incitrack /home/admincrm/gateway/nginx.conf`

## Status

- **Priority**: P1
- **Effort**: M
- **Depends on**: plans/003-port-pages-to-react.md (the SPA must work before you
  flip the gateway to serve it)
- **Risk**: MED (gateway change is user-facing; fully reversible by reverting the
  nginx block)
- **Category**: migration
- **Planned at**: commit `896ca8e`, 2026-06-18

## Why this matters

This is the switch that makes the shell mount InciTrack as a native MF remote
(not the legacy iframe) and routes `/incitrack/` page requests to the shell SPA
while keeping API/admin/media on the Django backend. Done correctly, InciTrack
appears in the shell's "Módulos" menu and mounts without a re-login, exactly
like Call Reviews.

## Read first

- `GUIA_INTEGRACION_APP_SATELITE.md` — **§2.4** (`dios.json` spa_remote fields),
  **§2.5** (gateway split: `/incitrack/api/`,`/admin/`,`/media/` → backend; rest
  → shell SPA), **§2.6** (docker/env), **§2.7** (acceptance checklist).
- Reference: `call_reviews/dios.json` (spa_remote fields) and the
  `callreviews` location blocks in `/home/admincrm/gateway/nginx.conf`.

## Current state

- `incitrack/dios.json` — has `nombre`, `url_publica:"/incitrack/"`, `nav`, but is
  **missing** `modo`, `slug`, `route_prefix`, `remote_entry_url`, `remote_scope`,
  `contract_version`. Without `modo`, DIOS defaults it to `external_link`.
- `gateway/nginx.conf` — currently proxies `/incitrack/` wholesale to the Django
  backend on `:8000` (the legacy/iframe arrangement: lines ~96-99, with
  `proxy_hide_header X-Frame-Options` + `frame-ancestors 'self'`). This must be
  replaced by the spa_remote split.
- The MF bundle is built by Plan 002/003 to the outDir the gateway `/mf/` block
  serves (confirm: `/home/admincrm/staticfiles/mf/incitrack/remoteEntry.js`).
- Self-registration runs on InciTrack boot (`tickets/apps.py → register_with_dios`).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| dios.json valid | `python -m json.tool incitrack/dios.json >/dev/null && echo OK` | `OK` |
| Re-register (localhost) | `curl -s -X POST http://127.0.0.1:9000/internal/register-app/ -H 'Content-Type: application/json' --data @incitrack/dios.json` | `{"status":"ok"}` |
| Confirm row | (on orquestador) `python manage.py shell -c "from core.models import Aplicacion;a=Aplicacion.objects.get(nombre='InciTrack');print(a.modo,a.route_prefix,a.remote_scope)"` | `spa_remote /incitrack incitrack` |
| remoteEntry served | `curl -s -o /dev/null -w '%{http_code}' https://<host>/mf/incitrack/remoteEntry.js -k` | `200` |
| nginx syntax | `docker exec gateway-nginx-1 nginx -t` | `syntax is ok` / `test is successful` |

## Scope

**In scope:**
- `incitrack/dios.json` (add MF fields)
- `gateway/nginx.conf` (replace the `/incitrack/` block with the spa_remote split)
- `incitrack/.env.docker` / docker-compose (only if env vars are missing per §2.6)

**Out of scope:**
- Frontend/backend code (Plans 001-003).
- Other apps' nginx blocks or dios.json (don't "fix" WSP/Pompeyo here — that's
  the guide's separate backlog §2.9).

## Git workflow

- `incitrack/dios.json` change → InciTrack repo, branch `feature/incitrack-spa-register`.
- `gateway/nginx.conf` is in the **gateway repo** (`/home/admincrm/gateway`) —
  separate repo; commit there on its own `feature/...` branch.
- Do not push/PR unless asked.

## Steps

### Step 1: Add the MF fields to `dios.json` (guide §2.4)

Add to `incitrack/dios.json` (keep `url_publica` relative `/incitrack/` and the
existing `nav`):

```json
    "modo": "spa_remote",
    "slug": "incitrack",
    "route_prefix": "/incitrack",
    "remote_entry_url": "https://172.20.21.248/mf/incitrack/remoteEntry.js",
    "remote_scope": "incitrack",
    "contract_version": "1",
```

> `remote_scope` **must equal** the vite `name` from Plan 002 (`incitrack`).
> `remote_entry_url` is **relative to the host over HTTPS** — match how
> `call_reviews/dios.json` writes it. If the platform uses a domain instead of
> the IP, use the same host form as Call Reviews.

**Verify**: `python -m json.tool incitrack/dios.json >/dev/null && echo OK` → `OK`

### Step 2: Re-register with DIOS

**Operational.** Either restart InciTrack (triggers `register_with_dios`) or POST
directly:

```bash
curl -s -X POST http://127.0.0.1:9000/internal/register-app/ \
  -H 'Content-Type: application/json' --data @/home/admincrm/grancrm/incitrack/dios.json
```

**Verify**: response `{"status":"ok"}`. If `unauthorized`, the `secret` in
dios.json ≠ DIOS `DIOS_REGISTER_SECRET` → **STOP** (don't guess secrets).
**Verify** (Step "Confirm row" command): prints `spa_remote /incitrack incitrack`.

> If the orquestador DB errors with `no such column: modo`, its migrations aren't
> applied on the live DB — **STOP** and hand off (do not migrate a prod DB
> without operator sign-off; server rule).

### Step 3: Replace the gateway `/incitrack/` block with the spa_remote split (guide §2.5)

In `/home/admincrm/gateway/nginx.conf`, replace the single `location /incitrack/`
proxy with:

```nginx
# InciTrack API / admin / media -> Django backend (:8000)
location /incitrack/api/ {
    proxy_pass http://127.0.0.1:8000/incitrack/api/;
}
location /incitrack/admin/ {
    proxy_pass http://127.0.0.1:8000/incitrack/admin/;
}
location /incitrack/media/ {
    proxy_pass http://127.0.0.1:8000/incitrack/media/;
}
# Everything else under /incitrack/ -> shell SPA (React Router takes over)
location /incitrack/ {
    root /home/admincrm/staticfiles/shell;
    try_files /index.html =404;
    add_header Cache-Control "no-store" always;
}
```

> Match the exact `proxy_pass` path style of the working `callreviews` blocks in
> the same file (trailing-slash semantics matter in nginx). Keep the global
> `proxy_set_header` / `X-Forwarded-*` lines. The `remoteEntry.js` is already
> served by the existing `/mf/` block — don't add one.

**Verify**: `docker exec gateway-nginx-1 nginx -t` → `test is successful`.

### Step 4: Reload gateway and deploy the bundle

**Operational** (guide §2.5/§2.6):
```bash
docker compose -f /home/admincrm/gateway/docker-compose.yml up -d
docker exec gateway-nginx-1 nginx -s reload
```
Ensure the built `remoteEntry.js` is present at the served path (Plan 002/003
build output → `/home/admincrm/staticfiles/mf/incitrack/`).

**Verify**: `curl -sk -o /dev/null -w '%{http_code}' https://<host>/mf/incitrack/remoteEntry.js` → `200`.

### Step 5: End-to-end verification (guide §2.7)

In a browser, logged into the shell as a user with InciTrack access (app id 4):
- InciTrack appears in the **Módulos** menu.
- Clicking it navigates to `…/incitrack` and **mounts the React remote** (not an
  iframe — confirm via DevTools: no `<iframe>`, the content is in the shell DOM).
- No re-login. API calls (Network tab) hit `/incitrack/api/v1/…` and return 200
  with the cookie.
- Switching tenant/account changes the data (multi-tenant works).
- Logout then revisiting redirects to login.

## Test plan

This plan is config/infra; verification is the command checks above plus the
Step 5 manual end-to-end (which is the real acceptance test — guide §2.7
"Verificación funcional"). Record which checklist items passed.

## Done criteria

ALL must hold:

- [ ] `dios.json` valid; has `modo:spa_remote`, `slug:incitrack`,
      `route_prefix:/incitrack`, `remote_scope:incitrack`, MF `remote_entry_url`
- [ ] Re-registration returned `{"status":"ok"}` and the `Aplicacion` row shows
      `spa_remote` (or the DB-migration blocker is documented + handed off)
- [ ] `nginx -t` passes; `/incitrack/api/` → backend, `/incitrack/` → shell SPA
- [ ] `https://<host>/mf/incitrack/remoteEntry.js` returns 200
- [ ] Step 5 end-to-end: InciTrack mounts as a remote (no iframe), API 200, no
      re-login — documented
- [ ] `git status` in each repo shows only the in-scope files
- [ ] `plans/README.md` row for 004 updated

## STOP conditions

Stop and report if:

- Re-registration returns `unauthorized` (secret mismatch).
- The orquestador DB lacks the `modo` column and you can't migrate safely.
- `nginx -t` fails and a single obvious fix doesn't resolve it (revert the block;
  InciTrack stays up on the old proxy).
- The remote fails to mount with `Cannot use import statement outside a module`
  (missing `type:'esm'` in the shell's `registerRemotes` — that's a shell issue,
  guide §2.8) or `container.get is not a function` (`remote_scope` ≠ vite `name`)
  — report which.

## Maintenance notes

- Rollback = revert the `gateway/nginx.conf` block to the single proxy_pass and
  set `dios.json` `modo` back; InciTrack returns to serving its Django pages.
- After this lands, sidebar changes are done via `dios.json` `nav` only.
- `remote_entry_url` host must track any domain change (it's the one place a host
  appears — keep it consistent with the other apps' dios.json).
- Reviewer: confirm `/incitrack/api/` is matched **before** `/incitrack/` in
  nginx (location ordering) so API calls don't fall through to the SPA.
