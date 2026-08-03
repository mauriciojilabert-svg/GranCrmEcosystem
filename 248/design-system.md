# Design system — `@duralux/ui`

**Actualizado:** 2026-07-22

`@duralux/ui` es la **librería de componentes compartida** del ecosistema GranCRM (`ecosistema.md` línea 110: *"la consumen todas las apps, CRS incluida"*), no una app satélite. Vive en `/home/admincrm/duralux-ui`. Este doc explica cómo se importa, qué reglas de consistencia rigen, y el estado real de adopción por app — para que una nueva app satélite (o un agente tocando el frontend de una existente) no reinvente el patrón ni rompa la fidelidad visual.

## Qué empaqueta

Un único paquete (`duralux-ui/CLAUDE.md`: *"único paquete compartido"*) con:

- Los ~33 componentes del theme Duralux (`src/components/{ui,form,data,charts,chat,layout,shell,conversation,feedback}/`).
- El contrato shell↔satélite (`src/contract.ts`: `GranCrmSession`, `AppManifestEntry`, `AppNavItem`, `EventBus`, `GranCrmRemoteProps`).
- Shell UI (`ShellHeader`, `ShellNav`, `ThemeScope`, `ConfirmDialog`).
- Tokens (`src/tokens.ts`), cliente API (`src/api/client.ts`), y el CSS del theme (Bootstrap 5 + tema Duralux compilado desde `scss/`).

`grancrm-ui` (antes `orquestador/frontend/packages/grancrm-ui`) está **deprecado y fusionado acá** — no crear capas intermedias nuevas.

## Regla dura: siempre git, nunca directorio local

**Ninguna app, actual o nueva, debe declarar `@duralux/ui` como `file:` a una copia local o vendorizada del paquete.** Siempre `"@duralux/ui": "github:Waryxxful/duralux-ui"` (o pineado a un commit, ver `grancrm-shell` abajo) — nunca `file:./algo`. Esto es explícito en `duralux-ui/docs/GUIA_APP_SATELITE_UI.md` y es la única forma de que todas las apps compartan el mismo componente/fix/versión sin drift.

`wsp_pompeyo` viola esta regla hoy (`file:./vendor/duralux-ui`) y por eso arrastra un shim de tipos y una capa de compatibilidad propia que reimplementa componentes que el paquete real ya tiene — ver "Deuda conocida" abajo. **No tomar `wsp_pompeyo` como referencia para una app nueva**; es la excepción a corregir, no el patrón a seguir.

## Cómo se importa

CSS/theme, según cómo corre la app:

| Contexto | Qué cargar |
|---|---|
| Remote montado en el shell (prod MF) | Nada del theme global — el shell ya lo carga una vez (`grancrm-shell/src/main.tsx`: `@duralux/ui/bootstrap.min.css` + `@duralux/ui/theme.min.css` + `@duralux/ui/styles/grancrm-ui.css`). El remote solo importa `@duralux/ui/styles/grancrm-ui.css` en su entry expuesto si necesita estilos de componente propios en el bundle federado — `@module-federation/vite` no inyecta CSS de módulos expuestos en el host, así que `call_reviews/frontend/src/App.tsx` lo importa explícito por esa razón puntual, no como regla general de "siempre cargar theme". |
| DevShell standalone (dev local fuera del shell) | Los tres: `bootstrap.min.css`, `theme.min.css`, `styles/grancrm-ui.css` (ver `call_reviews/frontend/src/main.tsx`). |
| CSS de dominio de la app | Archivo propio namespaced (`cw-*` en call_reviews: `frontend/src/call-reviews.css`), usando variables del theme (`--bs-primary`, `--duration-ui`) en vez de hex nuevos, **nunca redefiniendo** page-header/cards del theme. |

Componentes: importar directo de `@duralux/ui` en código nuevo. `call_reviews/src/components/DuraluxBridge.tsx` es un puente legacy con defaults de plantilla (`stretch=false` en `Card`, `outline` ignorado en `ActionLink`) — su propio header dice *"Preferí importar de `@duralux/ui` + `AppPage` en código nuevo"*. No repetir ese patrón de bridge en apps nuevas salvo necesidad real.

## Reglas de fidelidad visual (de la auditoría 2026-07-10)

`/home/admincrm/audits/fidelidad-duralux-2026-07-10/auditoria.md` comparó `@duralux/ui` + apps satélite contra la plantilla canónica (`/home/pancho/duralux_plantilla/duralux-admin/`) y encontró tres divergencias sistémicas, ya corregidas en el paquete (commits `197fe91`+`dd1817c`) pero que **cualquier código nuevo debe seguir respetando**:

