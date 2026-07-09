import { useState, useEffect, useCallback } from 'react';
import type { AvisoTIOut, AvisoTipo } from '../../apiTypes';
import { getAvisos, createAviso, deleteAviso } from '../../lib/api';

// ── Helpers ──────────────────────────────────────────────────────────────────

const TIPO_CONFIG: Record<AvisoTipo, { icon: string; color: string; label: string; bg: string }> = {
  info:        { icon: 'feather-info',         color: 'text-primary',   label: 'Informativo', bg: 'bg-primary-subtle'   },
  advertencia: { icon: 'feather-alert-triangle', color: 'text-warning', label: 'Advertencia', bg: 'bg-warning-subtle'   },
  critico:     { icon: 'feather-alert-octagon', color: 'text-danger',   label: 'Crítico',     bg: 'bg-danger-subtle'    },
  resolucion:  { icon: 'feather-check-circle',  color: 'text-success',  label: 'Resolución',  bg: 'bg-success-subtle'   },
};

// ── Modal para publicar aviso ─────────────────────────────────────────────────

function PublicarModal({
  show,
  onClose,
  onPublicar,
}: {
  show: boolean;
  onClose: () => void;
  onPublicar: (tipo: string, contenido: string) => Promise<void>;
}) {
  const [tipo, setTipo] = useState<AvisoTipo>('info');
  const [contenido, setContenido] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!show) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contenido.trim()) { setError('El contenido no puede estar vacío'); return; }
    setSaving(true);
    setError('');
    try {
      await onPublicar(tipo, contenido.trim());
      setContenido('');
      setTipo('info');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al publicar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 16 }}>
          <div className="modal-header border-0 pb-0">
            <h5 className="modal-title fw-bold">
              <i className="feather-megaphone me-2 text-primary"></i>
              Publicar Información Importante
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body pt-2">
              {error && (
                <div className="alert alert-danger py-2 fs-13">{error}</div>
              )}

              <div className="mb-3">
                <label className="form-label fw-semibold fs-13">Tipo de Información</label>
                <div className="d-flex gap-2 flex-wrap">
                  {(Object.entries(TIPO_CONFIG) as [AvisoTipo, typeof TIPO_CONFIG[AvisoTipo]][]).map(([key, cfg]) => (
                    <button
                      key={key}
                      type="button"
                      className={`btn btn-sm ${tipo === key ? cfg.bg + ' ' + cfg.color + ' fw-bold border' : 'btn-light'}`}
                      style={{ borderRadius: 8 }}
                      onClick={() => setTipo(key)}
                    >
                      <i className={`${cfg.icon} me-1`}></i>
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-1">
                <label className="form-label fw-semibold fs-13">Mensaje</label>
                <textarea
                  className="form-control"
                  rows={4}
                  maxLength={500}
                  placeholder="Describe la Información para el equipo..."
                  value={contenido}
                  onChange={e => setContenido(e.target.value)}
                  style={{ borderRadius: 10, resize: 'none' }}
                />
                <div className="text-end text-muted fs-11 mt-1">{contenido.length}/500</div>
              </div>

              <div className="alert alert-light border fs-12 py-2 mb-0">
                <i className="feather-clock me-1 text-muted"></i>
                Esta Información estará visible durante <strong>24 horas</strong> o hasta que la elimines.
              </div>
            </div>
            <div className="modal-footer border-0 pt-0">
              <button type="button" className="btn btn-light" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? (
                  <><span className="spinner-border spinner-border-sm me-2"></span>Publicando...</>
                ) : (
                  <><i className="feather-send me-2"></i>Publicar</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Panel principal ───────────────────────────────────────────────────────────

interface AvisosTIPanelProps {
  isAdmin: boolean;
}

export function AvisosTIPanel({ isAdmin }: AvisosTIPanelProps) {
  const [avisos, setAvisos] = useState<AvisoTIOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getAvisos();
      setAvisos(data);
    } catch {
      // silently fail — no mostrar error en el panel del dashboard
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Refresca cada 5 minutos
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  async function handleDelete(id: number) {
    try {
      await deleteAviso(id);
      setAvisos(prev => prev.filter(a => a.id !== id));
    } catch {
      // ignore
    }
  }

  async function handlePublicar(tipo: string, contenido: string) {
    const nuevo = await createAviso({ tipo, contenido });
    setAvisos(prev => [nuevo, ...prev]);
  }

  if (loading) return null;

  // Si no hay avisos y el usuario no es admin, no mostrar nada
  if (avisos.length === 0 && !isAdmin) return null;

  return (
    <>
      <style>{`
        .ticker-wrap {
          width: 100%;
          overflow: hidden;
          position: relative;
          background: #f8f9fa;
          border-radius: 8px;
          padding: 10px 0;
          display: flex;
          align-items: center;
          flex-grow: 1;
        }
        .ticker-content {
          display: inline-flex;
          gap: 2rem;
          white-space: nowrap;
          animation: ticker-marquee 25s linear infinite;
          padding-left: 100%;
        }
        .ticker-wrap:hover .ticker-content {
          animation-play-state: paused;
        }
        @keyframes ticker-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-100%); }
        }
        .ticker-item {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 6px 14px;
          border-radius: 6px;
          border: 1px solid var(--bs-border-color);
        }
      `}</style>

      <PublicarModal
        show={showModal}
        onClose={() => setShowModal(false)}
        onPublicar={handlePublicar}
      />

      <div className="card border-0 shadow-sm h-100" style={{ borderRadius: 12 }}>
        <div className="card-body p-3 d-flex flex-column">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <div className="d-flex align-items-center gap-2">
              <i className="feather-megaphone text-primary fs-5"></i>
              <h6 className="mb-0 fw-bold fs-14 text-dark">INFORMACIÓN IMPORTANTE</h6>
              {avisos.length > 0 && (
                <span className="badge bg-danger rounded-pill fs-10">{avisos.length}</span>
              )}
            </div>
            {isAdmin && (
              <button
                className="btn btn-primary btn-sm py-1 px-2"
                style={{ borderRadius: 6, fontSize: '11px' }}
                onClick={() => setShowModal(true)}
              >
                <i className="feather-plus me-1"></i>
                Publicar
              </button>
            )}
          </div>

          {avisos.length === 0 ? (
            <div className="text-center py-2 d-flex flex-column justify-content-center flex-grow-1">
              <p className="text-muted fs-12 mb-0">
                <i className="feather-check-circle text-success me-1"></i>
                Sin Información activa. El sistema opera con normalidad.
              </p>
            </div>
          ) : (
            <div className="ticker-wrap">
              <div className="ticker-content">
                {avisos.map(aviso => {
                  const cfg = TIPO_CONFIG[aviso.tipo];
                  return (
                    <div key={aviso.id} className={`ticker-item ${cfg.bg}`}>
                      <i className={`${cfg.icon} ${cfg.color} fs-6`}></i>
                      <span className="fw-semibold fs-13 text-dark">{aviso.contenido}</span>
                      <span className="text-muted fs-11 ms-2">
                        {new Date(aviso.fecha_creacion).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isAdmin && (
                        <button
                          className="btn btn-sm btn-link text-muted p-0 ms-2"
                          title="Eliminar"
                          onClick={() => handleDelete(aviso.id)}
                        >
                          <i className="feather-x fs-6"></i>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
