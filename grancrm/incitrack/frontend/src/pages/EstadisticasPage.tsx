import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiFetch } from '../api';
import { PageHeader } from '../components/duralux/PageHeader';
import { ChartCard } from '../components/duralux/charts/ChartCard';
import { AreaChartWidget } from '../components/duralux/charts/AreaChartWidget';
import { BarChartWidget } from '../components/duralux/charts/BarChartWidget';
import { PieChartWidget } from '../components/duralux/charts/PieChartWidget';
import { ColoredStatCard } from '../components/duralux/ui/ColoredStatCard';
import { ProgressRing } from '../components/duralux/ui/ProgressRing';


const ESTADOS_LISTA = ['abierto', 'en proceso', 'resuelto', 'cerrado'];
const ESTADO_COLORS: Record<string, string> = {
  abierto: '#f59e0b', 'en proceso': '#3b82f6', resuelto: '#22c55e', cerrado: '#6b7591',
};
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// ─── Helper: truncar nombres largos ────────────────────────────────────────────
function shortName(name: string, max: number = 16): string {
  if (!name) return '–';
  if (name.includes('@')) {
    const local = name.split('@')[0];
    return local.length > max ? local.slice(0, max) + '…' : local;
  }
  return name.length > max ? name.slice(0, max) + '…' : name;
}

// (Inline ProgressRing and StatCard removed, importing from UI now)

