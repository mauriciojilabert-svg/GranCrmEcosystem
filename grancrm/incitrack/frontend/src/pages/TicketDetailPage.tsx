import { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getTicket, cerrarTicket, agregarComentario, editTicket, getUsuarios, uploadComentarioAdjunto } from '../lib/api';
import type { TicketOut, ComentarioOut, UsuarioOut } from '../apiTypes';
import { Loading } from '../components/Loading';
import { ErrorAlert } from '../components/ErrorAlert';
import { useSession } from '../context';
import { PageHeader } from '../components/duralux/PageHeader';
import { Card, StatusBadge } from '@duralux/ui';

function fmtDatetime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

const ESTADO_VARIANT: Record<string, "danger" | "warning" | "success" | "secondary"> = {
  abierto: 'danger', en_proceso: 'warning', resuelto: 'success', cerrado: 'secondary',
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentFile, setCommentFile] = useState<File | null>(null);
  const [commentPreviewUrl, setCommentPreviewUrl] = useState<string>('');
  const commentFileInputRef = React.useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const file = new File([blob], `Captura_${new Date().getTime()}.png`, { type: blob.type });
            setCommentFile(file);
            if (commentFileInputRef.current) {
              const dt = new DataTransfer();
              dt.items.add(file);
              commentFileInputRef.current.files = dt.files;
            }
            const url = URL.createObjectURL(file);
            setCommentPreviewUrl(prev => {
              if (prev) URL.revokeObjectURL(prev);
              return url;
            });
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, []);

  useEffect(() => {
    return () => {
      if (commentPreviewUrl) URL.revokeObjectURL(commentPreviewUrl);
    };
  }, [commentPreviewUrl]);

  const handleCommentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCommentFile(file);
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        setCommentPreviewUrl(prev => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } else {
        setCommentPreviewUrl(prev => {
          if (prev) URL.revokeObjectURL(prev);
          return '';
        });
      }
    } else {
      setCommentFile(null);
      setCommentPreviewUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return '';
      });
    }
  };

  async function handleComentario(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim() && !commentFile) return;
    setCommentSaving(true);
    setCommentError(null);
    try {
      const com = await agregarComentario(ticketId, { contenido: commentText || 'Adjunto', interno });
      if (commentFile) {
        await uploadComentarioAdjunto(ticketId, com.id, commentFile);
      }
      const updated = await getTicket(ticketId);
      setTicket(updated);
      setComentarios(updated.comentarios ?? []);
      setCommentText('');
      setCommentFile(null);
      setCommentPreviewUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return '';
      });
      if (commentFileInputRef.current) {
        commentFileInputRef.current.value = '';
      }
      setInterno(false);
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
  const estadoVariant = ESTADO_VARIANT[ticket.estado] ?? 'danger';

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
        }
        .comentario-item {
          border-radius: 10px;
          padding: 14px 16px;
          margin-bottom: 12px;
          border: 1px solid var(--gcu-border, #e9ecef);
          transition: box-shadow 0.2s;
        }
        .comentario-item:hover {
          box-shadow: 0 2px 8px rgba(0,0,0,.06);
        }
        .avatar-circle {
          width: 32px; height: 32px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 800; color: #fff; flex-shrink: 0;
        }
      `}</style>

      {/* Page Header */}
      <PageHeader
        title={
          <span className="d-flex align-items-center gap-2 flex-wrap">
            Ticket <span className="text-primary">#{ticket.id}</span>
            {/* Estado badge */}
            <span className="ms-2">
              <StatusBadge status={estadoVariant} label={ESTADO_LABEL[ticket.estado] ?? ticket.estado} soft />
            </span>
          </span>
        }
        breadcrumbs={[
          { label: 'Dashboard', href: '/incitrack/' },
          { label: 'Tickets', href: '..' },
          { label: `#${ticket.id}` }
        ]}
      >
        {!estaCerrado && (
          <button
            type="button"
            className="btn btn-success btn-sm fw-bold"
            onClick={handleCerrar}
            disabled={closing}
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
            <Card className="mb-4">
              <div className="card-header">
                <h5 className="card-title mb-0">
                  <i className="feather-file-text me-2" />
                  {ticket.titulo}
                </h5>
              </div>
              <div className="card-body p-4">

                {/* Meta chips */}
                <div className="d-flex flex-wrap gap-2 mb-4">
                  <span className="meta-chip bg-light text-muted">
                    <i className="feather-user" style={{ fontSize: 11 }} />{ticket.creado_por_nombre}
                  </span>
                  <span className="meta-chip bg-light text-muted">
                    <i className="feather-calendar" style={{ fontSize: 11 }} />
                    {fmtDatetime(ticket.fecha_creacion)}
                  </span>
                  <span className="meta-chip bg-light text-muted">
                    <i className="feather-refresh-cw" style={{ fontSize: 11 }} />
                    Actualizado: {fmtDatetime(ticket.fecha_actualizacion)}
                  </span>
                  {ticket.cuenta_nombre && (
                    <span className="meta-chip bg-soft-primary text-primary">
                      <i className="feather-briefcase" style={{ fontSize: 11 }} />{ticket.cuenta_nombre}
                    </span>
                  )}
                  {ticket.asignado_a_nombre && (
                    <span className="meta-chip bg-soft-warning text-warning">
                      <i className="feather-zap" style={{ fontSize: 11 }} />
                      Asignado: {ticket.asignado_a_nombre}
                    </span>
                  )}
                  {ticket.fue_reasignado && (
                    <span className="meta-chip bg-soft-warning text-warning">
                      <i className="feather-shuffle" style={{ fontSize: 11 }} />Reasignado
                    </span>
                  )}
                  {ticket.fecha_resolucion && (
                    <span className="meta-chip bg-soft-success text-success">
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

                {/* Adjuntos del Ticket */}
                {ticket.adjuntos && ticket.adjuntos.length > 0 && (
                  <div className="mt-4 pt-4 border-top">
                    <h6 className="fw-semibold mb-3" style={{ fontSize: 13 }}><i className="feather-paperclip me-2" />Archivos Adjuntos</h6>
                    <div className="d-flex flex-wrap gap-3">
                      {ticket.adjuntos.map(adj => {
                        const isVideo = adj.nombre_original.toLowerCase().endsWith('.mp4');
                        const isImg = adj.nombre_original.toLowerCase().match(/\.(jpeg|jpg|gif|png|webp)$/) != null;
                        return (
                          <div key={adj.id} className="p-2 border rounded bg-light" style={{ maxWidth: '100%', overflow: 'hidden' }}>
                            <div className="d-flex align-items-center mb-2 gap-2" style={{ fontSize: 12 }}>
                              <i className={isVideo ? "feather-video text-primary" : (isImg ? "feather-image text-success" : "feather-file text-secondary")} />
                              <a href={adj.url} target="_blank" rel="noreferrer" className="text-dark fw-medium text-truncate" title={adj.nombre_original}>
                                {adj.nombre_original}
                              </a>
                            </div>
                            {isImg && (
                              <a href={adj.url} target="_blank" rel="noreferrer">
                                <img src={adj.url} alt={adj.nombre_original} style={{ maxHeight: 200, maxWidth: '100%', objectFit: 'contain', borderRadius: 4 }} />
                              </a>
                            )}
                            {isVideo && (
                              <video src={adj.url} controls style={{ maxHeight: 300, maxWidth: '100%', borderRadius: 4 }} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Comentarios */}
            <Card className="mt-4">
              <div className="card-header">
                <h5 className="card-title mb-0">
                  <i className="feather-message-square me-2" />
                  Comentarios ({comentarios.length})
                </h5>
              </div>
              <div className="card-body p-4">
                {comentarios.length === 0 && (
                  <div className="text-center py-4" style={{ color: '#94a3b8' }}>
                    <i className="feather-message-circle d-block mb-2" style={{ fontSize: 28 }} />
                    <span style={{ fontSize: 13 }}>Aún no hay comentarios.</span>
                  </div>
                )}

                {comentarios.map(com => (
                  <div key={com.id} className={`comentario-item ${com.interno ? 'bg-soft-warning border-warning border-opacity-25' : 'bg-light'}`}>
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <div className="avatar-circle bg-primary">
                        {(com.autor_nombre ?? '?').slice(0, 1).toUpperCase()}
                      </div>
                      <strong style={{ fontSize: 13 }}>{com.autor_nombre}</strong>
                      {com.interno && (
                        <span className="badge bg-soft-warning text-warning border border-warning border-opacity-25 rounded-pill px-2">
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
                      {/* Adjuntos del comentario */}
                      {com.adjuntos && com.adjuntos.length > 0 && (
                        <div className="mt-3">
                          {com.adjuntos.map(adj => (
                            <div key={adj.id} className="mt-2">
                              <a href={adj.url} target="_blank" rel="noreferrer">
                                <img src={adj.url} alt={adj.nombre_original} style={{ maxHeight: 150, maxWidth: '100%', objectFit: 'contain', borderRadius: 6, border: '1px solid #e2e8f0' }} />
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
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
                      placeholder="Escribe un comentario o pega una imagen (Ctrl+V)..."
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                    />
                    <div className="mb-3">
                      <input 
                        type="file" 
                        ref={commentFileInputRef}
                        className="form-control form-control-sm" 
                        accept="image/*"
                        onChange={handleCommentFileChange}
                      />
                      {commentPreviewUrl && (
                        <div className="mt-2 mb-2 text-center">
                          <img 
                            src={commentPreviewUrl} 
                            alt="Preview" 
                            style={{ maxHeight: '120px', maxWidth: '100%', objectFit: 'contain', borderRadius: '4px', border: '1px solid #e2e8f0' }} 
                          />
                        </div>
                      )}
                      {commentFile && <small className="text-success mt-1 d-block"><i className="feather-check-circle me-1"/>{commentFile.name} adjunto</small>}
                    </div>
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
                        className="btn btn-primary btn-sm fw-bold px-3 py-2"
                        disabled={commentSaving}
                      >
                        <i className="feather-send me-1" />
                        {commentSaving ? 'Enviando...' : 'Comentar'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </Card>
          </div>

          {/* ── Panel Admin TI ── */}
          {isAdmin && !estaCerrado && (
            <div className="col-lg-4">
              <Card className="bg-soft-primary border-0 shadow-none">
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
              </Card>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
