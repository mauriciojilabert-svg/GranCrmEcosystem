import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getTickets, getLookupCategorias, getLookupCuentas, getUsuarios } from '../lib/api';
import type { TicketListItemOut, CategoriaLookupItem, CuentaLookupItem, UsuarioOut } from '../apiTypes';
import { Loading } from '../components/Loading';
import { ErrorAlert } from '../components/ErrorAlert';
import { EstadoBadge } from '../components/EstadoBadge';
import { ResponsiveTable } from '../components/ResponsiveTable';
import { useSession } from '../context';
import { PageHeader } from '../components/duralux/PageHeader';

function fmtDatetime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export function TicketListPage() {
  const session = useSession();
  const [searchParams, setSearchParams] = useSearchParams();

  const estado = searchParams.get('estado') ?? '';
  const categoria = searchParams.get('categoria') ?? '';
  const q = searchParams.get('q') ?? '';
  const cuenta = searchParams.get('cuenta') ?? '';
  const periodo = searchParams.get('periodo') ?? '';
  const desde = searchParams.get('desde') ?? '';
  const hasta = searchParams.get('hasta') ?? '';
  const responsable = searchParams.get('responsable_ti') ?? '';
  const verTodos = searchParams.get('ver_todos') === '1';

  const [tickets, setTickets] = useState<TicketListItemOut[]>([]);
  const [categorias, setCategorias] = useState<CategoriaLookupItem[]>([]);
  const [cuentas, setCuentas] = useState<CuentaLookupItem[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Local filter form state (controlled)
  const [formQ, setFormQ] = useState(q);
  const [formEstado, setFormEstado] = useState(estado);
  const [formCuenta, setFormCuenta] = useState(cuenta);
  const [formCategoria, setFormCategoria] = useState(categoria);
  const [formPeriodo, setFormPeriodo] = useState(periodo);
  const [formDesde, setFormDesde] = useState(desde);
  const [formHasta, setFormHasta] = useState(hasta);
  const [formResponsable, setFormResponsable] = useState(responsable);

  const isAdmin = session?.rol === 'admin' || session?.rol === 'sa';

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getTickets({ estado, categoria, q, cuenta, periodo, desde, hasta, responsable_ti: responsable, ver_todos: verTodos })
      .then(data => { setTickets(data); setLoading(false); })
      .catch(e => { setError(String(e.message ?? e)); setLoading(false); });
  }, [estado, categoria, q, cuenta, periodo, desde, hasta, responsable, verTodos]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    getLookupCategorias().then(setCategorias).catch(() => {});
    getLookupCuentas().then(setCuentas).catch(() => {});
    getUsuarios().then(setUsuarios).catch(() => {});
  }, []);

  // Keep form in sync with URL changes
  useEffect(() => {
    setFormQ(q); setFormEstado(estado); setFormCuenta(cuenta);
    setFormCategoria(categoria); setFormPeriodo(periodo); setFormDesde(desde); setFormHasta(hasta); setFormResponsable(responsable);
  }, [q, estado, cuenta, categoria, periodo, desde, hasta, responsable]);

  function applyFilters() {
    const next = new URLSearchParams();
    if (verTodos) next.set('ver_todos', '1');
    if (formQ) next.set('q', formQ);
    if (formEstado) next.set('estado', formEstado);
    if (formCuenta) next.set('cuenta', formCuenta);
    if (formCategoria) next.set('categoria', formCategoria);
    if (formPeriodo) next.set('periodo', formPeriodo);
    if (formDesde) next.set('desde', formDesde);
    if (formHasta) next.set('hasta', formHasta);
    if (formResponsable) next.set('responsable_ti', formResponsable);
    setSearchParams(next, { replace: true });
  }

  function clearFilters() {
    const next = new URLSearchParams();
    if (verTodos) next.set('ver_todos', '1');
    setSearchParams(next, { replace: true });
  }

  function setQuickFilter(key: string, value: string) {
    const next = new URLSearchParams();
    if (verTodos) next.set('ver_todos', '1');
    if (value) next.set(key, value);
    setSearchParams(next, { replace: true });
  }

  function toggleVerTodos() {
    const next = new URLSearchParams(searchParams);
    if (verTodos) next.delete('ver_todos'); else next.set('ver_todos', '1');
    setSearchParams(next, { replace: true });
  }

  return (
    <>
      <style>{`
        .cuenta-tag { font-size: 11.5px; font-weight: 600; padding: 2px 8px; background: var(--bs-primary-bg-subtle); color: var(--bs-primary); border-radius: 6px; border: 1px solid var(--bs-primary-border-subtle); transition: all 0.2s; }
        .cuenta-tag:hover { background: var(--bs-primary); color: #fff; cursor: pointer; }
        .ticket-id { font-weight: 700; color: var(--bs-primary); text-decoration: none; }
        .ticket-titulo { color: var(--bs-body-color); text-decoration: none; font-weight: 500; }
        .ticket-titulo:hover { color: var(--bs-primary); }
        .avatar-ini { width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg,#6366f1,#8b5cf6); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; color: #fff; flex-shrink: 0; }
        .filtro-control { width: 180px !important; height: 28px !important; min-height: 28px !important; padding-top: 2px !important; padding-bottom: 2px !important; font-size: 12px !important; }
        .filtro-date { width: 140px !important; height: 28px !important; min-height: 28px !important; padding-top: 2px !important; padding-bottom: 2px !important; font-size: 12px !important; }
      `}</style>
      <PageHeader
        title="Resumen de Tickets"
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Tickets' }
        ]}
      >
        {isAdmin && (
          <button
            type="button"
            className={`btn btn-sm shadow-sm ${verTodos ? 'btn-light-brand' : 'btn-light'}`}
            onClick={toggleVerTodos}
          >
            <i className={`feather-${verTodos ? 'user' : 'users'} me-2`} />
            {verTodos ? 'Solo mis tickets' : 'Ver todos los tickets'}
          </button>
        )}
        <Link to="nuevo" className="btn btn-primary btn-sm">
          <i className="feather-plus me-2" />
          <span>Nuevo Ticket</span>
        </Link>
      </PageHeader>

      <div className="main-content">

      {/* Filters card */}
      <div className="card mb-4">
        <div className="card-body p-4">
          {/* Quick chips */}
          <div className="d-flex flex-wrap gap-3 mb-4 align-items-center">
            <span className="text-muted fw-bold" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Acceso rápido:</span>
            <div className="d-flex gap-2">
              {[
                { label: 'Abiertos', val: 'abierto', cls: 'text-danger' },
                { label: 'En Proceso', val: 'en_proceso', cls: 'text-warning' },
                { label: 'Resueltos', val: 'resuelto', cls: 'text-success' },
                { label: 'Cerrados', val: 'cerrado', cls: 'text-secondary' },
              ].map(({ label, val, cls }) => (
                <button
                  key={val}
                  type="button"
                  className={`btn btn-sm rounded-pill border bg-white ${estado === val ? 'fw-bold border-primary shadow-sm text-dark' : 'text-muted border-light-subtle'}`}
                  style={{ fontSize: 12 }}
                  onClick={() => setQuickFilter('estado', val)}
                >
                  <span className={`me-2 ${cls}`} style={{ fontSize: 10 }}>●</span>{label}
                </button>
              ))}
            </div>
            <div className="d-flex gap-2 ms-2">
              {[
                { label: 'Hoy', val: 'hoy', icon: 'calendar' },
                { label: 'Esta semana', val: 'semana', icon: 'calendar' },
                { label: 'Este mes', val: 'mes', icon: 'calendar' },
              ].map(({ label, val, icon }) => (
                <button
                  key={val}
                  type="button"
                  className={`btn btn-sm rounded-pill border bg-white ${periodo === val ? 'fw-bold border-primary shadow-sm text-primary' : 'text-muted border-light-subtle'}`}
                  style={{ fontSize: 12 }}
                  onClick={() => setQuickFilter('periodo', val)}
                >
                  <i className={`feather-${icon} me-1 ${periodo === val ? 'text-primary' : 'text-danger'}`} /> {label}
                </button>
              ))}
            </div>
          </div>

          {/* Advanced filters */}
          <div className="mb-3">
            <div className="input-group input-group-sm shadow-sm bg-white rounded-3">
              <span className="input-group-text bg-white border-end-0 text-muted ps-3">
                <i className="feather-search" />
              </span>
              <input
                type="text"
                value={formQ}
                onChange={e => setFormQ(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && applyFilters()}
                className="form-control border-start-0 py-2"
                style={{ fontSize: 13, boxShadow: 'none' }}
                placeholder="Buscar por título o descripción del ticket..."
              />
            </div>
          </div>

          <div className="row g-2 align-items-end mb-3">
            <div className="col-auto">
              <label className="mb-1 text-muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>Cuenta</label>
              <select
                className="form-select form-select-sm filtro-control"
                value={formCuenta}
                onChange={e => setFormCuenta(e.target.value)}
              >
                <option value="">Todas</option>
                {cuentas.map(c => (
                  <option key={c.id} value={String(c.id)}>{c.nombre}</option>
                ))}
              </select>
            </div>
            <div className="col-auto">
              <label className="mb-1 text-muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>Estado</label>
              <select
                className="form-select form-select-sm filtro-control"
                value={formEstado}
                onChange={e => setFormEstado(e.target.value)}
              >
                <option value="">Todos</option>
                <option value="abierto">Abierto</option>
                <option value="en_proceso">En Proceso</option>
                <option value="resuelto">Resuelto</option>
                <option value="cerrado">Cerrado</option>
              </select>
            </div>
            <div className="col-auto">
              <label className="mb-1 text-muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>Período</label>
              <select
                className="form-select form-select-sm filtro-control"
                value={formPeriodo}
                onChange={e => setFormPeriodo(e.target.value)}
              >
                <option value="">Cualquier fecha</option>
                <option value="hoy">Hoy</option>
                <option value="semana">Esta semana</option>
                <option value="mes">Este mes</option>
              </select>
            </div>
            <div className="col-auto">
              <label className="mb-1 text-muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>Servicio</label>
              <select
                className="form-select form-select-sm filtro-control"
                value={formCategoria}
                onChange={e => setFormCategoria(e.target.value)}
              >
                <option value="">Todas</option>
                {categorias.map(c => (
                  <option key={c.id} value={String(c.id)}>{c.nombre}</option>
                ))}
              </select>
            </div>
            <div className="col-auto">
              <label className="mb-1 text-muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>Desde</label>
              <input
                type="date"
                className="form-control form-control-sm filtro-date"
                value={formDesde}
                onChange={e => setFormDesde(e.target.value)}
              />
            </div>
            <div className="col-auto">
              <label className="mb-1 text-muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>Hasta</label>
              <input
                type="date"
                className="form-control form-control-sm filtro-date"
                value={formHasta}
                onChange={e => setFormHasta(e.target.value)}
              />
            </div>
            <div className="col-auto">
              <label className="mb-1 text-muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>Responsable TI</label>
              <select
                className="form-select form-select-sm filtro-control"
                value={formResponsable}
                onChange={e => setFormResponsable(e.target.value)}
              >
                <option value="">Todos</option>
                {usuarios.filter(u => u.rol === 'admin' && u.activo).map(u => (
                  <option key={u.id} value={String(u.id)}>{u.nombre}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="d-flex gap-2 mt-3">
            <button type="button" className="btn btn-primary btn-sm fw-semibold px-3 shadow-sm" style={{ borderRadius: 6 }} onClick={applyFilters}>
              <i className="feather-filter me-1" /> Aplicar filtros
            </button>
            <button type="button" className="btn btn-white border border-light-subtle btn-sm fw-semibold px-3 text-muted shadow-sm" style={{ borderRadius: 6, backgroundColor: '#fff' }} onClick={clearFilters}>
              <i className="feather-x me-1" /> Limpiar
            </button>
          </div>
        </div>
      </div>

      {loading && <Loading />}
      {error && <ErrorAlert error={error} onRetry={load} />}

      {!loading && !error && (
        <div className="card stretch stretch-full">
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover mb-0" style={{ tableLayout: 'fixed', width: '100%', wordWrap: 'break-word' }}>
                <thead className="table-light">
                  <tr>
                    <th className="ps-3" style={{ width: '4%' }}>#</th>
                    <th style={{ width: '11%' }}>Creado por</th>
                    <th style={{ width: '20%' }}>Título</th>
                    <th style={{ width: '14%' }}>Cuenta</th>
                    <th style={{ width: '18%' }}>Categoría</th>
                    <th style={{ width: '13%' }}>Responsable TI</th>
                    <th style={{ width: '10%' }}>Estado</th>
                    <th style={{ width: '10%' }}>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center text-muted py-4">
                        <i className="feather-inbox fs-3 d-block mb-2" />
                        No hay tickets que coincidan con los filtros.
                      </td>
                    </tr>
                  ) : (
                    tickets.map(t => {
                      const initials = (t.asignado_a_nombre ?? '').slice(0, 2).toUpperCase();
                      return (
                      <tr key={t.id} style={{ opacity: t.estado === 'cerrado' ? 0.7 : 1 }}>
                        <td className="ps-3">
                          <Link to={String(t.id)} className="ticket-id">#{t.id}</Link>
                        </td>
                        <td className="fs-12 text-wrap text-break">{t.creado_por_nombre ?? '—'}</td>
                        <td className="text-wrap text-break">
                          <Link to={String(t.id)} className="ticket-titulo">{t.titulo}</Link>
                        </td>
                        <td className="text-wrap text-break">
                          <button
                            type="button"
                            className="btn btn-link p-0 cuenta-tag text-start text-decoration-none text-wrap text-break"
                            onClick={() => setQuickFilter('cuenta', String(t.cuenta_id))}
                          >
                            {t.cuenta_nombre ?? '—'}
                          </button>
                        </td>
                        <td>
                          {t.categoria_nombre ? (
                            <div className="d-flex flex-column gap-1">
                              <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--bs-primary)', background: 'var(--bs-primary-bg-subtle)', border: '1px solid var(--bs-primary-border-subtle)', borderRadius: 6, padding: '2px 8px', width: 'fit-content' }}>
                                {t.categoria_nombre}
                                {t.plataforma_bi ? ` · ${t.plataforma_bi}` : ''}
                              </span>
                              {t.subcategoria_nombre && <small className="text-muted ps-1">› {t.subcategoria_nombre}</small>}
                            </div>
                          ) : t.tipo_incidencia ? (
                            <span className="text-muted fst-italic fs-12">{t.tipo_incidencia}</span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td>
                          {t.asignado_a_nombre ? (
                            <div className="d-flex align-items-center gap-2">
                              <div className="avatar-ini">{initials}</div>
                              <span className="fs-12 fw-semibold">{t.asignado_a_nombre}</span>
                              {t.fue_reasignado && (
                                <span className="badge bg-warning-subtle text-warning border border-warning-subtle ms-1" style={{ fontSize: 9 }}>REASIGNADO</span>
                              )}
                            </div>
                          ) : (
                            <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle">Sin asignar</span>
                          )}
                        </td>
                        <td><EstadoBadge estado={t.estado} /></td>
                        <td className="text-muted fs-12 text-nowrap">{fmtDatetime(t.fecha_creacion)}</td>
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
