# Guía: app satélite con `@duralux/ui`

Receta estándar para **apps nuevas** y migraciones (call_reviews es la de referencia).

## 1. Dependencias

```json
{
  "dependencies": {
    "@duralux/ui": "github:Waryxxful/duralux-ui",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.1"
  }
}
```

- **Siempre** `github:Waryxxful/duralux-ui#<commit-sha>` — **pin obligatorio**, no opcional.
  Sin pin (`github:Waryxxful/duralux-ui` a secas) tu app apunta al HEAD de `master` y absorbe
  cambios sin PR ni review la próxima vez que alguien corra `install`. Bump del pin = commit
  explícito y revisable, igual que cualquier otra dependencia.
- **Nunca** `file:` local ni copiar `types.ts` / CSS del theme a mano.
- No instales Bootstrap ni jQuery: el paquete publica el CSS necesario y sus componentes React no requieren Bootstrap JS ni el runtime vendor/jQuery.
- Prohibido: otra librería de componentes u otro set de iconos.

Tras un bump del paquete en consumidores:

```bash
rm -rf node_modules && npm install   # o pnpm si el entorno lo permite
npm run build
```

## 2. Estilos

| Contexto | Qué cargar |
|----------|------------|
| **Montado en el shell (prod MF)** | **Nada** en la satélite. El shell ya carga `@duralux/ui/bootstrap.min.css`, `@duralux/ui/theme.min.css` y `@duralux/ui/styles/grancrm-ui.css`. |
| **DevShell standalone** | Importar los tres estilos del paquete en el orden indicado abajo. |
| **CSS propio de dominio** | Un solo archivo (ej. `app.css`) usando variables Duralux/`--gcu-*`. Sin hex literales nuevos. |

```tsx
import '@duralux/ui/bootstrap.min.css';
import '@duralux/ui/theme.min.css';
import '@duralux/ui/styles/grancrm-ui.css';
```

Para depurar están disponibles las variantes expandidas `@duralux/ui/bootstrap.css` y `@duralux/ui/theme.css`. El glue incluye los iconos Feather; no cargues `vendors.min.css`. El theme compilado es la adaptación canónica de Duralux para GranCRM, no una salida byte a byte del CSS original de la plantilla.

## 3. Contrato MF

```tsx
import type { GranCrmRemoteProps } from '@duralux/ui';

export default function App({ contractVersion, basename, apiBase, session, bus }: GranCrmRemoteProps) {
  if (contractVersion !== '1') console.warn('Contrato incompatible', contractVersion);
  // 401 → bus.emit('sessionExpired')
}
```

- Sin `BrowserRouter` propio (el shell ya tiene el router).
- Validar `contractVersion`, emitir `sessionExpired` / `logout` por el bus.

## 4. Componentes

```tsx
import {
  PageHeader, Card, Button, Badge, Table, ResponsiveTable,
  EmptyState, LoadingState, FormField, Input, Modal, apiFetch,
} from '@duralux/ui';
```

1. ¿Existe en el paquete? → usalo.
2. ¿Es genérico y lo necesitarán otras apps? → PR a `duralux-ui` + página en `demo/`.
3. ¿Es de dominio? → solo en la app.

### PageHeader canónico GranCRM/Duralux

```tsx
<PageHeader
  title="Cuentas"
  subtitle="Opcional; va debajo sin romper breadcrumb"
  breadcrumbs={[{ label: 'SA' }, { label: 'Cuentas' }]}
  actions={<Button startIcon="plus">Nueva</Button>}
/>
```

### Status chips: `Badge` / `StatusBadge` / `StatusButton`

No inventes tu propio chip de estado. `StatusBadge`/`StatusButton` ya son wrappers
finos sobre `Badge` (mapean `status: StatusVariant` → variante Bootstrap real) — no
tienen su propio CSS paralelo. Usá `StatusBadge` cuando tu dominio ya piensa en
`success/danger/warning/info/secondary`; usá `Badge` directo para cualquier otro caso
(incluida la variante `light`, un chip de alto contraste, no el `bg-light` lavado de
Bootstrap).

```tsx
<StatusBadge status="danger" label="Vencido" soft />
<StatusButton status="info" label="Reintentar" onClick={handleRetry} />
```

### AuthLayout (login/register/reset)

Porta la variante real `auth-cover-wrapper` de Duralux — tarjeta a la derecha,
ilustración opcional a la izquierda. Es la única variante portada (`creative`/`minimal`
quedan para cuando haya demanda real). El contenido del formulario va como `children`.

```tsx
<AuthLayout image="/tu-ilustracion.svg">
  <LoginForm />
</AuthLayout>
```

## 5. Theming

El shell envuelve con `ThemeProvider` (dark + mini sidebar). Las satélites **no** implementan dark mode propio: heredan `html.app-skin-dark`.

Si una app corre standalone:

```tsx
import { ThemeProvider, THEME_HEAD_SNIPPET } from '@duralux/ui';
// en index.html <head>: <script>${THEME_HEAD_SNIPPET}</script>
```

## 6. Module Federation

- Expone `./App`
- `shared`: solo `react` / `react-dom` / `react-router-dom` **singleton** (mismas majors que el shell)
- **NO** pongas `@duralux/ui` en `shared` (desacopla deploys)

## 7. Deploy (DEV / QA / PROD)

### Paquete `@duralux/ui`

```bash
cd /home/admincrm/duralux-ui   # o clone fresco
npm install && npm run build
git tag v0.x.y && git push origin master --tags
```

### Shell

```bash
cd /home/admincrm/grancrm-shell
rm -rf node_modules && npm install
npm run build   # escribe staticfiles/shell (o VITE_SHELL_OUT_DIR)
# nginx ya sirve staticfiles/shell — sin restart de contenedor
```

### Satélite (ej. call_reviews)

```bash
cd frontend && rm -rf node_modules && npm install && npm run build
docker compose restart web   # o el proceso de deploy de la app
```

### Checklist PR de UI

- [ ] Importa de `@duralux/ui`, no copias
- [ ] Dependencia pineada a un commit SHA (no `github:Waryxxful/duralux-ui` a secas)
- [ ] Cero hex literales de diseño (si necesitás un color dark-safe fuera de una clase
      Bootstrap real, usá `var(--gcu-*, <fallback>)`, no un hex fijo)
- [ ] Cero referencias a family de fuente que no sea Inter — el theme solo carga Inter;
      cualquier otra familia (`Poppins`, `Roboto`, etc.) no está disponible y cae a la
      fuente por defecto del navegador
- [ ] Dark mode OK (montado en shell)
- [ ] Probado montado en shell, no solo standalone
- [ ] Versión de `@duralux/ui` ≤ shell mayor

## 8. Scaffold mínimo de remote

Copiar esqueleto de `call_reviews/frontend` (vite + MF + `src/App.tsx` + `src/types.ts` re-export). No hace falta generador hasta 3+ apps nuevas/año.

## 9. `DESIGN.md`

`/home/admincrm/docs-repo/DESIGN.md` es la referencia de estilo Duralux (tokens, frame, page-header, mapeo de componentes) — genérica, sin nada específico de ninguna app. Copiala tal cual a la raíz de tu repo como `DESIGN.md` al arrancar la app; no la reescribas a mano ni la generes de cero.
