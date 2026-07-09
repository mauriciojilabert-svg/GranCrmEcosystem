import { Routes, Route } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import type { GranCrmRemoteProps } from './types';
import { configureApiBase } from './api';
import { GranCrmProvider, normalizeRole } from './context';
import { DashboardPage } from './pages/DashboardPage';
import { TicketListPage } from './pages/TicketListPage';
import { TicketDetailPage } from './pages/TicketDetailPage';
import { TicketFormPage } from './pages/TicketFormPage';
import { UsuariosListPage } from './pages/UsuariosListPage';
import { UsuarioFormPage } from './pages/UsuarioFormPage';
import { CuentasListPage } from './pages/CuentasListPage';
import { CuentaFormPage } from './pages/CuentaFormPage';
import { NotificacionesListPage } from './pages/NotificacionesListPage';
import { NotificacionFormPage } from './pages/NotificacionFormPage';
import { SLAListPage } from './pages/SLAListPage';
import { SLAFormPage } from './pages/SLAFormPage';
import { EstadisticasPage } from './pages/EstadisticasPage';
import { RoleGuard } from './components/RoleGuard';

export default function App({ contractVersion, basename, apiBase, session, bus }: GranCrmRemoteProps) {
  if (contractVersion !== '1') {
    console.error('[incitrack] versión de contrato incompatible:', contractVersion, '— esperada: 1');
    return (
      <div style={{ padding: 24, color: 'red' }}>
        InciTrack: contrato incompatible (v{contractVersion}, esperado v1).
        Actualice el shell o el remote.
      </div>
    );
  }

  const apiBaseRef = useRef<string | null>(null);
  if (apiBaseRef.current !== apiBase) {
    configureApiBase(apiBase);
    apiBaseRef.current = apiBase;
  }

  useEffect(() => {
    const handler = () => bus.emit('sessionExpired');
    window.addEventListener('grancrm:sessionExpired', handler);
    return () => window.removeEventListener('grancrm:sessionExpired', handler);
  }, [bus]);

  // Normaliza el rol para que los RoleGuard internos funcionen
  const normSession = session
    ? { ...session, rol: normalizeRole(session.rol) as typeof session.rol }
    : session;

  // Enviar el nav al Orquestador dinámicamente para saltarse el nav de la BD
  useEffect(() => {
    if (!session || !basename) return;
    const r = normalizeRole(session.rol);
    const isAdmin = r === 'sa' || r === 'admin';
    const base = basename.replace(/\/$/, '');
    
    const navItems = [
      { label: 'Dashboard', icon: 'feather-airplay', href: `${base}/` },
      { label: 'Tickets', icon: 'feather-inbox', href: `${base}/tickets/` },
      { label: 'Nuevo ticket', icon: 'feather-plus-circle', href: `${base}/tickets/nuevo/` },
    ];
    
    if (isAdmin) {
      navItems.push(
        { label: 'Usuarios', icon: 'feather-users', href: `${base}/admin/usuarios/` },
        { label: 'Cuentas', icon: 'feather-home', href: `${base}/admin/cuentas/` }
      );
    }
    
    // Notificaciones no tiene restricción en dios.json original
    navItems.push({ label: 'Notificaciones', icon: 'feather-bell', href: `${base}/admin/notificaciones/` });
    
    if (isAdmin) {
      navItems.push(
        { label: 'Config. SLA', icon: 'feather-sliders', href: `${base}/sla/` },
        { label: 'Estadísticas', icon: 'feather-pie-chart', href: `${base}/estadisticas/` }
      );
    }

    window.parent.postMessage({ type: 'grancrm:nav', items: navItems }, '*');
  }, [session, basename]);

  return (
    <GranCrmProvider value={{ session: normSession, apiBase, basename }}>
      <style>{`
        select.form-select {
          height: 28px !important;
          min-height: 28px !important;
          padding-top: 2px !important;
          padding-bottom: 2px !important;
          font-size: 12px !important;
        }
      `}</style>
      <div className="container-fluid px-4 py-3">
        <Routes>
          <Route index element={<DashboardPage />} />
          <Route path="tickets" element={<TicketListPage />} />
          <Route path="tickets/nuevo" element={<TicketFormPage mode="nuevo" />} />
          <Route path="tickets/:id" element={<TicketDetailPage />} />
          <Route path="tickets/:id/editar" element={<TicketFormPage mode="editar" />} />

          {/* Admin routes — gated to sa and admin roles */}
          <Route
            path="admin/usuarios"
            element={<RoleGuard roles={['sa', 'admin']}><UsuariosListPage /></RoleGuard>}
          />
          <Route
            path="admin/usuarios/nuevo"
            element={<RoleGuard roles={['sa', 'admin']}><UsuarioFormPage mode="nuevo" /></RoleGuard>}
          />
          <Route
            path="admin/usuarios/:id"
            element={<RoleGuard roles={['sa', 'admin']}><UsuarioFormPage mode="editar" /></RoleGuard>}
          />
          <Route
            path="admin/cuentas"
            element={<RoleGuard roles={['sa', 'admin']}><CuentasListPage /></RoleGuard>}
          />
          <Route
            path="admin/cuentas/nueva"
            element={<RoleGuard roles={['sa', 'admin']}><CuentaFormPage mode="nuevo" /></RoleGuard>}
          />
          <Route
            path="admin/cuentas/:id"
            element={<RoleGuard roles={['sa', 'admin']}><CuentaFormPage mode="editar" /></RoleGuard>}
          />
          <Route
            path="admin/notificaciones"
            element={<RoleGuard roles={['sa', 'admin']}><NotificacionesListPage /></RoleGuard>}
          />
          <Route
            path="admin/notificaciones/nueva"
            element={<RoleGuard roles={['sa', 'admin']}><NotificacionFormPage mode="nuevo" /></RoleGuard>}
          />
          <Route
            path="admin/notificaciones/:id"
            element={<RoleGuard roles={['sa', 'admin']}><NotificacionFormPage mode="editar" /></RoleGuard>}
          />

          {/* SLA routes — gated to sa and admin */}
          <Route
            path="sla"
            element={<RoleGuard roles={['sa', 'admin']}><SLAListPage /></RoleGuard>}
          />
          <Route
            path="sla/nuevo"
            element={<RoleGuard roles={['sa', 'admin']}><SLAFormPage mode="nuevo" /></RoleGuard>}
          />
          <Route
            path="sla/:id"
            element={<RoleGuard roles={['sa', 'admin']}><SLAFormPage mode="editar" /></RoleGuard>}
          />

          <Route
            path="estadisticas"
            element={<RoleGuard roles={['sa', 'admin']}><EstadisticasPage /></RoleGuard>}
          />


          <Route path="*" element={
            <div style={{ padding: 24, color: '#b91c1c', background: '#fee2e2', borderRadius: 8, margin: 24 }}>
              <strong>Error 404 (React Router):</strong> No se encontró la ruta para "{window.location.pathname}". <br />
              (Basename provisto por GranCRM: {basename})
            </div>
          } />
        </Routes>
      </div>
    </GranCrmProvider>
  );
}
