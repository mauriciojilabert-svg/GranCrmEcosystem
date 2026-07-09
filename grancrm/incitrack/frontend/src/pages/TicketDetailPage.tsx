import { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getTicket, cerrarTicket, agregarComentario, editTicket, getUsuarios, getTicketAuditoria } from '../lib/api';
import type { TicketOut, ComentarioOut, UsuarioOut, TicketAuditOut } from '../apiTypes';
import { Loading } from '../components/Loading';
import { ErrorAlert } from '../components/ErrorAlert';
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

const ESTADO_COLOR: Record<string, { color: string; bg: string }> = {
  abierto:    { color: '#ef4444', bg: '#fef2f2' },
  en_proceso: { color: '#f59e0b', bg: '#fffbeb' },
  resuelto:   { color: '#10b981', bg: '#ecfdf5' },
  cerrado:    { color: '#6b7280', bg: '#f3f4f6' },
};

const ESTADO_LABEL: Record<string, string> = {
  abierto: 'Abierto', en_proceso: 'En Proceso', resuelto: 'Resuelto', cerrado: 'Cerrado',
};



export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const session = useSession();
  const ticketId = Number(id);

  const [ticket, setTicket] = useState<TicketOut | null>(null);
  const [comentarios, setComentarios] = useState<ComentarioOut[]>([]);
  const [auditorias, setAuditorias] = useState<TicketAuditOut[]>([]);
  const [activeTab, setActiveTab] = useState<'comentarios' | 'auditoria'>('comentarios');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [interno, setInterno] = useState(false);
  const [commentSaving, setCommentSaving] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [admins, setAdmins] = useState<UsuarioOut[]>([]);
  const [editEstado, setEditEstado] = useState('');
  const [editAsignado, setEditAsignado] = useState<number | ''>('');
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminSuccess, setAdminSuccess] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  const isAdmin = session?.rol === 'admin' || session?.rol === 'sa';

  const loadTicket = useCallback(() => {
    setLoading(true);
    setError(null);
    getTicket(ticketId)
      .then(t => {
        setTicket(t);
        setComentarios(t.comentarios ?? []);
        setEditEstado(t.estado);
        setEditAsignado(t.asignado_a_id ?? '');
        return getTicketAuditoria(ticketId);
      })
      .then(a => {
        setAuditorias(a);
        setLoading(false);
      })
      .catch(e => { setError(String(e.message ?? e)); setLoading(false); });
  }, [ticketId]);

  useEffect(() => { loadTicket(); }, [loadTicket]);

  useEffect(() => {
    if (isAdmin) {
      getUsuarios().then(us => setAdmins(us.filter(u => u.rol === 'admin' && u.activo)));
    }
  }, [isAdmin]);

  async function handleCerrar() {
    if (!ticket) return;
    if (!window.confirm(`¿Confirmas el cierre del ticket #${ticket.id}?`)) return;
    setClosing(true);
    setCloseError(null);
    try {
      const updated = await cerrarTicket(ticket.id);
      setTicket(updated);
      setEditEstado(updated.estado);
    } catch (e) {
      setCloseError(String((e as Error).message ?? e));
    } finally {
      setClosing(false);
    }
  }

  async function handleGuardarAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!ticket) return;
    setAdminSaving(true);
    setAdminError(null);
    setAdminSuccess(false);
    try {
      const updated = await editTicket(ticket.id, {
        estado: editEstado as any,
        asignado_a_id: editAsignado === '' ? null : Number(editAsignado),
      });
      setTicket(updated);
      setEditEstado(updated.estado);
      setEditAsignado(updated.asignado_a_id ?? '');
      setAdminSuccess(true);
      setTimeout(() => setAdminSuccess(false), 2500);
    } catch (e) {
      setAdminError(String((e as Error).message ?? e));
    } finally {
      setAdminSaving(false);
    }
  }

  async function handleComentario(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    setCommentSaving(true);
    setCommentError(null);
    try {
      const com = await agregarComentario(ticketId, { contenido: commentText, interno });
      setComentarios(prev => [...prev, com]);
      setCommentText('');
      setInterno(false);
      const updated = await getTicket(ticketId);
      setTicket(updated);
    } catch (e) {
      setCommentError(String((e as Error).message ?? e));
    } finally {
      setCommentSaving(false);
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorAlert error={error} onRetry={loadTicket} />;
  if (!ticket) return null;

  const estaCerrado = ticket.estado === 'cerrado';
  const estadoColor = ESTADO_COLOR[ticket.estado] ?? ESTADO_COLOR['abierto'];

  const clasificacion = [ticket.categoria_nombre, ticket.plataforma_bi, ticket.subcategoria_nombre]
    .filter(Boolean).join(' › ');

  return (
    <>
      <style>{`
        .meta-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          background: #f1f5f9;
          color: #475569;
        }
        .comentario-item {
          border-radius: 10px;
          padding: 14px 16px;
          margin-bottom: 12px;
          border: 1px solid #e9ecef;
          background: #f8f9fa;
          transition: box-shadow 0.2s;
        }
        .comentario-item:hover {
          box-shadow: 0 2px 8px rgba(0,0,0,.06);
        }
        .comentario-item.interno {
          background: #fffbeb;
          border-color: #fde68a;
        }
        .avatar-circle {
          width: 32px; height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg,#6366f1,#8b5cf6);
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 800; color: #fff; flex-shrink: 0;
        }
        .nav-tabs .nav-link {
          color: #64748b;
          font-weight: 600;
          border: none;
          border-bottom: 2px solid transparent;
          padding: 12px 20px;
          transition: all 0.2s;
        }
        .nav-tabs .nav-link:hover {
          color: #334155;
          border-bottom-color: #cbd5e1;
        }
        .nav-tabs .nav-link.active {
          color: #4f46e5;
          border-bottom-color: #4f46e5;
          background: transparent;
        }
      `}</style>

      {/* Page Header */}
      <PageHeader
        title={
          <span className="d-flex align-items-center gap-2 flex-wrap">
            Ticket <span className="text-primary">#{ticket.id}</span>
            {/* Estado badge */}
            <span className="ms-2" style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
              color: estadoColor.color, background: estadoColor.bg,
              border: `1.5px solid ${estadoColor.color}40`,
              letterSpacing: '0.5px', textTransform: 'uppercase',
            }}>
              {ESTADO_LABEL[ticket.estado] ?? ticket.estado}
            </span>
          </span>
        }
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Tickets', href: '..' },
          { label: `#${ticket.id}` }
        ]}
      >
        {!estaCerrado && (
          <button
            type="button"
            className="btn btn-success btn-sm"
            onClick={handleCerrar}
            disabled={closing}
            style={{ borderRadius: 8, fontWeight: 700 }}
          >
            <i className="feather-check-circle me-2" />
            {closing ? 'Cerrando...' : 'Cerrar Ticket'}
          </button>
        )}
        <Link to=".." relative="path" className="btn btn-light-brand btn-sm">
          <i className="feather-arrow-left me-2" />
          <span>Volver a Tickets</span>
        </Link>
      </PageHeader>

      <div className="main-content">
        {clasificacion && (
          <div className="mb-4">
            <span style={{ fontSize: 12.5, color: '#94a3b8' }}>
              <i className="feather-tag me-1" style={{ fontSize: 11 }} />{clasificacion}
            </span>
          </div>
        )}

        {closeError && <ErrorAlert error={closeError} />}

        <div className="row g-4">
          {/* ── Panel principal ── */}
          <div className={isAdmin && !estaCerrado ? 'col-lg-8' : 'col-12'}>
            
            {/* Ticket info */}
            <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: 14 }}>
              <div className="card-header">
                <h5 className="card-title mb-0">
                  <i className="feather-file-text me-2" />
                  {ticket.titulo}
                </h5>
              </div>
              <div className="card-body p-4">

                {/* Meta chips */}
                <div className="d-flex flex-wrap gap-2 mb-4">
                  <span className="meta-chip">
                    <i className="feather-user" style={{ fontSize: 11 }} />{ticket.creado_por_nombre}
                  </span>
                  <span className="meta-chip">
                    <i className="feather-calendar" style={{ fontSize: 11 }} />
                    {fmtDatetime(ticket.fecha_creacion)}
                  </span>
                  <span className="meta-chip">
                    <i className="feather-refresh-cw" style={{ fontSize: 11 }} />
                    Actualizado: {fmtDatetime(ticket.fecha_actualizacion)}
                  </span>
                  {ticket.cuenta_nombre && (
                    <span className="meta-chip" style={{ background: '#ede9fe', color: '#7c3aed' }}>
                      <i className="feather-briefcase" style={{ fontSize: 11 }} />{ticket.cuenta_nombre}
                    </span>
                  )}
                  {ticket.asignado_a_nombre && (
                    <span className="meta-chip" style={{ background: '#fef3c7', color: '#b45309' }}>
                      <i className="feather-zap" style={{ fontSize: 11 }} />
                      Asignado: {ticket.asignado_a_nombre}
                    </span>
                  )}
                  {ticket.fue_reasignado && (
                    <span className="meta-chip" style={{ background: '#fef3c7', color: '#b45309' }}>
                      <i className="feather-shuffle" style={{ fontSize: 11 }} />Reasignado
                    </span>
                  )}
                  {ticket.fecha_resolucion && (
                    <span className="meta-chip" style={{ background: '#dcfce7', color: '#16a34a' }}>
                      <i className="feather-check" style={{ fontSize: 11 }} />
                      Cerrado: {fmtDatetime(ticket.fecha_resolucion)}
                    </span>
                  )}
                </div>

                {/* Descripción */}
                <div className="text-dark" style={{ fontSize: '14px', lineHeight: 1.7 }}>
                  {ticket.descripcion.split('\n').map((line, i) => (
                    <span key={i}>{line}<br /></span>
                  ))}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="card border-0 shadow-sm mt-4" style={{ borderRadius: 14 }}>
              <div className="card-header border-bottom-0 pb-0">
                <ul className="nav nav-tabs border-bottom" role="tablist">
                  <li className="nav-item" role="presentation">
                    <button 
                      className={`nav-link ${activeTab === 'comentarios' ? 'active' : ''}`}
                      onClick={() => setActiveTab('comentarios')}
                      type="button"
                    >
                      <i className="feather-message-square me-2" />
                      Comentarios ({comentarios.length})
                    </button>
                  </li>
                  <li className="nav-item" role="presentation">
                    <button 
                      className={`nav-link ${activeTab === 'auditoria' ? 'active' : ''}`}
                      onClick={() => setActiveTab('auditoria')}
                      type="button"
                    >
                      <i className="feather-list me-2" />
                      Auditoría ({auditorias.length})
                    </button>
                  </li>
                </ul>
              </div>
              <div className="card-body p-4">
                
                {activeTab === 'comentarios' && (
                  <>
                    {comentarios.length === 0 && (
                  <div className="text-center py-4" style={{ color: '#94a3b8' }}>
                    <i className="feather-message-circle d-block mb-2" style={{ fontSize: 28 }} />
                    <span style={{ fontSize: 13 }}>Aún no hay comentarios.</span>
                  </div>
                )}

                {comentarios.map(com => (
                  <div key={com.id} className={`comentario-item${com.interno ? ' interno' : ''}`}>
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <div className="avatar-circle">
                        {(com.autor_nombre ?? '?').slice(0, 1).toUpperCase()}
                      </div>
                      <strong style={{ fontSize: 13 }}>{com.autor_nombre}</strong>
                      {com.interno && (
                        <span style={{
                          padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                          color: '#b45309', background: '#fef3c7', border: '1px solid #fde68a',
                        }}>
                          🔒 Interno
                        </span>
                      )}
                      <span className="ms-auto" style={{ fontSize: 11, color: '#94a3b8' }}>
                        {fmtDatetime(com.fecha)}
                      </span>
                    </div>
                    <div className="ps-5" style={{ fontSize: 13, lineHeight: 1.6, color: '#334155' }}>
                      {com.contenido.split('\n').map((line, i) => (
                        <span key={i}>{line}<br /></span>
                      ))}
                    </div>
                    </div>
                  ))}

                  {!estaCerrado && (
                    <form onSubmit={handleComentario} className="mt-3 pt-3" style={{ borderTop: '1px solid #f1f5f9' }}>
                    {commentError && <ErrorAlert error={commentError} />}
                    <label className="form-label fw-semibold">Nuevo Comentario</label>
                    <textarea
                      rows={3}
                      className="form-control mb-3"
                      placeholder="Escribe un comentario..."
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      required
                    />
                    <div className="d-flex align-items-center justify-content-between">
                      {isAdmin ? (
                        <div className="form-check custom-checkbox mb-0">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            id="chk-interno"
                            checked={interno}
                            onChange={e => setInterno(e.target.checked)}
                          />
                          <label className="form-check-label text-dark" style={{ fontSize: 13, cursor: 'pointer' }} htmlFor="chk-interno">
                            Solo interno (Invisible para supervisores)
                          </label>
                        </div>
                      ) : <span />}
                      <button
                        type="submit"
                        className="btn btn-primary btn-sm"
                        disabled={commentSaving}
                        style={{ borderRadius: 8, fontWeight: 600, fontSize: 13, padding: '7px 18px' }}
                      >
                        <i className="feather-send me-1" />
                        {commentSaving ? 'Enviando...' : 'Comentar'}
                      </button>
                    </div>
                  </form>
                  )}
                </>
                )}

                {activeTab === 'auditoria' && (
                  <>
                    {auditorias.length === 0 && (
                      <div className="text-center py-4" style={{ color: '#94a3b8' }}>
                        <i className="feather-clock d-block mb-2" style={{ fontSize: 28 }} />
                        <span style={{ fontSize: 13 }}>No hay historial de cambios.</span>
                      </div>
                    )}
                    
                    <div className="timeline-container" style={{ position: 'relative', paddingLeft: 20 }}>
                      <div style={{ position: 'absolute', left: 26, top: 10, bottom: 10, width: 2, background: '#e2e8f0' }} />
                      
                      {auditorias.map(a => (
                        <div key={a.id} className="d-flex mb-3 position-relative">
                          <div style={{
                            width: 14, height: 14, borderRadius: '50%', background: '#4f46e5',
                            position: 'absolute', left: 0, top: 4, border: '2px solid #fff'
                          }} />
                          <div className="ms-4">
                            <div style={{ fontSize: 13, color: '#334155' }}>
                              <strong>{a.usuario_nombre}</strong> cambió <strong>{a.campo_modificado}</strong>
                            </div>
                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                              <span className="text-decoration-line-through me-2">{a.valor_anterior}</span>
                              <i className="feather-arrow-right mx-1" />
                              <span style={{ color: '#10b981', fontWeight: 600 }}>{a.valor_nuevo}</span>
                            </div>
                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                              {fmtDatetime(a.fecha_modificacion)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

              </div>
            </div>
          </div>

          {/* ── Panel Admin TI ── */}
          {isAdmin && !estaCerrado && (
            <div className="col-lg-4">
              <div className="card border-0 shadow-sm border-primary-subtle bg-primary-subtle" style={{ borderRadius: 14 }}>
                <div className="card-header bg-transparent border-0 pb-0">
                  <h5 className="card-title text-primary mb-0">
                    <i className="feather-settings me-2" />Gestión Admin TI
                  </h5>
                </div>
                <div className="card-body p-4">
                  <form onSubmit={handleGuardarAdmin}>
                    {adminError && <ErrorAlert error={adminError} />}
                    {adminSuccess && (
                      <div className="alert alert-success d-flex align-items-center gap-2 py-2 mb-3"
                        style={{ borderRadius: 8, fontSize: 12 }}>
                        <i className="feather-check-circle" />
                        Cambios guardados correctamente
                      </div>
                    )}

                    {/* Estado */}
                    <div className="mb-4">
                      <label className="form-label fw-semibold text-dark">Estado</label>
                      <select
                        className="form-select"
                        value={editEstado}
                        onChange={e => setEditEstado(e.target.value)}
                      >
                        <option value="abierto">Abierto</option>
                        <option value="en_proceso">En Proceso</option>
                        <option value="resuelto">Resuelto</option>
                        <option value="cerrado">Cerrado</option>
                      </select>
                    </div>

                    {/* Asignado A */}
                    <div className="mb-4">
                      <label className="form-label fw-semibold text-dark">Asignado A</label>
                      <select
                        className="form-select"
                        value={editAsignado}
                        onChange={e => setEditAsignado(e.target.value === '' ? '' : Number(e.target.value))}
                      >
                        <option value="">— Sin asignar —</option>
                        {admins.map(u => (
                          <option key={u.id} value={u.id}>
                            {u.nombre} (Admin TI)
                          </option>
                        ))}
                      </select>
                    </div>

                    <button type="submit" className="btn btn-primary w-100" disabled={adminSaving}>
                      <i className="feather-save me-2" />
                      {adminSaving ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