- **Nunca `btn-outline-*`.** La plantilla no usa variantes outline. Secundario/ícono → `btn-light-brand`; destructivo → `btn-danger` sólido. El prop `outline` de `Button`/`ActionLink` está deprecado y se ignora.
- **Nunca `table-striped`.** Solo `table-hover`.
- **Nunca inventar `bg-{variant}-100`** (no existe en `theme.min.css`). Usar `bg-soft-*`.

Estas reglas están reforzadas por un gate de build en el propio paquete: `duralux-ui/scripts/audit-contract.mjs` corre antes de `vite build` y falla si detecta esas clases prohibidas. Si tu app agrega utilidades o wrappers que generan esas clases, el build del paquete (no el de tu app) te va a fallar primero — arreglalo en el componente compartido, no con un override local por app.

## Reglas de fidelidad visual (de la auditoría 2026-07-22)

Segunda pasada de auditoría, más profunda que la de 2026-07-10, cerró 9 brechas reales
contra la plantilla/producto real (commit `89b1681` en `duralux-ui`, mergeado a `master`).
Reglas nuevas que cualquier código nuevo debe respetar:

- **Status chips van por `Badge`/`StatusBadge`/`StatusButton`, no por CSS propio.**
  Antes había un sistema paralelo `.gcu-badge--*`/`.gcu-stat-card__*` sin relación con el
  SCSS Duralux real. Ya no existe — `StatusBadge`/`StatusButton`/`StatCard` son wrappers
  finos sobre `Badge`/clases Bootstrap reales. No reintroducir una hoja de estilos paralela
  para chips de estado.
- **Solo Inter está cargado.** Las otras 21 familias de Google Fonts del template original
  nunca se aplicaban (el body real usa `$font-inter`) y se sacaron del `@import`. No asumas
  que `Poppins`/`Roboto`/etc. están disponibles — no lo están.
- **`AuthLayout` ya implementa el `auth-cover-wrapper` real** (login/register/reset). Antes
  era un no-op que seteaba atributos `data-pc-*` inexistentes en Duralux. Si tu app tiene un
  flujo de auth, usalo en vez de reimplementar el layout a mano.
- **Nav/header por defecto son blancos**, no el slate `#0f172a` — ver la corrección al tope
  de `DESIGN.md`. El slate solo aparece con `app-navigation-dark`/`app-header-dark`, clases
  que ningún código del ecosistema activa hoy.
- **Nunca un hex fijo para algo que debe verse bien en dark mode fuera de una clase Bootstrap
  real.** Usar `var(--gcu-primary|muted|surface|border|text, <fallback-hex>)` — esas custom
  properties ya están definidas en `grancrm-ui.css` y cambian solas bajo `.app-skin-dark`.
- **Pin de `@duralux/ui` a un commit SHA, siempre.** `github:Waryxxful/duralux-ui` sin `#sha`
  significa que tu próximo `install` absorbe silenciosamente lo que sea que esté en `master`
  en ese momento, sin PR ni diff que revisar. Ver "Estado real de adopción" abajo — es
  exactamente el riesgo que tenía `call_reviews` cuando se hizo esta auditoría.

Detalle completo (qué se comparó, qué se descartó por no ser un problema real, qué queda
deliberadamente fuera de alcance — bundle splitting, tipos `any` ya resueltos, licencia SCSS
pendiente) en la conversación/PR que cerró `duralux-ui#fix/tokens-fidelidad-duralux`.

## `DESIGN.md` por app

[`DESIGN.md`](DESIGN.md) (en este mismo repo) es la referencia de estilo Duralux — tokens de color/tipografía/espaciado, el frame de la app, el patrón de page-header, y el mapeo de componentes. Se generó originalmente vía el skill **impeccable** a partir de `call_reviews/.impeccable/design.json`, pero su contenido es 100% genérico: no menciona nada específico de call_reviews (verificado — cero referencias a `cw-*` ni a ningún componente de esa app), porque documenta el theme compartido de `@duralux/ui`, igual en todas las apps.

**Cada app satélite (nueva o existente) debe copiar este archivo tal cual a la raíz de su repo como `DESIGN.md`.** No hace falta correr `impeccable` de nuevo ni escribirlo a mano — es el mismo theme en todas. Si el theme de `@duralux/ui` cambia de forma visible, actualizar acá y volver a copiar a cada repo.

