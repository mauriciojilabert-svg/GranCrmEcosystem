import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { getDashboard } from '../lib/api';
import type { DashboardStatsOut, TicketResumenItem } from '../apiTypes';
import { Loading } from '../components/Loading';
import { ErrorAlert } from '../components/ErrorAlert';
import { useSession } from '../context';
import { PageHeader } from '../components/duralux/PageHeader';
import { StatsCard } from '../components/duralux/StatsCard';
import { AvisosTIPanel } from '../components/duralux/AvisosTIPanel';

const PERIODOS = [
  { key: '', label: 'Total' },
  { key: 'hoy', label: 'Hoy' },
  { key: 'ayer', label: 'Ayer' },
  { key: 'esta_semana', label: 'Esta Semana' },
  { key: 'este_mes', label: 'Este Mes' },
  { key: 'mes_pasado', label: 'Mes Pasado' },
  { key: 'este_anio', label: 'Este Año' },
];

function fmtDatetime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function LiveClock() {
  const [time, setTime] = useState(() => {
    const d = new Date();
    let h = d.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return String(h).padStart(2, '0') + ':' + m + ':' + s + ' ' + ampm;
  });

  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      let h = d.getHours();
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      const m = String(d.getMinutes()).padStart(2, '0');
      const s = String(d.getSeconds()).padStart(2, '0');
      setTime(String(h).padStart(2, '0') + ':' + m + ':' + s + ' ' + ampm);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return <>{time}</>;
}

function EstadoBadgeDx({ estado }: { estado: string }) {
  const map: Record<string, string> = {
    abierto: 'estado-abierto',
    en_proceso: 'estado-en_proceso',
    resuelto: 'estado-resuelto',
    cerrado: 'estado-cerrado',
  };
  return (
    <span className={`estado-badge ${map[estado] ?? ''}`}>
      {estado.replace('_', ' ').toUpperCase()}
    </span>
  );
}

