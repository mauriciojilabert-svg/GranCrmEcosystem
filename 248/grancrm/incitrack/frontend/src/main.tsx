/**
 * DevShell — Duralux-faithful implementation
 *
 * Colours taken directly from Duralux SCSS variables:
 *   navigation-background : #0f172a
 *   navigation-color       : #b1b4c0
 *   navigation-hover-color : #1c2438
 *   navigation-border-color: #1b2436
 *   brand-dark             : #283c50
 *   brand-light            : #eaebef
 *   darken                 : #001327
 *   primary                : #3454d1
 *   body-bg                : #f0f2f8
 *   border-color           : #e5e7eb
 *   header-background      : #0f172a (dark mode header)
 *   header-height          : 80px
 *   navigation-width       : 280px
 */

import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, NavLink } from 'react-router-dom';
import App from './App';
import { normalizeRole } from './context';
import type { GranCrmSession, EventBus, GranCrmRemoteProps } from './types';

/* ─── Navigation definition ─────────────────────────────────────── */
interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
  roles?: Array<'sa' | 'admin' | 'ejecutivo'>;
}
interface NavGroup {
  caption?: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    caption: 'Navegación',
    items: [
      { to: '/',              label: 'Dashboard',    icon: 'feather-airplay',      end: true },
      { to: '/tickets',      label: 'Tickets',       icon: 'feather-inbox' },
      { to: '/tickets/nuevo',label: 'Nuevo Ticket',  icon: 'feather-plus-circle' },
    ],
  },
  {
    caption: 'Administración',
    items: [
      { to: '/admin/usuarios',       label: 'Usuarios',       icon: 'feather-users',        roles: ['sa', 'admin'] },
      { to: '/admin/cuentas',        label: 'Cuentas',        icon: 'feather-briefcase',    roles: ['sa', 'admin'] },
      { to: '/admin/notificaciones', label: 'Notificaciones', icon: 'feather-bell',         roles: ['sa', 'admin'] },
      { to: '/sla',                  label: 'Config SLA',     icon: 'feather-sliders',      roles: ['sa', 'admin'] },
      { to: '/estadisticas',         label: 'Estadísticas',   icon: 'feather-pie-chart',    roles: ['sa', 'admin'] },
    ],
  },
];

/* ─── Duralux-faithful CSS ───────────────────────────────────────── */
const DURALUX_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

/* ── Reset & Base ── */
*, *::before, *::after { box-sizing: border-box; }

body, .nxl-shell { font-family: 'Inter', sans-serif; }

/* ── Global Form Styles (matching Duralux Tickets) ── */
.form-control, .form-select {
  font-size: 13px !important;
  border-radius: 8px !important;
  padding: 8px 12px !important;
  border: 1px solid #cbd5e1;
  color: #334155;
  box-shadow: none !important;
  transition: all 0.2s;
}
.form-control:focus, .form-select:focus {
  border-color: #3454d1 !important;
  box-shadow: 0 0 0 4px rgba(52, 84, 209, 0.1) !important;
}
.form-label {
  font-size: 12.5px !important;
  font-weight: 600 !important;
  color: #475569 !important;
  margin-bottom: 6px !important;
}

/* ── Shell layout ── */
.nxl-shell {
  display: flex;
  min-height: 100vh;
  background: #f0f2f8;
  position: relative;
}

/* ══════════════════════════════════════════
   NAVIGATION  (faithful Duralux nxl-navigation)
   ══════════════════════════════════════════ */
.nxl-navigation {
  top: 0; bottom: 0;
  z-index: 1026;
  position: fixed;
  background: #ffffff;
  width: 280px;
  border-right: 1px solid #e5e7eb;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
}

