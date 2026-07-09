import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getNotificaciones, deleteNotificacion } from '../lib/api';
import type { NotificacionOut } from '../apiTypes';
import { Loading } from '../components/Loading';
import { ErrorAlert } from '../components/ErrorAlert';
import { ResponsiveTable } from '../components/ResponsiveTable';
import { PageHeader } from '../components/duralux/PageHeader';

export function NotificacionesListPage() {
  const [notificaciones, setNotificaciones] = useState<NotificacionOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [confirmNombre, setConfirmNombre] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getNotificaciones()
      .then(data => { setNotificaciones(data); setLoading(false); })
      .catch(e => { setError(String(e.message ?? e)); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  function askDelete(id: number, nombre: string) {
    setConfirmId(id);
    setConfirmNombre(nombre);
  }

  function cancelDelete() {
    setConfirmId(null);
    setConfirmNombre('');
  }

  async function confirmDelete() {
    if (!confirmId) return;
    setDeleting(confirmId);
    setConfirmId(null);
    try {
      await deleteNotificacion(confirmId);
      setNotificaciones(prev => prev.filter(n => n.id !== confirmId));
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Notificaciones"
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Notificaciones de Servicio' }
        ]}
      >
        <Link to="nuevo" className="btn btn-primary btn-sm">
          <i className="feather-plus me-2" />
          <span>Nueva Configuración</span>
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
                  <h5 className="card-title">Configuraciones de Notificación</h5>
                  <div className="card-header-action">
                    <span className="badge bg-primary-subtle text-primary">
                      {notificaciones.length} configuración{notificaciones.length !== 1 ? 'es' : ''}
                    </span>
                  </div>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-hover mb-0">
                      <thead className="table-light">
                        <tr>
                          <th className="ps-3" style={{ width: '25%' }}>Servicio</th>
                          <th style={{ width: '45%' }}>Emails CC</th>
                          <th className="text-center" style={{ width: '15%' }}>Estado</th>
                          <th className="text-end pe-4" style={{ width: '15%' }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {notificaciones.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="text-center text-muted py-4">
                              <i className="feather-bell fs-3 mb-2 d-block" />
                              Sin configuraciones de notificación.
                            </td>
                          </tr>
                        ) : (
                          notificaciones.map(n => (
                            <tr key={n.id} style={{ opacity: n.activo ? 1 : 0.55 }}>
                              <td className="ps-3">
                                <span className="badge bg-primary-subtle text-primary">
                                  {n.clasificacion_display}
                                </span>
                              </td>
                              <td className="text-muted" style={{ fontSize: 12 }}>{n.emails_cc || '—'}</td>
                              <td className="text-center">
                                {n.activo
                                  ? <span className="badge bg-success-subtle text-success"><i className="feather-check me-1" />Activo</span>
                                  : <span className="badge bg-secondary-subtle text-secondary">Inactivo</span>
                                }
                              </td>
                              <td className="text-end pe-4">
                                <div className="d-flex gap-2 justify-content-end">
                                  <Link to={String(n.id)} className="btn btn-sm btn-light-brand avatar-sm d-flex align-items-center justify-content-center" title="Editar">
                                    <i className="feather-edit-2" />
                                  </Link>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-light-danger avatar-sm d-flex align-items-center justify-content-center"
                                    disabled={deleting === n.id}
                                    onClick={() => askDelete(n.id, n.clasificacion_display)}
                                    title="Eliminar"
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

        {/* Confirm delete dialog */}
        {confirmId !== null && (
          <div
            className="modal fade show d-block"
            tabIndex={-1}
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
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
                      Eliminar Notificación
                    </h5>
                  </div>
                  <button type="button" className="btn-close" onClick={cancelDelete} />
                </div>
                <div className="modal-body" style={{ padding: '8px 24px 20px' }}>
                  <p className="text-muted mb-1">Se eliminará la notificación: <strong>{confirmNombre}</strong>.</p>
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
      </div>
    </>
  );
}