function TicketRow({ t }: { t: TicketResumenItem }) {
  const initials = (t.asignado_a__nombre ?? '').slice(0, 2).toUpperCase();
  return (
    <tr>
      <td className="ps-3">
        <Link to={`tickets/${t.id}`} className="ticket-id">#{t.id}</Link>
      </td>
      <td className="fs-12 text-wrap text-break">{t.creado_por__nombre ?? '—'}</td>
      <td className="text-wrap text-break">
        <Link to={`tickets/${t.id}`} className="ticket-titulo">{t.titulo}</Link>
      </td>
      <td className="text-wrap text-break">
        <span className="cuenta-tag">{t.cuenta__nombre ?? '—'}</span>
      </td>
      <td>
        {t.categoria__nombre ? (
          <div className="d-flex flex-column gap-1">
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--bs-primary)', background: 'var(--bs-primary-bg-subtle)', border: '1px solid var(--bs-primary-border-subtle)', borderRadius: 6, padding: '2px 8px' }}>
              {t.categoria__nombre}
            </span>
            {t.subcategoria__nombre && <small className="text-muted ps-1">› {t.subcategoria__nombre}</small>}
          </div>
        ) : t.tipo_incidencia ? (
          <span className="text-muted fst-italic fs-12">{t.tipo_incidencia}</span>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
      <td>
        {t.asignado_a__nombre ? (
          <div className="d-flex align-items-center gap-2">
            <div className="avatar-ini">{initials}</div>
            <span className="fs-12 fw-semibold">{t.asignado_a__nombre}</span>
            {t.fue_reasignado && (
              <span className="badge bg-warning-subtle text-warning border border-warning-subtle ms-1" style={{ fontSize: 9 }}>REASIGNADO</span>
            )}
          </div>
        ) : (
          <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle">Sin asignar</span>
        )}
      </td>
      <td><EstadoBadgeDx estado={t.estado} /></td>
      <td className="text-muted fs-12 text-nowrap">{fmtDatetime(t.fecha_creacion)}</td>
    </tr>
  );
}

export function DashboardPage() {
  const session = useSession();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const periodo = searchParams.get('periodo') ?? '';
  const verTodos = searchParams.get('ver_todos') === '1';

  const [stats, setStats] = useState<DashboardStatsOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getDashboard({ periodo, ver_todos: verTodos })
      .then(data => { setStats(data); setLoading(false); })
      .catch(e => { setError(String(e.message ?? e)); setLoading(false); });
  }, [periodo, verTodos]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const id = setInterval(() => load(), 60000);
    return () => clearInterval(id);
  }, [load]);

  function setPeriodo(p: string) {
    const next = new URLSearchParams(searchParams);
    if (p) next.set('periodo', p); else next.delete('periodo');
    setSearchParams(next, { replace: true });
  }

  function toggleVerTodos() {
    const next = new URLSearchParams(searchParams);
    if (verTodos) next.delete('ver_todos'); else next.set('ver_todos', '1');
    setSearchParams(next, { replace: true });
  }

  const isAdmin = session?.rol === 'admin' || session?.rol === 'sa';
  const today = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <>
      <style>{`
        .periodo-btn {
          padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 600;
          color: var(--bs-secondary-color); background: var(--bs-tertiary-bg);
          border: 1px solid var(--bs-border-color); text-decoration: none; transition: all .15s;
          cursor: pointer;
        }
        .periodo-btn.active { background: var(--bs-primary); color: #fff; border-color: var(--bs-primary); }
        .periodo-btn:hover:not(.active) { background: var(--bs-secondary-bg); color: var(--bs-body-color); }
        .estado-badge { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; }
        .estado-abierto    { background: #fee2e2; color: #dc2626; }
        .estado-en_proceso { background: #fef3c7; color: #d97706; }
        .estado-resuelto   { background: #dcfce7; color: #16a34a; }
        .estado-cerrado    { background: #f1f5f9; color: #64748b; }
        .cuenta-tag { font-size: 11.5px; font-weight: 600; padding: 2px 8px; background: var(--bs-primary-bg-subtle); color: var(--bs-primary); border-radius: 6px; border: 1px solid var(--bs-primary-border-subtle); }
        .ticket-id { font-weight: 700; color: var(--bs-primary); text-decoration: none; }
        .ticket-titulo { color: var(--bs-body-color); text-decoration: none; font-weight: 500; }
        .ticket-titulo:hover { color: var(--bs-primary); }
        .avatar-ini { width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg,#6366f1,#8b5cf6); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; color: #fff; flex-shrink: 0; }
      `}</style>

      {/* Page Header */}
      <PageHeader
        title={!verTodos ? `Mis Tickets (${session?.nombre})` : "Vista General Global"}
        breadcrumbs={[
          { label: 'Inicio', href: '/' },
          { label: !verTodos ? 'Mis Tickets' : 'Vista General Global' }
        ]}
      >
        <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-2">
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#22c55e', marginRight: 4 }} />
          En vivo
        </span>
      </PageHeader>

      <div className="main-content">
        {loading && <Loading />}
        {error && <ErrorAlert error={error} onRetry={load} />}

        {stats && (() => {
          const totalAbsoluto = stats.abiertos + stats.en_proceso + stats.resueltos + stats.cerrados;
          const resueltosTotal = stats.resueltos + stats.cerrados;
          const tasaResolucion = totalAbsoluto > 0 ? Math.round((resueltosTotal / totalAbsoluto) * 100) : 0;
          
          const pctAbiertos = totalAbsoluto > 0 ? Math.round((stats.abiertos / totalAbsoluto) * 100) : 0;
          const pctEnProceso = totalAbsoluto > 0 ? Math.round((stats.en_proceso / totalAbsoluto) * 100) : 0;
          const pctResueltos = totalAbsoluto > 0 ? Math.round((stats.resueltos / totalAbsoluto) * 100) : 0;
          const pctCerrados = totalAbsoluto > 0 ? Math.round((stats.cerrados_48h / (stats.cerrados || 1)) * 100) : 0;
          const pctUrgentes = stats.abiertos > 0 ? Math.round((stats.por_cerrar / stats.abiertos) * 100) : 0;
          const pctNuevosHoy = totalAbsoluto > 0 ? Math.round((stats.tickets_hoy / totalAbsoluto) * 100) : 0;

          return (
          <>
            {/* Filtro período + reloj */}
            <div className="d-flex align-items-center gap-2 flex-wrap mb-4">
              <span className="text-muted fs-12 me-1">Período:</span>
              {PERIODOS.map(p => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPeriodo(p.key)}
                  className={`periodo-btn ${periodo === p.key ? 'active' : ''}`}
                >
                  {p.label}
                </button>
              ))}
              <span className="ms-auto d-flex align-items-center gap-1 text-muted fs-12">
                <i className="feather-clock" style={{ fontSize: 13 }}></i>
                <LiveClock />
                <span className="text-muted">&middot; {today}</span>
              </span>
            </div>

            {/* Fila 1: Total + estados */}
            <div className="row g-3 mb-4">
              <div className="col-xl-4 col-md-6">
                <StatsCard
                  icon="feather-inbox"
                  iconBg="bg-primary-subtle text-primary"
                  value={stats.total_filtrado}
                  label="TOTAL TICKETS"
                  footer={
                    <div className="d-flex gap-2 px-4 pb-2">
                      <button 
                        type="button" 
                        onClick={toggleVerTodos} 
                        className={`btn btn-sm flex-grow-1 ${verTodos ? 'btn-primary' : 'btn-outline-primary'}`}
                      >
                        {verTodos ? 'Ver solo mis tickets' : `Ver todos (${stats.total_global})`}
                      </button>
                      <Link to="tickets/nuevo" className="btn btn-primary btn-sm flex-grow-1">+ Nuevo</Link>
                    </div>
                  }
                />
              </div>

              <div className="col-xl-2 col-md-3 col-6">
                <StatsCard
                  icon="feather-alert-circle"
                  iconBg="bg-danger-subtle text-danger"
                  value={stats.abiertos}
                  label="Abiertos"
                  progress={{ label: 'Tickets activos', value: pctAbiertos, color: 'danger' }}
                  onClick={() => navigate('tickets?estado=abierto')}
                />
              </div>

              <div className="col-xl-2 col-md-3 col-6">
                <StatsCard
                  icon="feather-zap"
                  iconBg="bg-warning-subtle text-warning"
                  value={stats.en_proceso}
                  label="En Proceso"
                  progress={{ label: 'En atención', value: pctEnProceso, color: 'warning' }}
                  onClick={() => navigate('tickets?estado=en_proceso')}
                />
              </div>

              <div className="col-xl-2 col-md-3 col-6">
                <StatsCard
                  icon="feather-check-circle"
                  iconBg="bg-success-subtle text-success"
                  value={stats.resueltos}
                  label="Resueltos"
                  progress={{ label: 'Solucionados', value: pctResueltos, color: 'success' }}
                  onClick={() => navigate('tickets?estado=resuelto')}
                />
              </div>

              <div className="col-xl-2 col-md-3 col-6">
                <StatsCard
                  icon="feather-lock"
                  iconBg="bg-info-subtle text-info"
                  value={stats.cerrados_48h}
                  label="Cerrados"
                  progress={{ label: 'Últimas 48h', value: pctCerrados, color: 'info' }}
                  onClick={() => navigate('tickets?estado=cerrado')}
                />
              </div>
            </div>

            {/* Fila 2: Por cerrar + Hoy + Tasa + Avisos */}
            <div className="row g-3 mb-4">
              <div className="col-xl-3 col-md-6">
                <StatsCard
                  icon="feather-alert-triangle"
                  iconBg="bg-warning-subtle text-warning"
                  value={stats.por_cerrar}
                  label="Por Cerrar en 4h"
                  progress={{ label: 'Atención urgente', value: pctUrgentes, color: 'warning' }}
                  footer={
                    stats.por_cerrar > 0 ? (
                      <div className="px-4 pb-2">
                        <Link to="tickets?estado=abierto&por_cerrar=1" className="btn btn-warning btn-sm w-100">Atender ahora</Link>
                      </div>
                    ) : undefined
                  }
                />
              </div>

              <div className="col-xl-2 col-md-6">
                <StatsCard
                  icon="feather-calendar"
                  iconBg="bg-primary-subtle text-primary"
                  value={stats.tickets_hoy}
                  label="Tickets Hoy"
                  progress={{ label: 'Nuevos tickets', value: pctNuevosHoy, color: 'primary' }}
                />
              </div>

              <div className="col-xl-3 col-md-6">
                <StatsCard
                  icon="feather-trending-up"
                  iconBg="bg-success-subtle text-success"
                  value={`${tasaResolucion}%`}
                  label="Tasa Resolución"
                  progress={{ 
                    label: `Efectividad: ${resueltosTotal} / ${totalAbsoluto}`, 
                    value: tasaResolucion, 
                    color: 'success' 
                  }}
                />
              </div>

              {/* Avisos TI */}
              <div className="col-xl-4 col-md-12">
                <AvisosTIPanel isAdmin={isAdmin} />
              </div>
            </div>

            {/* Tickets recientes */}
            <div className="card stretch stretch-full">
              <div className="card-header d-flex align-items-center justify-content-between">
                <h5 className="card-title mb-0">
                  <i className="feather-clock me-2 text-primary" />
                  Actividad Reciente
                </h5>
                <div className="d-flex gap-2">
                  {isAdmin && (
                    <button
                      type="button"
                      className={`btn btn-sm ${stats.solo_mis_tickets ? 'btn-outline-primary' : 'btn-outline-secondary'}`}
                      onClick={toggleVerTodos}
                    >
                      {stats.solo_mis_tickets ? 'Mostrar todos' : 'Solo mis tickets'}
                    </button>
                  )}
                  <Link to="tickets" className="btn btn-primary btn-sm">Lista completa →</Link>
                </div>
              </div>
              <div className="card-body p-0" style={{ scrollbarGutter: 'stable' }}>
                <div className="table-responsive">
                  <table className="table table-hover mb-0" style={{ tableLayout: 'fixed', minWidth: 900 }}>
                    <colgroup>
                      <col style={{ width: 50 }} />
                      <col style={{ width: 120 }} />
                      <col style={{ width: 200 }} />
                      <col style={{ width: 140 }} />
                      <col style={{ width: 180 }} />
                      <col style={{ width: 150 }} />
                      <col style={{ width: 90 }} />
                      <col style={{ width: 150 }} />
                    </colgroup>
                    <thead className="table-light">
                      <tr>
                        <th className="ps-3">#</th>
                        <th>Creado por</th>
                        <th>Título</th>
                        <th>Cuenta</th>
                        <th>Categoría</th>
                        <th>Responsable TI</th>
                        <th>Estado</th>
                        <th>Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.tickets_recientes.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center text-muted py-4">
                            <i className="feather-inbox fs-3 d-block mb-2" />
                            No hay tickets recientes.
                          </td>
                        </tr>
                      ) : (
                        stats.tickets_recientes.map(t => <TicketRow key={t.id} t={t} />)
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
          );
        })()}
      </div>
    </>
  );
}
