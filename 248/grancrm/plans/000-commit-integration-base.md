# Plan 000: Commit InciTrack's integration WIP as a clean base (PRECONDITION)

> Discovered while trying to execute Plan 001: InciTrack's JWT/SSO + multi-tenant
> integration exists only as **uncommitted** changes in the working tree, and the
> committed `settings.py` references middleware files that aren't committed. No
> plan (001–005) can be executed against a commit until this is fixed.

## Status

- **Priority**: P0 (blocks everything)
- **Effort**: S
- **Risk**: LOW (a commit; reversible)
- **Depends on**: none
- **Category**: tech-debt / hygiene
- **Planned at**: commit `896ca8e`, 2026-06-18

## Why this matters

At `896ca8e`, `incitrack/incitrack/settings.py` lists
`tickets.grancrm_session.GranCRMSessionMiddleware` and
`utils.tenant_middleware.TenantDatabaseMiddleware` in `MIDDLEWARE`, but those
files are **untracked**. The committed tree therefore won't import. The real,
running app works only because the working tree has the untracked files. Any
isolated execution (git worktree) or fresh clone gets a broken codebase. Commit
the integration so there is a real, self-consistent base.

## Current state (verify, then commit)

From `/home/admincrm/grancrm`, `git status --porcelain -- incitrack/` shows the
WIP. The integration-critical **untracked** paths are:

- `incitrack/tickets/grancrm_session.py` — JWT session middleware (user sync)
- `incitrack/utils/` — `tenant_middleware.py`, `tenant_router.py`, `dios_registration.py`, `__init__.py`
- `incitrack/dios.json` — orquestador self-registration manifest
- `incitrack/tickets/migrations/0001_initial.py` — the initial migration (!)

Plus **modified** files that are part of the same integration (settings, urls,
models, mixins, views, apps.py, templates, requirements, Dockerfile, etc.).

**Do NOT commit secrets**: `incitrack/.env` and `incitrack/.env.bak-fase1` are
untracked and contain credentials (`DB_PASSWORD`, `GRANCRM_JWT_SECRET`,
`EMAIL_HOST_PASSWORD` — loaded from env). Confirm `.env*` is in `.gitignore`;
**do not** add it to the commit. `.env.example` is the committable template.

## Steps

### Step 1: Confirm the gitignore protects secrets
`grep -n "env" /home/admincrm/grancrm/incitrack/.gitignore /home/admincrm/grancrm/.gitignore 2>/dev/null`
If `.env` is not ignored, add `.env` and `*.bak-*` to `.gitignore` first.
**Verify**: `git -C /home/admincrm/grancrm status --porcelain -- incitrack/.env` → empty (ignored).

### Step 2: Stage the integration, excluding secrets and caches
On a branch (`git checkout -b feature/incitrack-integration-base`), stage the
untracked integration files + the related modifications, but NOT `.env*`, NOT
`__pycache__/`, NOT `*.bak`/`*.bak-fase*` backups.
**Verify**: `git status --porcelain | grep -E '\.env|__pycache__|\.bak'` → empty
(none staged).

### Step 3: Sanity-check the base imports cleanly
Build the image from the staged tree and run check (no DB needed):
`docker build -t incitrack-base /home/admincrm/grancrm/incitrack && docker run --rm --env-file /home/admincrm/grancrm/incitrack/.env -e DJANGO_SETTINGS_MODULE=incitrack.settings incitrack-base python manage.py check`
**Verify**: `System check identified no issues` — i.e. every middleware in
`settings.py` resolves to a committed file.

### Step 4: Commit
`git commit -m "chore(incitrack): commit JWT/SSO + multi-tenant integration base"`
**Verify**: `git stash -u && git -C <fresh worktree at the new commit> ...` is not
required — just confirm `git status --porcelain -- incitrack/` no longer lists
the integration files as untracked, and Step 3 passed.

## Done criteria

- [ ] `grancrm_session.py`, `utils/`, `dios.json`, `migrations/0001_initial.py`
      are tracked (`git ls-files` lists them)
- [ ] No `.env*`, `__pycache__`, or `.bak*` files are tracked
      (`git ls-files incitrack/ | grep -E '\.env|pycache|\.bak'` → empty)
- [ ] `manage.py check` passes on the committed tree (Step 3)
- [ ] A new short SHA exists; record it — plans 001–005 must be re-stamped against
      it (their drift checks currently reference `896ca8e`)

## STOP conditions

- A secret value would be committed (`.env` not ignored) — STOP, fix gitignore.
- `manage.py check` fails after staging — a referenced file is still missing;
  report which.

## Maintenance notes

- After this lands, re-run the Plan 001 execution against the NEW base commit.
  The blocked branch `feature/incitrack-native-api` (worktree
  `/home/admincrm/grancrm-wt-001`) holds usable django-ninja artifacts to salvage
  — but re-validate them against the now-committed `models.py`/`mixins.py` and do
  NOT take its `settings.py` (it dropped the session/tenant middleware).
- Update the `Planned at` SHA in plans 001–005 to the new base commit.
