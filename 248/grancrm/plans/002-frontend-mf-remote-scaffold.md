# Plan 002: Frontend — scaffold the `incitrack` Module-Federation remote

> **Executor instructions**: Follow step by step. Run every verification command
> and confirm its expected result before moving on. Read the referenced guide
> sections before coding. If a "STOP condition" occurs, stop and report. When
> done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**:
> `ls /home/admincrm/grancrm/incitrack/frontend 2>/dev/null` — if it already
> exists, STOP and report (someone started this); do not overwrite.

## Status

- **Priority**: P1
- **Effort**: M
- **Depends on**: plans/001-backend-json-api.md
- **Risk**: LOW (new directory; nothing existing is modified)
- **Category**: migration
- **Planned at**: commit `896ca8e`, 2026-06-18

## Why this matters

This creates the React + Vite + Module-Federation remote that the shell will
mount for InciTrack — the "native" container. After this plan InciTrack mounts
inside the shell as a real SPA (initially near-empty), proving the contract
works end-to-end before the pages are ported (Plan 003). Getting the MF
contract exactly right here (it's full of subtle gotchas) de-risks everything
after.

## Read first (authoritative spec)

- `GUIA_INTEGRACION_APP_SATELITE.md` — **§1.5** (mount contract +
  `GranCrmRemoteProps`), **§2.2** (the entire frontend section: vite config,
  `App.tsx`, `apiFetch`, bus), **§2.8** (gotchas — `type:'esm'`, singletons,
  exposes `./App`).
- **Copy from Call Reviews** (`/home/admincrm/call_reviews/frontend/`): this is a
  working remote. Mirror `vite.config.ts`, `src/App.tsx`, `src/main.tsx`,
  `src/api.ts`, `src/context.tsx`, `src/types.ts`. Change names from
  `callreviews` → `incitrack` and the dev port/proxy target.

## Current state

- InciTrack has **no** `frontend/` directory. You are creating it from scratch.
- The shell mounts remotes via
  `/home/admincrm/orquestador/frontend/shell/src/remotes/RemoteMount.tsx`
  (uses `registerRemotes([{ name, entry, type:'esm' }])` then
  `loadRemote('<scope>/App')`). Your remote must satisfy that.
- The contract type source of truth:
  `/home/admincrm/orquestador/frontend/packages/grancrm-ui/src/contract.ts`.
  External repos copy it to `src/types.ts` (guide §1.5). Copy it; do not invent.
- Call Reviews' `vite.config.ts` (the exact pattern to mirror) builds to
  `../static/mf/callreviews` by default (overridable via `VITE_MF_OUT_DIR`),
  `name: 'callreviews'`, `exposes: { './App': './src/App.tsx' }`, dev port `7001`
  with a proxy rewriting `/callreviews` → `:7000`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Node/pnpm available | `node -v && corepack pnpm -v` | versions print |
| Install | `cd /home/admincrm/grancrm/incitrack/frontend && corepack pnpm install` | exit 0 |
| Typecheck | `corepack pnpm exec tsc --noEmit` | exit 0, no errors |
| Build the remote | `corepack pnpm build` | emits `remoteEntry.js` in the outDir |
| Confirm bundle | `ls <outDir>/remoteEntry.js` | file exists |

> `pnpm` is via `corepack enable` (memory: not on PATH otherwise; node in
> `~/.nvm`). If `pnpm-workspace.yaml` has the broken `esbuild:` placeholder, set
> it to `esbuild: true` or run with `--config.verify-deps-before-run=false`
> (memory note for this server).

## Scope

**In scope (all new, under `incitrack/frontend/`):**
- `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, `vite.config.ts`,
  `index.html`
- `src/main.tsx` (dev placeholder), `src/App.tsx` (exposes the remote),
  `src/types.ts` (copied contract), `src/api.ts` (apiFetch), `src/context.tsx`
  (session/apiBase context)

**Out of scope:**
- The Django backend — done in Plan 001; don't touch it here.
- The shell or `grancrm-ui` — no changes needed; the shell mounts any conformant
  remote generically.
- Actual page UIs — that's Plan 003. Here `App.tsx` only needs a minimal
  routed placeholder (e.g. a "InciTrack" heading + a route stub).

## Git workflow

- Branch: `feature/incitrack-mf-frontend` (or continue the native branch).
- Commit: `feat(incitrack): scaffold Module Federation remote`.
- Do not push/PR unless asked.

## Steps

### Step 1: Copy the Call Reviews frontend as the starting point

```bash
cp -r /home/admincrm/call_reviews/frontend /home/admincrm/grancrm/incitrack/frontend
rm -rf /home/admincrm/grancrm/incitrack/frontend/node_modules \
       /home/admincrm/grancrm/incitrack/frontend/dist \
       /home/admincrm/grancrm/incitrack/frontend/*.tsbuildinfo
```

Then strip Call-Reviews-specific page code out of `src/` (keep the structural
files: `main.tsx`, `App.tsx`, `api.ts`, `context.tsx`, `types.ts`,
`vite.config.ts`). You'll replace page contents in Plan 003.

### Step 2: Rename the remote `callreviews` → `incitrack`

Edit `vite.config.ts`:
- `federation({ name: 'incitrack', filename: 'remoteEntry.js', exposes: { './App': './src/App.tsx' }, shared: {react, react-dom, react-router-dom as singletons 18/18/6} })`
- default `outDir`: `../static/mf/incitrack` **and** honor `VITE_MF_OUT_DIR`.
  > IMPORTANT (memory): WSP/Pompeyo build on the host into
  > `/home/admincrm/staticfiles/mf/<scope>`. Confirm with the operator whether
  > InciTrack's `remoteEntry.js` must land in `/home/admincrm/staticfiles/mf/incitrack`
  > (what the gateway `/mf/` block serves) or `incitrack/static/mf/incitrack`.
  > The gateway `/mf/` location is the source of truth — match it. If unsure,
  > set `VITE_MF_OUT_DIR=/home/admincrm/staticfiles/mf/incitrack` at build time.
- dev `server.port`: a unique port not blocked by Chrome (guide §2.2.1 lists
  blocked ports; e.g. `8010`), and `server.proxy` rewriting `/incitrack` →
  `http://127.0.0.1:8000` (InciTrack backend port).
- In `package.json`, set `"name": "incitrack-frontend"` and keep the
  `build`/`dev` scripts.

### Step 3: Refresh the contract types

Overwrite `src/types.ts` with a copy of
`/home/admincrm/orquestador/frontend/packages/grancrm-ui/src/contract.ts`
(guide §1.5). Do not edit the interfaces.

### Step 4: Implement the mount root `src/App.tsx` (guide §2.2.2)

`export default function App({ contractVersion, basename, apiBase, session, bus }: GranCrmRemoteProps)`:
- **No** `<BrowserRouter>` (the shell provides the router + `basename`).
- Register the `grancrm:sessionExpired` window listener → `bus.emit('sessionExpired')`.
- Render a minimal `<Routes>` with one placeholder route (e.g. `index` → a
  component showing `InciTrack — {session.nombre}`), `path="*"` → `<Navigate to="." />`.
- Store `apiBase` + `session` in `src/context.tsx` so Plan 003 pages read them
  (this satisfies the "portable / use apiBase" requirement, guide MEDIO-1).

### Step 5: `src/api.ts` — the HTTP client (guide §2.2.3)

`apiFetch(path, init)` with `credentials:'include'`, `X-CSRFToken` header from
the `csrftoken` cookie, and `401 → window.dispatchEvent(new CustomEvent('grancrm:sessionExpired'))`.
Build URLs from `apiBase` (e.g. `${apiBase}api/v1/tickets/`), not a hardcoded
prefix.

### Step 6: Build and confirm the bundle

```bash
cd /home/admincrm/grancrm/incitrack/frontend
corepack pnpm install
corepack pnpm exec tsc --noEmit
corepack pnpm build
```

**Verify**: `tsc --noEmit` → no errors.
**Verify**: `remoteEntry.js` exists in the outDir (Step 2). It will be served at
`https://<host>/mf/incitrack/remoteEntry.js` once Plan 004 wires registration.

## Test plan

No unit tests for the scaffold (there is nothing meaningful to assert yet; YAGNI
— Plan 003 adds tests with the pages). Verification is the typecheck + a
successful build emitting `remoteEntry.js`, plus the contract conformance
checklist:

- `App.tsx` `export default` accepts `GranCrmRemoteProps`, no `BrowserRouter`,
  has the `sessionExpired` listener.
- `vite.config.ts`: `name:'incitrack'`, `exposes:{'./App'}`, singletons 18/18/6.

(Full end-to-end mount in the shell is verified in Plan 004, after registration.)

## Done criteria

ALL must hold:

- [ ] `incitrack/frontend/` exists with the structural files listed in Scope
- [ ] `corepack pnpm exec tsc --noEmit` exits 0
- [ ] `corepack pnpm build` emits `remoteEntry.js` in the configured outDir
- [ ] `vite.config.ts` has `name:'incitrack'`, `exposes:{'./App':'./src/App.tsx'}`,
      react/react-dom/react-router-dom as `singleton` (18/18/6)
- [ ] `src/types.ts` is a verbatim copy of the orquestador contract
- [ ] `src/App.tsx` exports default, typed `GranCrmRemoteProps`, no `BrowserRouter`,
      has the `grancrm:sessionExpired` listener
- [ ] `plans/README.md` row for 002 updated

## STOP conditions

Stop and report if:

- `incitrack/frontend/` already exists (don't overwrite).
- The build can't resolve `@module-federation/vite` or the singleton React
  versions don't match the shell's (18/18/6) — report the mismatch (a wrong
  major causes the "two Reacts / blank screen" gotcha, §2.8).
- You cannot determine the correct `outDir` from the gateway `/mf/` block — ask
  the operator rather than guessing where `remoteEntry.js` is served from.

## Maintenance notes

- `src/types.ts` must be re-synced by hand whenever the orquestador's
  `contract.ts` changes (the package isn't published — guide §1.2). Note this in
  the PR.
- The dev `server.proxy` target (`:8000`) must match the InciTrack backend port;
  if that port changes, update both here and the gateway.
- Reviewer should confirm `exposes` is exactly `./App` and `remote_scope` (Plan
  004) will equal `name` here (`incitrack`) — a mismatch is the
  `container.get is not a function` gotcha.
