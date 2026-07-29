import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getSLAs, deleteSLA } from '../lib/api';
import type { SLAOut } from '../apiTypes';
import { Loading } from '../components/Loading';
import { ErrorAlert } from '../components/ErrorAlert';
import { ResponsiveTable } from '../components/ResponsiveTable';
import { PageHeader } from '../components/duralux/PageHeader';

export function SLAListPage() {
  const [slas, setSlas] = useState<SLAOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getSLAs()
      .then(data => { setSlas(data); setLoading(false); })
      .catch(e => { setError(String(e.message ?? e)); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  // Build category summary
  const catSummary = (() => {
    const map = new Map<number, { nombre: string; count: number }>();
    for (const s of slas) {
      const existing = map.get(s.categoria_id);
      if (existing) {
        existing.count++;
      } else {
        map.set(s.categoria_id, { nombre: s.categoria_nombre ?? String(s.categoria_id), count: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
  })();

  function askDelete(id: number) { setConfirmId(id); }
  function cancelDelete() { setConfirmId(null); }

  async function confirmDelete() {
    if (!confirmId) return;
    setDeleting(confirmId);
    setConfirmId(null);
    try {
      await deleteSLA(confirmId);
      setSlas(prev => prev.filter(s => s.id !== confirmId));
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Configuración SLA"
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'SLA' }
        ]}
      >
        <Link to="nuevo" className="btn btn-primary btn-sm">
          <i className="feather-plus me-2" />
          <span>Nuevo SLA</span>
        </Link>
      </PageHeader>

      <div className="main-content">
        {error && <ErrorAlert error={error} onRetry={load} />}
        {loading && <Loading />}

        {!loading && !error && (
          <div className="row">
            <div className="col-xxl-12">
              <div className="card stretch stretch-full">
                <div className="card-header">
                  <h5 className="card-title">Resumen por Categoría</h5>
                  <div className="card-header-action">
                    <span className="badge bg-primary-subtle text-primary">
                      {catSummary.length} {catSummary.length !== 1 ? 'categorías' : 'categoría'}
                    </span>
                  </div>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-hover mb-0">
                      <thead className="table-light">
                        <tr>
                          <th className="ps-3" style={{ width: '40%' }}>Categoría</th>
                          <th className="text-center" style={{ width: '30%' }}>SLAs</th>
                          <th className="text-center pe-4" style={{ width: '30%' }}>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {catSummary.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="text-center p-4 text-muted">
                              <i className="feather-inbox fs-3 mb-2 d-block" />
                              Sin categorías configuradas.
                            </td>
                          </tr>
                        ) : (
                          catSummary.map(cat => (
                            <tr key={cat.nombre}>
                              <td className="ps-3 fw-bold text-dark">{cat.nombre}</td>
                              <td className="text-center">
                                <span className="badge bg-primary-subtle text-primary">
                                  {cat.count} SLA{cat.count !== 1 ? 's' : ''}
                                </span>
                              </td>
                              <td className="text-center pe-4">
                                <span className="badge bg-success-subtle text-success">
                                  Configurado
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-xxl-12">
              <div className="card stretch stretch-full">
                <div className="card-header">
                  <h5 className="card-title">Todos los SLA configurados</h5>
                  <div className="card-header-action">
                    <span className="badge bg-primary-subtle text-primary">
                      {slas.length} configuración{slas.length !== 1 ? 'es' : ''}
                    </span>
                  </div>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-hover mb-0">
                      <thead className="table-light">
                        <tr>
                          <th className="ps-3" style={{ width: '15%' }}>Categoría</th>
                          <th style={{ width: '15%' }}>Subcategoría</th>
                          <th style={{ width: '10%' }}>Plataforma BI</th>
                          <th style={{ width: '15%' }}>Respuesta máx.</th>
                          <th style={{ width: '15%' }}>Cierre máx.</th>
                          <th style={{ width: '10%' }}>Descripción</th>
                          <th className="text-center" style={{ width: '10%' }}>Activo</th>
                          <th className="text-end pe-4" style={{ width: '10%' }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {slas.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="text-center p-4 text-muted">
                              <i className="feather-sliders fs-3 mb-2 d-block" />
                              <div className="fw-semibold mb-1">No hay SLAs configurados</div>
                              <Link to="nuevo" className="text-primary fw-semibold fs-13 text-decoration-none">
                                Crear el primero →
                              </Link>
                            </td>
                          </tr>
                        ) : (
                          slas.map(s => (
                            <tr key={s.id} style={{ opacity: s.activo ? 1 : 0.55 }}>
                              <td className="ps-3">
                                <span className="badge bg-primary-subtle text-primary">
                                  {s.categoria_nombre ?? '—'}
                                </span>
                              </td>
                              <td>
                                {s.subcategoria_nombre
                                  ? <span className="fw-medium text-secondary">{s.subcategoria_nombre}</span>
                                  : <span className="text-muted fst-italic" style={{ fontSize: 11 }}>General</span>
                                }
                              </td>
                              <td>
                                {s.plataforma_bi
                                  ? <span className="badge bg-info-subtle text-info">{s.plataforma_bi}</span>
                                  : <span className="text-muted">—</span>
                                }
                              </td>
                              <td>
                                <span className="badge bg-warning-subtle text-warning">
                                  <i className="feather-clock me-1" />
                                  {s.tiempo_respuesta_display}
                                </span>
                              </td>
                              <td>
                                <span className="badge bg-danger-subtle text-danger">
                                  <i className="feather-lock me-1" />
                                  {s.tiempo_cierre_display}
                                </span>
                              </td>
                              <td className="text-muted text-truncate" style={{ maxWidth: 180 }}>
                                {s.descripcion || '—'}
                              </td>
                              <td className="text-center">
                                {s.activo
                                  ? <span className="badge bg-success-subtle text-success"><i className="feather-check me-1" />Sí</span>
                                  : <span className="badge bg-secondary-subtle text-secondary">No</span>
                                }
                              </td>
                              <td className="text-end pe-4">
                                <div className="d-flex gap-2 justify-content-end">
                                  <Link to={String(s.id)} className="btn btn-sm btn-light-brand avatar-sm d-flex align-items-center justify-content-center" title="Editar SLA">
                                    <i className="feather-edit-2" />
                                  </Link>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-light-danger avatar-sm d-flex align-items-center justify-content-center"
                                    disabled={deleting === s.id}
                                    onClick={() => askDelete(s.id)}
                                    title="Eliminar SLA"
                                  >
                                    <i className="feather-trash-2" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirm modal */}
      {confirmId !== null && (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 400 }}>
            <div className="modal-content" style={{ borderRadius: 16, border: 'none', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
              <div className="modal-header border-0" style={{ padding: '20px 24px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: 'rgba(239,68,68,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <i className="feather-alert-triangle" style={{ color: '#ef4444', fontSize: 18 }} />
                  </div>
                  <h5 className="modal-title mb-0" style={{ color: '#1e293b', fontWeight: 800 }}>
                    Eliminar SLA
                  </h5>
                </div>
                <button type="button" className="btn-close" onClick={cancelDelete} />
              </div>
              <div className="modal-body" style={{ padding: '8px 24px 20px' }}>
                <p className="text-muted mb-1">Se eliminará esta configuración SLA permanentemente.</p>
                <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 0, fontWeight: 600 }}>
                  Esta acción no se puede deshacer.
                </p>
              </div>
              <div className="modal-footer border-0" style={{ padding: '0 24px 20px', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  style={{ borderRadius: 9, fontWeight: 600 }}
                  onClick={cancelDelete}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  style={{ borderRadius: 9, fontWeight: 600, boxShadow: '0 4px 12px rgba(239,68,68,0.3)' }}
                  onClick={confirmDelete}
                >
                  <i className="feather-trash-2 me-1" />Sí, eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
