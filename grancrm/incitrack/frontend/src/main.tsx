import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useNavigate, useLocation } from 'react-router-dom';
import App from './App';
import type { GranCrmSession, EventBus, GranCrmRemoteProps } from './types';
import { ShellHeader, ShellNav, ThemeProvider, useTheme } from '@duralux/ui';

import '@duralux/ui/bootstrap.min.css';
import '@duralux/ui/theme.min.css';
import '@duralux/ui/styles/grancrm-ui.css';

function DevShellChrome({ props, email, rol }: { props: GranCrmRemoteProps; email: string; rol: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { dark, toggleDark, mini, toggleMini } = useTheme();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  function logout() {
    fetch('/incitrack/logout/', { method: 'POST', credentials: 'include' })
      .finally(() => { window.location.href = '/incitrack/login/'; });
  }

  const strip = (p: string) => (p.endsWith('/') && p !== '/' ? p.slice(0, -1) : p);
  function matchLength(href: string) {
    if (href === '/') return location.pathname === '/' ? 0 : -1;
    const h = strip(href);
    const p = strip(location.pathname);
    if (p === h || p.startsWith(h + '/')) return h.length;
    return -1;
  }

  const formatRole = (r: string) => {
    switch (r) {
      case 'sa': return 'Super Administrador';
      case 'admin': return 'Admin TI';
      case 'jefe': return 'Jefe de Cuenta';
      case 'supervisor': return 'Supervisor';
      default: return 'Usuario';
    }
  };

  // same logic for active state as in Shell
  const mainItems = [
    { label: 'Dashboard', icon: 'airplay', href: '/', active: matchLength('/') >= 0 },
    { label: 'Tickets', icon: 'inbox', href: '/tickets', active: matchLength('/tickets') >= 0 && matchLength('/tickets/nuevo') < 0 },
    { label: 'Nuevo Ticket', icon: 'plus-circle', href: '/tickets/nuevo', active: matchLength('/tickets/nuevo') >= 0 },
  ];
  
  const adminItems = [
    { label: 'Usuarios', icon: 'users', href: '/admin/usuarios', active: matchLength('/admin/usuarios') >= 0 },
    { label: 'Cuentas', icon: 'briefcase', href: '/admin/cuentas', active: matchLength('/admin/cuentas') >= 0 },
    { label: 'Notificaciones', icon: 'bell', href: '/admin/notificaciones', active: matchLength('/admin/notificaciones') >= 0 },
    { label: 'Config SLA', icon: 'sliders', href: '/sla', active: matchLength('/sla') >= 0 },
    { label: 'Estadísticas', icon: 'pie-chart', href: '/estadisticas', active: matchLength('/estadisticas') >= 0 },
  ];

  const navSections = [
    { caption: 'Navegación', items: mainItems },
  ];

  if (['sa', 'admin'].includes(rol)) {
    navSections.push({ caption: 'Administración', items: adminItems });
  }

  return (
    <>
      <ShellNav
        brand={{
          href: '/',
          logoLg: dark ? '/static/images/LOGO%20H%20WHITE.png' : '/static/images/LOGO%20H.png',
          logoSm: dark ? '/static/images/huella%20white.png' : '/static/images/huella.png',
          alt: 'InciTrack',
        }}
        sections={navSections}
        onNavigate={(href, e) => {
          e.preventDefault();
          navigate(href);
          setMobileNavOpen(false);
        }}
        mobileOpen={mobileNavOpen}
      />

      {mobileNavOpen && (
        <div className="nxl-menu-overlay" onClick={() => setMobileNavOpen(false)} />
      )}

      <ShellHeader
        nombre={props.session.nombre || email}
        email={email}
        rol={formatRole(rol)}
        viewAsSa={false}
        cuentaNombre={null}
        cuentas={[]}
        apps={[]}
        dark={dark}
        mini={mini}
        onToggleDark={toggleDark}
        onToggleMini={toggleMini}
        onToggleMobileNav={() => setMobileNavOpen(v => !v)}
        onOpenApp={() => {}}
        onSelectCuenta={() => {}}
        onVolverSa={() => {}}
        appHref={() => ''}
        csrfToken=""
        notifications={[]}
        onMarkAllRead={() => {}}
        onNotificationClick={() => {}}
      />

      <main className="nxl-container">
        <div className="nxl-content p-0">
          <App {...props} />
        </div>
      </main>
    </>
  );
}

function DevShell({ props, email, rol }: { props: GranCrmRemoteProps; email: string; rol: string }) {
  return (
    <ThemeProvider enableResponsiveMini={false}>
      <DevShellChrome props={props} email={email} rol={rol} />
    </ThemeProvider>
  );
}

const devBus: EventBus = {
  emit(event, payload) {
    console.log('[devBus] emit:', event, payload);
    if (event === 'logout' || event === 'sessionExpired') {
      window.location.href = '/incitrack/login/';
    }
  },
  on(_event, _cb) { return () => {}; },
};

async function bootstrap() {
  const res = await fetch('/incitrack/api/v1/me/', { credentials: 'include' });

  if (res.status === 401 || res.status === 403) {
    window.location.href = '/incitrack/login/';
    return;
  }
  if (!res.ok) {
    const root = document.getElementById('root');
    if (root) root.textContent = `Error al cargar sesión: HTTP ${res.status}`;
    return;
  }

  const me = await res.json();
  const props: GranCrmRemoteProps = {
    contractVersion: '1',
    basename: '',
    apiBase: '/incitrack/',
    session: {
      user_id:   me.user_id  ?? 0,
      email:     me.email    ?? '',
      nombre:    me.nombre   ?? me.email ?? '',
      rol:      (me.rol as GranCrmSession['rol']) || 'usuario',
      tenant_id: me.tenant_id ?? 'dev',
      apps: [],
    },
    bus: devBus,
  };

  const root = document.getElementById('root');
  if (root) {
    createRoot(root).render(
      <StrictMode>
        <BrowserRouter>
          <DevShell props={props} email={me.email ?? ''} rol={props.session.rol} />
        </BrowserRouter>
      </StrictMode>
    );
  }
}

bootstrap().catch(err => {
  console.error('[dev shell] bootstrap failed:', err);
  const root = document.getElementById('root');
  if (root) root.textContent = 'Error al iniciar: ' + String(err);
});