**Pendiente (2026-07-22):** este archivo se corrigió (path de la plantilla fuente, valores de
color body/muted que estaban desactualizados, y la aclaración sobre nav/header por defecto)
después de que `call_reviews` ya había copiado una versión vieja. Volvé a copiar `DESIGN.md`
a cualquier app que ya lo tenga (`call_reviews` al menos) para que quede alineado.

## Estado real de adopción por app

| App | Cómo resuelve `@duralux/ui` | Notas |
|---|---|---|
| `call_reviews` | git, **flotando en `master` — riesgo abierto** | Puente `DuraluxBridge.tsx` legacy (ver arriba); única app con `DESIGN.md` completo (desactualizado, ver arriba). Sin pin: absorbió los 9 fixes del 2026-07-22 en el próximo `install` sin PR propio — validado (`pnpm verify` limpio) y desplegado, pero seguía siendo el patrón a corregir, no a repetir. |
| `dashboard-cupos` | git, flotando en `master` | Importa componentes directo (`PageHeader`, `Alert`, `Badge`, `AppLayout`), sin bridge propio. |
| `wsp_platform` | git, flotando en `master` | `src/types.ts` hace `export * from '@duralux/ui'` para el contrato — no copiar el contrato a mano. |
| `grancrm-shell` | git, **pineado a un commit SHA** (`#89b16810c79f89802c98186059c913c4bd21739a`) | Es quien carga el theme global una vez para todo el shell en prod. Pinear tiene sentido acá porque un cambio no probado en el paquete rompería a todas las apps montadas a la vez. |
| `orquestador/frontend/sa` ("SA") | git, **pineado a un commit SHA** (`#89b16810c79f89802c98186059c913c4bd21739a`) | Mismo patrón que `grancrm-shell`. Uso pesado de `StatusBadge` (users/accounts/sync-logs) — validado contra los fixes del 2026-07-22 (`tsc -b && vite build` + tests, limpio). |
| `wsp_demo` | git, **pineado al mismo commit SHA** (`#89b16810c79f89802c98186059c913c4bd21739a`) | Migrado 2026-07-23/27 desde `file:./vendor/duralux-ui` (misma deuda que `wsp_pompeyo` abajo, ya resuelta acá) — se borró `vendor/duralux-ui/`, `duralux-compat.tsx` y `duralux-ui.d.ts`, todos los paneles pasan a importar directo de `@duralux/ui`. De paso se sacó `@duralux/ui` de `shared` en `vite.config.ts` (estaba mal puesto) y se agregó el import de `styles/grancrm-ui.css` en el `App.tsx` expuesto (mismo motivo que `call_reviews`, ver arriba). |
| `wsp_pompeyo` | **`file:./vendor/duralux-ui`, copia vendorizada desatada del paquete real** | Deuda conocida — ver abajo. Ya no es la única app con este problema en la tabla histórica; `wsp_demo` tenía la misma deuda y se corrigió (ver fila de arriba) — sirve de referencia de la migración para hacer lo mismo acá. |

### Deuda conocida: `wsp_pompeyo`

`wsp_pompeyo/frontend` no consume el paquete de git como el resto: tiene una copia local en `vendor/duralux-ui`, un shim de tipos propio (`duralux-ui.d.ts`: `declare module '@duralux/ui'`), y una capa de compatibilidad (`src/duralux-compat.tsx`) que reimplementa `Checkbox`, `LoadingState`, `EmptyState` porque la versión vendorizada (comentario en el archivo: *"lib version 0.1.0 antigua"*) no los trae. El propio comentario del archivo apunta la salida: *"Si pancho rebuildea la lib y los expone, podemos borrar este archivo."* — es decir, la corrección es migrar `wsp_pompeyo` a la dependencia de git como las demás apps y borrar `vendor/` + `duralux-compat.tsx`, no seguir extendiendo el compat layer.

## Al construir una app satélite nueva

Seguir `duralux-ui/docs/GUIA_APP_SATELITE_UI.md` — usa `call_reviews` como implementación de referencia. En resumen: dependencia de git (nunca `file:`), theme cargado una sola vez según el contexto (shell vs DevShell standalone, tabla arriba), componentes importados directo de `@duralux/ui`, CSS de dominio en un archivo propio namespaced que solo agrega lo que el theme no cubre, y respetar las tres reglas de fidelidad de la sección anterior — el gate `audit-contract.mjs` del paquete las hace cumplir en el build, pero no reemplaza revisarlas al escribir el componente.
