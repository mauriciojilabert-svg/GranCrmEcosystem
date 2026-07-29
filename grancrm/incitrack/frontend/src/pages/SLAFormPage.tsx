import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  getSLAs, createSLA, updateSLA, deleteSLA,
  getLookupCategorias,
} from '../lib/api';
import { useFormSubmit } from '../hooks/useFormSubmit';
import type { CategoriaLookupItem, SubcategoriaItem } from '../apiTypes';
import { Loading } from '../components/Loading';
import { ErrorAlert } from '../components/ErrorAlert';
import { PageHeader } from '../components/duralux/PageHeader';

type Mode = 'nuevo' | 'editar';

interface Props {
  mode: Mode;
}

const PLATAFORMAS_BI = [
  { value: 'PowerBI', label: 'Power BI' },
  { value: 'QlikView', label: 'QlikView' },
];

export function SLAFormPage({ mode }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const slaId = id ? Number(id) : null;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Lookup data
  const [categorias, setCategorias] = useState<CategoriaLookupItem[]>([]);
  const [subcategorias, setSubcategorias] = useState<SubcategoriaItem[]>([]);
  const [requiereBi, setRequiereBi] = useState(false);

  // Form state
  const [categoriaId, setCategoriaId] = useState<string>('');
  const [subcategoriaId, setSubcategoriaId] = useState<string>('');
  const [plataformaBi, setPlataformaBi] = useState<string>('');
  const [tiempoRespuestaMinutos, setTiempoRespuestaMinutos] = useState<string>('60');
  const [cierreHoras, setCierreHoras] = useState<string>('4');
  const [cierreMinutos, setCierreMinutos] = useState<string>('0');
  const [descripcion, setDescripcion] = useState('');
  const [activo, setActivo] = useState(true);

  useEffect(() => {
    const promises: Promise<unknown>[] = [getLookupCategorias()];
    if (mode === 'editar' && slaId) {
      promises.push(getSLAs());
    }
    Promise.all(promises)
      .then(results => {
        const cats = results[0] as CategoriaLookupItem[];
        setCategorias(cats);

        if (mode === 'editar' && slaId) {
          const lista = results[1] as import('../apiTypes').SLAOut[];
          const s = lista.find(x => x.id === slaId);
          if (!s) throw new Error('SLA no encontrado');

          setCategoriaId(String(s.categoria_id));
          setSubcategoriaId(s.subcategoria_id ? String(s.subcategoria_id) : '');
          setPlataformaBi(s.plataforma_bi ?? '');
          setTiempoRespuestaMinutos(String(s.tiempo_respuesta_minutos));
          setCierreHoras(String(Math.floor(s.tiempo_cierre_minutos / 60)));
          setCierreMinutos(String(s.tiempo_cierre_minutos % 60));
          setDescripcion(s.descripcion);
          setActivo(s.activo);

          const cat = cats.find(c => c.id === s.categoria_id);
          if (cat) {
            setSubcategorias(cat.subcategorias);
            setRequiereBi(cat.requiere_bi);
          }
        }
        setLoading(false);
      })
      .catch(e => {
        setLoadError(String(e.message ?? e));
        setLoading(false);
      });
  }, [mode, slaId]);

  function handleCategoriaChange(catId: string) {
    setCategoriaId(catId);
    setSubcategoriaId('');
    setPlataformaBi('');
    if (!catId) {
      setSubcategorias([]);
      setRequiereBi(false);
      return;
    }
    const cat = categorias.find(c => String(c.id) === catId);
    setSubcategorias(cat ? cat.subcategorias : []);
    setRequiereBi(cat?.requiere_bi ?? false);
  }

  const { saving, saveError, handleSubmit, setSaveError } = useFormSubmit(
    async () => {
      const cierreTotal = (parseInt(cierreHoras) || 0) * 60 + (parseInt(cierreMinutos) || 0);
      const data = {
        categoria_id: Number(categoriaId),
        subcategoria_id: subcategoriaId ? Number(subcategoriaId) : null,
        plataforma_bi: plataformaBi || null,
        tiempo_respuesta_minutos: parseInt(tiempoRespuestaMinutos) || 0,
        tiempo_cierre_minutos: cierreTotal,
        descripcion,
        activo,
      };
      if (mode === 'nuevo') {
        await createSLA(data);
      } else {
        if (!slaId) return;
        await updateSLA(slaId, data);
      }
    },
    () => navigate('..', { relative: 'path' })
  );

  async function handleDelete() {
    if (!slaId) return;
    setDeleting(true);
    try {
      await deleteSLA(slaId);
      navigate('..', { relative: 'path' });
    } catch (err) {
      setSaveError(String((err as Error).message ?? err));
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <>
      <PageHeader
        title={mode === 'nuevo' ? 'Nuevo SLA' : 'Editar SLA'}
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'SLA', href: '..' },
          { label: mode === 'nuevo' ? 'Nuevo' : 'Editar' }
        ]}
      >
        <Link to=".." relative="path" className="btn btn-light-brand btn-sm">
          <i className="feather-arrow-left me-2" />
          <span>Volver a SLAs</span>
        </Link>
      </PageHeader>

      <div className="main-content">
        <div className="row g-4">
          <div className="col-xxl-8 col-lg-7">
            {loadError && <ErrorAlert error={loadError} />}
            {saveError && <ErrorAlert error={saveError} />}

            <div className="card stretch stretch-full">
              <div className="card-header">
                <h5 className="card-title">
                  {mode === 'nuevo' ? 'Detalles de configuración SLA' : 'Actualizar detalles SLA'}
                </h5>
              </div>
              <div className="card-body">
                <form onSubmit={handleSubmit}>
                  <div className="mb-4">
                    <label className="form-label fw-semibold">
                      Categoría <span className="text-danger">*</span>
                    </label>
                    <select
                      className="form-select"
                      value={categoriaId}
                      onChange={e => handleCategoriaChange(e.target.value)}
                      required
                    >
                      <option value="">-- Selecciona categoría --</option>
                      {categorias.map(c => (
                        <option key={c.id} value={String(c.id)}>{c.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-4">
                    <label className="form-label fw-semibold">Subcategoría</label>
                    <select
                      className="form-select"
                      value={subcategoriaId}
                      onChange={e => setSubcategoriaId(e.target.value)}
                      disabled={!categoriaId}
                    >
                      <option value="">-- Toda la categoría (SLA general) --</option>
                      {subcategorias.map(s => (
                        <option key={s.id} value={String(s.id)}>{s.nombre}</option>
                      ))}
                    </select>
                    <div className="form-text mt-1 text-muted">
                      Dejar vacío para aplicar el SLA a toda la categoría
                    </div>
                  </div>

                  {requiereBi && (
                    <div className="mb-4">
                      <label className="form-label fw-semibold">Plataforma BI</label>
                      <select
                        className="form-select"
                        value={plataformaBi}
                        onChange={e => setPlataformaBi(e.target.value)}
                      >
                        <option value="">-- Selecciona plataforma --</option>
                        {PLATAFORMAS_BI.map(p => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="row g-4 mb-4">
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">
                        Tiempo de respuesta (minutos) <span className="text-danger">*</span>
                      </label>
                      <div className="input-group">
                        <span className="input-group-text bg-light-subtle"><i className="feather-clock" /></span>
                        <input
                          type="number"
                          className="form-control"
                          min={0}
                          value={tiempoRespuestaMinutos}
                          onChange={e => setTiempoRespuestaMinutos(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-text mt-1 text-muted">Ej: 60 = 1 hora</div>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">
                        Tiempo de Cierre <span className="text-danger">*</span>
                      </label>
                      <div className="row g-2">
                        <div className="col-6">
                          <div className="input-group">
                            <input
                              type="number"
                              className="form-control"
                              min={0}
                              value={cierreHoras}
                              onChange={e => setCierreHoras(e.target.value)}
                              placeholder="0"
                            />
                            <span className="input-group-text bg-light-subtle" style={{ fontSize: 13 }}>Hrs</span>
                          </div>
                        </div>
                        <div className="col-6">
                          <div className="input-group">
                            <input
                              type="number"
                              className="form-control"
                              min={0}
                              max={59}
                              value={cierreMinutos}
                              onChange={e => setCierreMinutos(e.target.value)}
                              placeholder="0"
                            />
                            <span className="input-group-text bg-light-subtle" style={{ fontSize: 13 }}>Min</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="form-label fw-semibold">Descripción</label>
                    <textarea
                      className="form-control"
                      value={descripcion}
                      onChange={e => setDescripcion(e.target.value)}
                      placeholder="Notas opcionales sobre este SLA..."
                      rows={3}
                    />
                  </div>

                  <div className="mb-4 form-check form-switch custom-switch">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="activo"
                      checked={activo}
                      onChange={e => setActivo(e.target.checked)}
                    />
                    <label className="form-check-label fw-semibold text-dark" htmlFor="activo">
                      SLA activo (visible en formulario de nuevo ticket)
                    </label>
                  </div>

                  <hr className="my-4" />

                  <div className="d-flex gap-2">
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      <i className="feather-save me-2" />
                      <span>{saving ? 'Guardando...' : 'Guardar SLA'}</span>
                    </button>
                    <Link to=".." relative="path" className="btn btn-light-secondary">Cancelar</Link>
                  </div>
                </form>

                {mode === 'editar' && slaId && (
                  <div className="mt-4 pt-3 border-top d-flex justify-content-end">
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm"
                      disabled={deleting}
                      onClick={() => setConfirmDelete(true)}
                    >
                      <i className="feather-trash-2 me-1" />Eliminar SLA
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Reference sidebar */}
          <div className="col-xxl-4 col-lg-5">
            <div className="card stretch stretch-full border-primary-subtle bg-primary-subtle">
              <div className="card-header bg-transparent border-0 pb-0">
                <h6 className="card-title text-primary mb-0"><i className="feather-info me-2" />Guía de configuración</h6>
              </div>
              <div className="card-body">
                <ul className="text-dark mb-4 ps-3" style={{ fontSize: 13, lineHeight: '1.6' }}>
                  <li className="mb-2"><strong>SLA general:</strong> deja subcategoría vacía para toda la categoría</li>
                  <li className="mb-2"><strong>SLA específico:</strong> selecciona subcategoría para mayor precisión</li>
                  <li className="mb-2"><strong>Regla:</strong> subcategoría tiene precedencia sobre el general</li>
                  <li><strong>Plataformas BI:</strong> PowerBI o QlikView para diferenciar</li>
                </ul>
                <div className="bg-white rounded p-3 shadow-sm">
                  <p className="fw-semibold text-dark mb-3" style={{ fontSize: 13 }}>Tiempos sugeridos:</p>
                  <div className="d-flex justify-content-between mb-2 pb-2 border-bottom" style={{ fontSize: 13 }}>
                    <span className="text-muted">Crítico (caída total)</span>
                    <span className="fw-bold text-danger">15min / 45min</span>
                  </div>
                  <div className="d-flex justify-content-between mb-2 pb-2 border-bottom" style={{ fontSize: 13 }}>
                    <span className="text-muted">Alto (servicio degradado)</span>
                    <span className="fw-bold text-warning">30min / 1h</span>
                  </div>
                  <div className="d-flex justify-content-between mb-2 pb-2 border-bottom" style={{ fontSize: 13 }}>
                    <span className="text-muted">Medio (inconveniente)</span>
                    <span className="fw-bold text-primary">1h / 4h</span>
                  </div>
                  <div className="d-flex justify-content-between" style={{ fontSize: 13 }}>
                    <span className="text-muted">Bajo (consulta/mejora)</span>
                    <span className="fw-bold text-secondary">4h / 72h</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Delete confirm modal */}
        {confirmDelete && (
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
                      Eliminar SLA
                    </h5>
                  </div>
                  <button type="button" className="btn-close" onClick={() => setConfirmDelete(false)} />
                </div>
                <div className="modal-body" style={{ padding: '8px 24px 20px' }}>
                  <p className="text-muted mb-1">Se eliminará esta configuración SLA.</p>
                  <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 0, fontWeight: 600 }}>
                    Esta acción no se puede deshacer.
                  </p>
                </div>
                <div className="modal-footer border-0" style={{ padding: '0 24px 20px', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    style={{ borderRadius: 9, fontWeight: 600 }}
                    onClick={() => setConfirmDelete(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    style={{ borderRadius: 9, fontWeight: 600, boxShadow: '0 4px 12px rgba(239,68,68,0.3)' }}
                    disabled={deleting}
                    onClick={handleDelete}
                  >
                    <i className="feather-trash-2 me-1" />{deleting ? 'Eliminando...' : 'Sí, eliminar'}
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