// ─── Ranking Table (Duralux style) ─────────────────────────────────────────────
function RankingTable({ data, valueLabel }: {
  data: { name: string; value: number }[]; valueLabel: string;
}): JSX.Element {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const colors = ['#6c63ff', '#3b82f6', '#14b8a6', '#f59e0b', '#ec4899'];
  return (
    <div className="table-responsive">
      <table className="table table-hover mb-0">
        <thead>
          <tr>
            <th className="fs-11 fw-bold text-muted text-uppercase border-0 pb-2" style={{ width: 30 }}>#</th>
            <th className="fs-11 fw-bold text-muted text-uppercase border-0 pb-2">Nombre</th>
            <th className="fs-11 fw-bold text-muted text-uppercase border-0 pb-2 text-end" style={{ width: 60 }}>{valueLabel}</th>
            <th className="fs-11 fw-bold text-muted text-uppercase border-0 pb-2" style={{ width: '40%' }}></th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              <td className="border-0 py-2">
                <span className="badge rounded-pill fw-bold"
                  style={{ background: colors[i % colors.length], color: '#fff', width: 24, height: 24, lineHeight: '24px', textAlign: 'center', display: 'inline-block' }}>
                  {i + 1}
                </span>
              </td>
              <td className="border-0 py-2 fw-semibold fs-13 text-dark">{row.name}</td>
              <td className="border-0 py-2 fw-bold fs-13 text-dark text-end">{row.value}</td>
              <td className="border-0 py-2">
                <div className="progress" style={{ height: 6, borderRadius: 3 }}>
                  <div className="progress-bar" style={{
                    width: `${(row.value / maxVal) * 100}%`,
                    background: colors[i % colors.length],
                    borderRadius: 3,
                  }}></div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Filter Bar ────────────────────────────────────────────────────────────────
function FilterBar({ fechaDesde, fechaHasta, adminTI, solicitante, categoria, cuenta,
  admins, solicitantes, categorias, cuentas, onChange, onClear,
}: {
  fechaDesde: string; fechaHasta: string; adminTI: string; solicitante: string;
  categoria: string; cuenta: string; admins: string[]; solicitantes: string[];
  categorias: string[]; cuentas: string[];
  onChange: (f: string, v: string) => void; onClear: () => void;
}): JSX.Element {
  const hasFilters = fechaDesde || fechaHasta || adminTI || solicitante || categoria || cuenta;
  return (
    <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: 14 }}>
      <div className="card-body py-3">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h6 className="fw-bold mb-0"><i className="feather-filter me-2 text-muted"></i>Filtros</h6>
          {hasFilters && (
            <button className="btn btn-sm btn-light text-danger fw-semibold" onClick={onClear}>
              <i className="feather-x me-1"></i>Limpiar
            </button>
          )}
        </div>
        <div className="row g-2">
          <div className="col-6 col-md-2">
            <label className="form-label fs-11 fw-semibold text-muted mb-1">Desde</label>
            <input type="date" className="form-control" value={fechaDesde}
              onChange={e => onChange('fechaDesde', e.target.value)} />
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label fs-11 fw-semibold text-muted mb-1">Hasta</label>
            <input type="date" className="form-control" value={fechaHasta}
              onChange={e => onChange('fechaHasta', e.target.value)} />
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label fs-11 fw-semibold text-muted mb-1">Admin TI</label>
            <select className="form-control form-select" value={adminTI}
              onChange={e => onChange('adminTI', e.target.value)}>
              <option value="">Todos</option>
              {admins.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label fs-11 fw-semibold text-muted mb-1">Solicitante</label>
            <select className="form-control form-select" value={solicitante}
              onChange={e => onChange('solicitante', e.target.value)}>
              <option value="">Todos</option>
              {solicitantes.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label fs-11 fw-semibold text-muted mb-1">Servicio</label>
            <select className="form-control form-select" value={categoria}
              onChange={e => onChange('categoria', e.target.value)}>
              <option value="">Todos</option>
              {categorias.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label fs-11 fw-semibold text-muted mb-1">Cuenta</label>
            <select className="form-control form-select" value={cuenta}
              onChange={e => onChange('cuenta', e.target.value)}>
              <option value="">Todas</option>
              {cuentas.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export function EstadisticasPage(): JSX.Element {
  const [rawTickets, setRawTickets] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any>(null);
  const [tiempos, setTiempos] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    fechaDesde: '', fechaHasta: '', adminTI: '', solicitante: '', categoria: '', cuenta: '',
  });
  const handleFilter = useCallback((f: string, v: string) => setFilters(p => ({ ...p, [f]: v })), []);
  const clearFilters = useCallback(() => setFilters({ fechaDesde: '', fechaHasta: '', adminTI: '', solicitante: '', categoria: '', cuenta: '' }), []);

  useEffect(() => {
    const load = async () => {
      setLoading(true); setError(null);
      try {
        const tickets = await apiFetch<any[]>('tickets/?ver_todos=true&limite=2000');
        const kpisData = {};
        const tiemposData = { promedio_hrs: 0 };
        setRawTickets(tickets.map((t: any) => ({
          ...t,
          fecha_obj: t.fecha_creacion ? new Date(t.fecha_creacion) : new Date(),
          estado_norm: (t.estado || '').toLowerCase().trim().replace('_', ' '),
        })));
        setKpis(kpisData);
        setTiempos(tiemposData);
      } catch {
        setError('Error al obtener los tickets del backend local.');
      } finally {
        setLoading(false);
      }
    };
    load();
    const iv = setInterval(load, 300000);
    return () => clearInterval(iv);
  }, []);

  // Dropdown options
  const uniqueAdmins = useMemo(() => [...new Set(rawTickets.map(t => t.asignado_a_nombre).filter(Boolean))].sort(), [rawTickets]);
  const uniqueSolicitantes = useMemo(() => [...new Set(rawTickets.map(t => t.creado_por_nombre).filter(Boolean))].sort(), [rawTickets]);
  const uniqueCategorias = useMemo(() => [...new Set(rawTickets.map(t => t.categoria_nombre).filter(Boolean))].sort(), [rawTickets]);
  const uniqueCuentas = useMemo(() => [...new Set(rawTickets.map(t => t.cuenta_nombre).filter(Boolean))].sort(), [rawTickets]);

  // Filtered
  const filteredTickets = useMemo(() => rawTickets.filter(t => {
    if (filters.fechaDesde && t.fecha_obj < new Date(filters.fechaDesde + 'T00:00:00')) return false;
    if (filters.fechaHasta && t.fecha_obj > new Date(filters.fechaHasta + 'T23:59:59')) return false;
    if (filters.adminTI && t.asignado_a_nombre !== filters.adminTI) return false;
    if (filters.solicitante && t.creado_por_nombre !== filters.solicitante) return false;
    if (filters.categoria && t.categoria_nombre !== filters.categoria) return false;
    if (filters.cuenta && t.cuenta_nombre !== filters.cuenta) return false;
    return true;
  }), [rawTickets, filters]);

  // ─── Metrics ───────────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const total = filteredTickets.length;
    const abiertos = filteredTickets.filter(t => t.estado_norm === 'abierto').length;
    const enProceso = filteredTickets.filter(t => t.estado_norm === 'en proceso').length;
    const resueltos = filteredTickets.filter(t => t.estado_norm === 'resuelto' || t.estado_norm === 'cerrado').length;
    const tasa = total > 0 ? Math.round((resueltos / total) * 100) : 0;
    const now = new Date();
    const estancados = filteredTickets.filter(t => {
      if (t.estado_norm === 'resuelto' || t.estado_norm === 'cerrado') return false;
      return (now.getTime() - t.fecha_obj.getTime()) / 3600000 > 48;
    }).length;
    return { total, abiertos, enProceso, resueltos, tasa, estancados, sla: kpis?.sla_cumplimiento ?? 0, mttr: tiempos?.promedio_hrs ?? 0 };
  }, [filteredTickets, kpis, tiempos]);

  // Volumen Semanal
  const weekData = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0];
    const now = new Date();
    const dow = now.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    const start = new Date(now); start.setDate(now.getDate() + diff); start.setHours(0, 0, 0, 0);
    filteredTickets.forEach(t => {
      if (t.fecha_obj >= start) { const d = t.fecha_obj.getDay(); if (d >= 1 && d <= 6) counts[d - 1]++; }
    });
    return DIAS_SEMANA.map((name, i) => ({ name, Tickets: counts[i] }));
  }, [filteredTickets]);

  // Estados
  const estadoData = useMemo(() => {
    const c: Record<string, number> = {}; ESTADOS_LISTA.forEach(e => c[e] = 0);
    filteredTickets.forEach(t => { if (c[t.estado_norm] !== undefined) c[t.estado_norm]++; });
    return ESTADOS_LISTA.map(e => ({
      name: e.charAt(0).toUpperCase() + e.slice(1), value: c[e], color: ESTADO_COLORS[e],
    })).filter(e => e.value > 0);
  }, [filteredTickets]);

  // Top Categorías
  const topCategorias = useMemo(() => {
    const m: Record<string, number> = {};
    filteredTickets.forEach(t => { const c = t.categoria_nombre || 'Sin Categoría'; m[c] = (m[c] || 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name: shortName(name), value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [filteredTickets]);

  // Top Cuentas
  const topCuentas = useMemo(() => {
    const m: Record<string, number> = {};
    filteredTickets.forEach(t => { const c = t.cuenta_nombre || 'Sin Cuenta'; m[c] = (m[c] || 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name: shortName(name, 20), value })).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [filteredTickets]);

  // Carga Admin TI
  const adminCarga = useMemo(() => {
    const m: Record<string, { activos: number; resueltos: number }> = {};
    filteredTickets.forEach(t => {
      const a = shortName(t.asignado_a_nombre || 'Sin Asignar');
      if (!m[a]) m[a] = { activos: 0, resueltos: 0 };
      if (t.estado_norm === 'abierto' || t.estado_norm === 'en proceso') m[a].activos++;
      if (t.estado_norm === 'resuelto' || t.estado_norm === 'cerrado') m[a].resueltos++;
    });
    return Object.entries(m)
      .map(([name, v]) => ({ name, Activos: v.activos, Resueltos: v.resueltos }))
      .sort((a, b) => (b.Activos + b.Resueltos) - (a.Activos + a.Resueltos)).slice(0, 5);
  }, [filteredTickets]);

  // Ranking Supervisores (creadores de tickets)
  const rankingSupervisores = useMemo(() => {
    const m: Record<string, number> = {};
    filteredTickets.forEach(t => {
      const n = t.creado_por_nombre;
      if (n) m[n] = (m[n] || 0) + 1;
    });
    return Object.entries(m).map(([name, value]) => ({ name: shortName(name, 22), value })).sort((a, b) => b.value - a.value).slice(0, 7);
  }, [filteredTickets]);

  // Alertas
  const alertaBacklog = metrics.estancados > 5
    ? `${metrics.estancados} tickets llevan más de 48h sin resolverse. Requieren atención inmediata.` : null;

  const alertaTendencia = useMemo(() => {
    if (!topCategorias.length || metrics.total < 10) return null;
    const top = topCategorias[0];
    const pct = Math.round((top.value / metrics.total) * 100);
    return pct >= 30 && top.value >= 5
      ? `"${top.name}" concentra el ${pct}% de las incidencias. Considere un plan correctivo.` : null;
  }, [topCategorias, metrics.total]);

  const isFiltered = Object.values(filters).some(v => v !== '');

  return (
    <div>
      <PageHeader title="Centro de Analítica TI" breadcrumb={[{ label: 'Estadísticas' }]} />

      {error && (
        <div className="alert alert-danger shadow-sm mb-3"><i className="feather-wifi-off me-2"></i>{error}</div>
      )}

      {/* Filtros */}
      <FilterBar
        fechaDesde={filters.fechaDesde} fechaHasta={filters.fechaHasta}
        adminTI={filters.adminTI} solicitante={filters.solicitante}
        categoria={filters.categoria} cuenta={filters.cuenta}
        admins={uniqueAdmins} solicitantes={uniqueSolicitantes}
        categorias={uniqueCategorias} cuentas={uniqueCuentas}
        onChange={handleFilter} onClear={clearFilters}
      />

      {isFiltered && (
        <div className="mb-3">
          <span className="badge bg-primary-subtle text-primary px-3 py-2 fs-12 fw-semibold">
            <i className="feather-filter me-1"></i>Mostrando {filteredTickets.length} de {rawTickets.length} tickets
          </span>
        </div>
      )}

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border text-primary" role="status"></div></div>
      ) : (
        <>
          {/* KPI Row — 6 Colored Stat Cards */}
          <div className="row g-3 mb-3">
            <div className="col-6 col-md-4 col-xxl-2">
              <ColoredStatCard icon="feather-layers" value={metrics.total} label="Total Tickets" bg="bg-primary" />
            </div>
            <div className="col-6 col-md-4 col-xxl-2">
              <ColoredStatCard icon="feather-inbox" value={metrics.abiertos} label="Abiertos" bg="bg-warning" />
            </div>
            <div className="col-6 col-md-4 col-xxl-2">
              <ColoredStatCard icon="feather-loader" value={metrics.enProceso} label="En Proceso" bg="bg-info" />
            </div>
            <div className="col-6 col-md-4 col-xxl-2">
              <ColoredStatCard icon="feather-check-circle" value={metrics.resueltos} label="Resueltos" bg="bg-success" />
            </div>
            <div className="col-6 col-md-4 col-xxl-2">
              <ColoredStatCard icon="feather-clock" value={metrics.estancados} label="Estancados >48h" bg="bg-danger" />
            </div>
            <div className="col-6 col-md-4 col-xxl-2">
              <ColoredStatCard icon="feather-activity" value={`${metrics.mttr}h`} label="Tiempo Prom. Resolución" bg="bg-indigo" />
            </div>
          </div>

          {/* Progress Rings + Estado Donut */}
          <div className="row g-3 mb-3">
            <div className="col-12 col-md-6">
              <div className="card border-0 shadow-sm h-100" style={{ borderRadius: 14 }}>
                <div className="card-body d-flex align-items-center justify-content-around py-4">
                  <div className="text-center">
                    <ProgressRing value={metrics.tasa} color="#22c55e" />
                    <p className="fs-11 fw-bold text-muted mt-2 mb-0">Resolución</p>
                  </div>
                  <div className="text-center">
                    <ProgressRing value={metrics.sla} color="#6c63ff" />
                    <p className="fs-11 fw-bold text-muted mt-2 mb-0">SLA</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-12 col-md-6">
              <ChartCard title="Estado de Tickets">
                <PieChartWidget data={estadoData} height={140} />
              </ChartCard>
            </div>
          </div>

          {/* Volumen + Categorías */}
          <div className="row g-3 mb-3">
            <div className="col-12 col-xl-6">
              <ChartCard title="Volumen Semanal (Lun–Sáb)" subtitle="Picos de operación esta semana">
                <AreaChartWidget data={weekData}
                  series={[{ key: 'Tickets', color: '#6c63ff', label: 'Tickets' }]}
                  height={200} />
              </ChartCard>
            </div>
            <div className="col-12 col-xl-6">
              <ChartCard title="Distribución por Servicio" subtitle="Categorías con más incidencias">
                <BarChartWidget data={topCategorias}
                  series={[{ key: 'value', color: '#f59e0b', label: 'Tickets' }]}
                  height={200} barSize={30} />
              </ChartCard>
            </div>
          </div>

          {/* Cuentas + Admins TI + Ranking Supervisores */}
          <div className="row g-3 mb-3">
            <div className="col-12 col-xl-4">
              <ChartCard title="Top Cuentas" subtitle="Mayor volumen de incidencias">
                <BarChartWidget data={topCuentas}
                  series={[{ key: 'value', color: '#14b8a6', label: 'Tickets' }]}
                  layout="vertical" height={220} barSize={12} />
              </ChartCard>
            </div>
            <div className="col-12 col-xl-4">
              <ChartCard title="Carga de Admins TI" subtitle="Activos vs resueltos por responsable">
                <BarChartWidget data={adminCarga}
                  series={[
                    { key: 'Activos', color: '#f59e0b', label: 'Activos' },
                    { key: 'Resueltos', color: '#22c55e', label: 'Resueltos' },
                  ]}
                  layout="vertical" height={220} barSize={12} stacked />
              </ChartCard>
            </div>
            <div className="col-12 col-xl-4">
              <div className="card border-0 shadow-sm h-100" style={{ borderRadius: 14 }}>
                <div className="card-header bg-white border-0 pt-4 pb-0">
                  <h6 className="card-title fw-bold mb-0">Ranking Supervisores</h6>
                  <p className="fs-12 text-muted mb-0 mt-1">Usuarios que más solicitan</p>
                </div>
                <div className="card-body pt-3">
                  {rankingSupervisores.length > 0 ? (
                    <RankingTable data={rankingSupervisores} valueLabel="Tkts" />
                  ) : (
                    <p className="text-muted text-center py-4 fs-13">
                      <i className="feather-users me-2"></i>Sin datos
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Alertas al final */}
          {(alertaBacklog || alertaTendencia) && (
            <div className="row g-3 mb-4">
              {alertaBacklog && (
                <div className="col-12 col-md-6">
                  <div className="card border-0 shadow-sm" style={{ borderRadius: 14, background: '#fef2f2' }}>
                    <div className="card-body d-flex align-items-center py-3">
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <i className="feather-alert-triangle text-danger fs-5"></i>
                      </div>
                      <div className="ms-3">
                        <h6 className="fw-bold mb-1 fs-13 text-danger">Backlog Crítico</h6>
                        <p className="mb-0 fs-12" style={{ color: '#991b1b' }}>{alertaBacklog}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {alertaTendencia && (
                <div className="col-12 col-md-6">
                  <div className="card border-0 shadow-sm" style={{ borderRadius: 14, background: '#fffbeb' }}>
                    <div className="card-body d-flex align-items-center py-3">
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <i className="feather-trending-up text-warning fs-5"></i>
                      </div>
                      <div className="ms-3">
                        <h6 className="fw-bold mb-1 fs-13 text-warning">Tendencia Detectada</h6>
                        <p className="mb-0 fs-12" style={{ color: '#92400e' }}>{alertaTendencia}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