/* Logo / brand header */
.nxl-navigation .m-header {
  overflow: hidden;
  position: relative;
  display: flex;
  padding: 0 30px;
  align-items: center;
  height: 80px;
  background: #0f172a;
  border-right: 1px solid #1b2436;
  border-bottom: 1px solid #1b2436;
  flex-shrink: 0;
}
.nxl-navigation .m-header .brand-name {
  font-size: 20px;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: -0.5px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.nxl-navigation .m-header .brand-icon {
  width: 36px; height: 36px;
  background: #3454d1;
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; color: #fff;
  flex-shrink: 0;
}
.nxl-navigation .m-header .dev-badge {
  font-size: 9px; font-weight: 700;
  background: #ffa21d; color: #001327;
  padding: 2px 7px; border-radius: 4px;
  text-transform: uppercase; letter-spacing: 0.5px;
  margin-left: 4px;
}
.nxl-nav-close {
  margin-left: auto;
  background: transparent; border: none;
  color: rgba(255,255,255,.5); font-size: 18px;
  cursor: pointer; padding: 4px 6px;
  border-radius: 4px; line-height: 1;
  transition: color .15s, background .15s;
}
.nxl-nav-close:hover { color: #fff; background: rgba(255,255,255,.08); }

/* Scrollable nav content */
.nxl-navigation .navbar-content {
  flex: 1;
  overflow-y: auto;
  padding: 10px 0;
  border-right: 1px solid #e5e7eb;
}
.nxl-navigation .navbar-content::-webkit-scrollbar { width: 4px; }
.nxl-navigation .navbar-content::-webkit-scrollbar-thumb {
  background: #e5e7eb; border-radius: 2px;
}

/* Section captions */
.nxl-navigation .nxl-caption {
  display: block;
  color: #7587a7;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.07em;
  padding: 15px 20px 10px;
  text-transform: uppercase;
}

/* Nav items */
.nxl-navigation ul { list-style: none; padding: 0; margin: 0; }

.nxl-navigation .nxl-item { margin: 3px 15px; border-radius: 5px; }

.nxl-navigation .nxl-link {
  display: flex;
  align-items: center;
  line-height: 1.2;
  padding: 10px 15px;
  font-size: 13px;
  color: #283c50;
  font-weight: 600;
  transition: all 0.3s ease;
  border-radius: 5px;
  text-decoration: none;
}
.nxl-navigation .nxl-link:hover,
.nxl-navigation .nxl-item:hover > .nxl-link {
  color: #001327;
  background-color: #eaebef;
  text-decoration: none;
}
.nxl-navigation .nxl-link.active,
.nxl-navigation .nxl-item.active > .nxl-link {
  color: #001327;
  background-color: #eaebef;
}
.nxl-navigation .nxl-link.active .nxl-micon i {
  color: #3454d1;
}

.nxl-micon {
  margin-right: 12px;
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}
.nxl-micon i { font-size: 18px; color: #7587a7; transition: color 0.3s ease; }
.nxl-link:hover .nxl-micon i,
.nxl-item:hover > .nxl-link .nxl-micon i { color: #001327; }

.nxl-mtext { flex: 1; }

/* SLA badge */
.nxl-sa-badge {
  font-size: 9px; font-weight: 700;
  background: rgba(52,84,209,0.12); color: #3454d1;
  padding: 2px 7px; border-radius: 4px;
  text-transform: uppercase; letter-spacing: 0.4px;
  flex-shrink: 0;
}
.nxl-link.active .nxl-sa-badge {
  background: #3454d1; color: #fff;
}

/* Nav footer */
.nxl-nav-footer {
  padding: 15px 20px;
  border-top: 1px solid #e5e7eb;
  background: #ffffff;
  flex-shrink: 0;
}
.nxl-user-row {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 5px; border-radius: 5px;
  cursor: default;
}
.nxl-user-avatar {
  width: 38px; height: 38px; border-radius: 50%;
  background: #3454d1;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700; color: #fff;
  flex-shrink: 0;
}
.nxl-user-info { flex: 1; min-width: 0; }
.nxl-user-name {
  font-size: 13px; font-weight: 600; color: #283c50;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.nxl-user-role {
  font-size: 11px; color: #7587a7; font-weight: 500;
}
.nxl-logout-btn {
  width: 100%; margin-top: 8px;
  background: transparent;
  border: 1px solid #e5e7eb;
  color: #7587a7;
  border-radius: 5px; padding: 8px 0;
  font-size: 12px; font-weight: 600;
  cursor: pointer; transition: all .15s;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  font-family: 'Inter', sans-serif;
}
.nxl-logout-btn:hover {
  background: rgba(234,68,68,.06);
  border-color: rgba(234,68,68,.35);
  color: #ea4d4d;
}

/* Overlay for mobile */
.nxl-menu-overlay {
  position: fixed; top: 0; left: 0;
  width: 100vw; height: 100vh;
  z-index: 1025;
  background: rgba(0,0,0,0.35);
  backdrop-filter: blur(2px);
  animation: nxl-fade-in .15s ease;
}
@keyframes nxl-fade-in { from { opacity: 0; } to { opacity: 1; } }

/* ══════════════════════════════════════════
   HEADER  (faithful Duralux nxl-header)
   ══════════════════════════════════════════ */
.nxl-header {
  position: fixed;
  top: 0; right: 0;
  left: 280px;
  z-index: 1025;
  min-height: 80px;
  background: #ffffff;
  border-bottom: 1px solid #e5e7eb;
  display: flex; align-items: center;
  padding: 0 30px;
  gap: 16px;
  transition: left 0.3s ease;
}
.nxl-header .header-left {
  display: flex; align-items: center; gap: 16px; flex: 1;
}
.nxl-header .nxl-navigation-toggle a {
  color: #283c50; font-size: 24px; text-decoration: none;
  display: flex; align-items: center; line-height: 1;
  transition: color 0.2s;
}
.nxl-header .nxl-navigation-toggle a:hover { color: #3454d1; }

/* App title in header */
.nxl-header-brand {
  display: flex; align-items: center; gap: 8px;
  font-size: 15px; font-weight: 700; color: #283c50;
}
.nxl-header-brand-icon {
  width: 30px; height: 30px; border-radius: 6px;
  background: #3454d1;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 14px;
}

/* Mobile hamburger topbar */
.nxl-topbar-mobile {
  background: #0f172a;
  border-bottom: 1px solid #1b2436;
  padding: 0 16px;
  height: 64px;
  display: flex; align-items: center; gap: 12px;
  position: sticky; top: 0; z-index: 1020;
}
.nxl-topbar-mobile .nxl-burger {
  background: transparent; border: none;
  color: rgba(255,255,255,.75); font-size: 22px;
  cursor: pointer; padding: 4px 6px;
  border-radius: 4px; line-height: 1;
  transition: color .15s, background .15s;
}
.nxl-topbar-mobile .nxl-burger:hover {
  color: #fff; background: rgba(255,255,255,.08);
}
.nxl-topbar-brand {
  font-size: 16px; font-weight: 800; color: #fff;
  letter-spacing: -0.4px;
}

/* ══════════════════════════════════════════
   MAIN CONTENT AREA
   ══════════════════════════════════════════ */
.nxl-container {
  flex: 1;
  margin-left: 280px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  transition: margin-left 0.3s ease;
  overflow: hidden;
}
.nxl-content {
  flex: 1;
  padding-top: 80px; /* offset for fixed header */
  background: #f0f2f8;
  min-width: 0;
  overflow-x: hidden;
}
.nxl-content.no-header { padding-top: 0; }

/* Responsive */
@media (max-width: 767px) {
  .nxl-navigation { position: fixed !important; }
  .nxl-header { left: 0 !important; }
  .nxl-container { margin-left: 0 !important; }
  .nxl-content { padding-top: 0; }
}
`;

function injectOnce(id: string, css: string) {
  if (typeof document === 'undefined' || document.getElementById(id)) return;
  const el = document.createElement('style');
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}

/* ─── DevShell component ─────────────────────────────────────────── */
function DevShell({
  props, email, rol,
}: { props: GranCrmRemoteProps; email: string; rol: string }) {
  const [navOpen, setNavOpen] = useState(() => window.innerWidth >= 768);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  injectOnce('duralux-devshell-css', DURALUX_CSS);

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setNavOpen(true);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  function logout() {
    fetch('/incitrack/logout/', { method: 'POST', credentials: 'include' })
      .finally(() => { window.location.href = '/incitrack/login/'; });
  }

  function canSee(item: NavItem): boolean {
    if (!item.roles) return true;
    return item.roles.includes(rol as 'sa' | 'admin' | 'ejecutivo');
  }

  const initials = email ? email.slice(0, 2).toUpperCase() : 'IT';
  const roleLabel =
    rol === 'sa' ? 'Super Admin' :
    rol === 'admin' ? 'Administrador' : 'Ejecutivo';

  const navStyle: React.CSSProperties = isMobile ? {
    transform: navOpen ? 'translateX(0)' : 'translateX(-280px)',
    transition: 'transform 0.3s ease',
    height: '100vh',
  } : {};

  return (
    <div className="nxl-shell">
      {/* ── Mobile overlay ── */}
      {isMobile && navOpen && (
        <div className="nxl-menu-overlay" onClick={() => setNavOpen(false)} />
      )}

      {/* ══ NAVIGATION ══ */}
      <nav className="nxl-navigation" style={navStyle}>
        {/* Brand */}
        <div className="m-header">
          <div className="brand-name">
            <div className="brand-icon">
              <i className="feather-activity" />
            </div>
            InciTrack
            <span className="dev-badge">DEV</span>
          </div>
          {isMobile && (
            <button className="nxl-nav-close" onClick={() => setNavOpen(false)}>✕</button>
          )}
        </div>

        {/* Nav items */}
        <div className="navbar-content">
          <ul className="nxl-navbar">
            {NAV.map((group, gi) => (
              <li key={gi} className="nxl-item nxl-caption-group">
                {group.caption && (
                  <span className="nxl-caption">{group.caption}</span>
                )}
                <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>
                  {group.items.filter(canSee).map(item => (
                    <li key={item.to} className="nxl-item">
                      <NavLink
                        to={item.to}
                        end={item.end}
                        onClick={() => isMobile && setNavOpen(false)}
                        className={({ isActive }) =>
                          `nxl-link${isActive ? ' active' : ''}`
                        }
                      >
                        <span className="nxl-micon">
                          <i className={item.icon} />
                        </span>
                        <span className="nxl-mtext">{item.label}</span>
                        {item.label === 'Config SLA' && (
                          <span className="nxl-sa-badge">SA</span>
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="nxl-nav-footer">
          <div className="nxl-user-row">
            <div className="nxl-user-avatar">{initials}</div>
            <div className="nxl-user-info">
              <div className="nxl-user-name">{email}</div>
              <div className="nxl-user-role">{roleLabel}</div>
            </div>
          </div>
          <button className="nxl-logout-btn" onClick={logout}>
            <i className="feather-log-out" style={{ fontSize: 13 }} />
            Cerrar sesión
          </button>
        </div>
      </nav>

      {/* ══ MAIN AREA ══ */}
      <div className="nxl-container">
        {/* Fixed header (desktop) */}
        {!isMobile && (
          <header className="nxl-header">
            <div className="header-left">
              <div className="nxl-navigation-toggle">
                <a
                  href="javascript:void(0)"
                  onClick={() => setNavOpen(v => !v)}
                  title="Toggle navigation"
                >
                  <i className="feather-align-left" />
                </a>
              </div>
              <div className="nxl-header-brand">
                <div className="nxl-header-brand-icon">
                  <i className="feather-activity" />
                </div>
                InciTrack
              </div>
            </div>
          </header>
        )}

        {/* Mobile sticky topbar */}
        {isMobile && (
          <div className="nxl-topbar-mobile">
            <button className="nxl-burger" onClick={() => setNavOpen(true)}>
              <i className="feather-align-left" />
            </button>
            <span className="nxl-topbar-brand">InciTrack</span>
          </div>
        )}

        {/* Content */}
        <div className={`nxl-content${isMobile ? ' no-header' : ''}`}>
          <App {...props} />
        </div>
      </div>
    </div>
  );
}

/* ─── Bootstrap ──────────────────────────────────────────────────── */
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
      rol:      (normalizeRole(me.rol ?? '') as GranCrmSession['rol']) || 'ejecutivo',
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
