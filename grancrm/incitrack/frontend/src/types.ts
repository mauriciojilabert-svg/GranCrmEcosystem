export interface GranCrmSession {
  user_id: number;
  email: string;
  nombre: string;
  rol: 'sa' | 'admin' | 'ejecutivo';
  tenant_id: string;
  apps: number[];
  // route_prefix (sin slash inicial) de la app de inicio elegida y la ultima
  // visitada. El shell los usa para redirigir tras el login.
  app_default_prefix?: string | null;
  ultima_app_prefix?: string | null;
  // true cuando el usuario aun no eligio app de inicio y tiene >1 app.
  needs_default_selection?: boolean;
  // SA client switcher
  view_as_sa?: boolean;
  cuenta_nombre?: string | null;
  cuentas?: { slug: string; nombre: string }[];
}

// Ítem de menú lateral declarado por cada app (en su dios.json) y renderizado
// por el shell. `inner` es la ruta del gateway de la app (ej "/callreviews/calls/").
// `roles` es opcional: si está, el ítem solo se muestra a esos roles GranCRM.
export interface AppNavItem {
  label: string;
  icon: string;
  inner: string;
  roles?: string[];
}

export interface AppManifestEntry {
  id: number;
  nombre: string;
  slug: string | null;
  icono: string;
  categoria: string;
  estado: 'activo' | 'montaje' | 'caido';
  modo: 'external_link' | 'iframe' | 'spa_remote';
  url_publica: string;
  route_prefix: string;
  // menú lateral propio de la app (vacío si no declara ninguno)
  nav?: AppNavItem[];
  // solo si modo === 'spa_remote'
  remote_entry_url?: string;
  remote_scope?: string;
  contract_version?: string;
}

export interface AppManifest {
  apps: AppManifestEntry[];
}

export interface EventBus {
  emit(event: 'logout' | 'sessionExpired' | 'navigate', payload?: unknown): void;
  on(event: string, cb: (payload: unknown) => void): () => void;
}

export interface GranCrmRemoteProps {
  contractVersion: '1';
  basename: string;
  apiBase: string;
  session: GranCrmSession;
  bus: EventBus;
}
