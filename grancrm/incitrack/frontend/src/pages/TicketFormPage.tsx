import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getLookupCategorias, getLookupCuentas, getLookupSLA, getTicket, createTicket, editTicket } from '../lib/api';
import { useFormSubmit } from '../hooks/useFormSubmit';
import type { CategoriaLookupItem, CuentaLookupItem, SubcategoriaItem, SLALookupOut, TicketOut } from '../apiTypes';
import { Loading } from '../components/Loading';
import { ErrorAlert } from '../components/ErrorAlert';
import { PageHeader } from '../components/duralux/PageHeader';

type Mode = 'nuevo' | 'editar';

interface Props {
  mode: Mode;
}

export function TicketFormPage({ mode }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const ticketId = id ? Number(id) : null;

  // Lookup data
  const [categorias, setCategorias] = useState<CategoriaLookupItem[]>([]);
  const [cuentas, setCuentas] = useState<CuentaLookupItem[]>([]);
  const [subcategorias, setSubcategorias] = useState<SubcategoriaItem[]>([]);
  const [sla, setSla] = useState<SLALookupOut | null>(null);
  const [requiereBi, setRequiereBi] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);

  // Existing ticket (edit mode)
  const [existingTicket, setExistingTicket] = useState<TicketOut | null>(null);

  // Form state
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');

  const [cuentaId, setCuentaId] = useState<string>('');
  const [categoriaId, setCategoriaId] = useState<string>('');
  const [subcategoriaId, setSubcategoriaId] = useState<string>('');
  const [tipoTelefonia, setTipoTelefonia] = useState<'plataforma' | 'soporte' | ''>('');
  const [plataformaBi, setPlataformaBi] = useState<string>('');
  const [estado, setEstado] = useState<string>('');
  const [asignadoAId, setAsignadoAId] = useState<string>('');



  const fileInputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const file = new File([blob], `Captura_${new Date().getTime()}.png`, { type: blob.type });
          for (let j = 0; j < 3; j++) {
            const input = fileInputRefs[j].current;
            if (input && (!input.files || input.files.length === 0)) {
              const dt = new DataTransfer();
              dt.items.add(file);
              input.files = dt.files;
              break;
            }
          }
        }
      }
    }
  };

  // Load lookups
  useEffect(() => {
    setLoadingMeta(true);
    Promise.all([
      getLookupCategorias(),
      getLookupCuentas(),
    ])
      .then(([cats, ctas]) => {
        setCategorias(cats);
        setCuentas(ctas);
        setLoadingMeta(false);
      })
      .catch(e => { setMetaError(String(e.message ?? e)); setLoadingMeta(false); });
  }, []);

  // Load existing ticket for edit mode
  useEffect(() => {
    if (mode !== 'editar' || !ticketId) return;
    getTicket(ticketId)
      .then(t => {
        setExistingTicket(t);
        setTitulo(t.titulo);
        setDescripcion(t.descripcion);

        setEstado(t.estado);
        if (t.cuenta_id) setCuentaId(String(t.cuenta_id));
        if (t.categoria_id) setCategoriaId(String(t.categoria_id));
        if (t.subcategoria_id) setSubcategoriaId(String(t.subcategoria_id));
        if (t.plataforma_bi) setPlataformaBi(t.plataforma_bi);
        if (t.asignado_a_id) setAsignadoAId(String(t.asignado_a_id));
      })
      .catch(e => setMetaError(String(e.message ?? e)));
  }, [mode, ticketId]);

  // When categoria changes, update subcategorias and SLA
  useEffect(() => {
    if (!categoriaId) {
      setSubcategorias([]);
      setRequiereBi(false);
      setSla(null);
      return;
    }
    const cat = categorias.find(c => String(c.id) === categoriaId);
    if (cat) {
      setSubcategorias(cat.subcategorias);
      setRequiereBi(cat.requiere_bi);
    }
    setSubcategoriaId('');
    setTipoTelefonia('');
    setSla(null);
    getLookupSLA(Number(categoriaId)).then(s => setSla(s)).catch(() => {});
  }, [categoriaId, categorias]);

  // When subcategoria changes, update SLA
  useEffect(() => {
    if (!categoriaId) return;
    getLookupSLA(Number(categoriaId), subcategoriaId ? Number(subcategoriaId) : undefined)
      .then(s => setSla(s))
      .catch(() => {});
  }, [subcategoriaId, categoriaId]);

  const { saving, saveError, handleSubmit } = useFormSubmit(
    async () => {
      let result: TicketOut;
      if (mode === 'nuevo') {
        result = await createTicket({
          titulo,
          descripcion,
          cuenta_id: Number(cuentaId),
          categoria_id: categoriaId ? Number(categoriaId) : null,
          subcategoria_id: subcategoriaId ? Number(subcategoriaId) : null,
          plataforma_bi: plataformaBi || null,
        });
        navigate(`../${result.id}`, { relative: 'path' });
      } else {
        if (!ticketId) return;
        result = await editTicket(ticketId, {
          titulo,
          descripcion,
          estado: estado as 'abierto' | 'en_proceso' | 'resuelto' | 'cerrado',
          categoria_id: categoriaId ? Number(categoriaId) : null,
          subcategoria_id: subcategoriaId ? Number(subcategoriaId) : null,
          plataforma_bi: plataformaBi || null,
          asignado_a_id: asignadoAId ? Number(asignadoAId) : null,
        });
        navigate(`../..`, { relative: 'path' });
      }
    }
  );

  const isTelefonia = categorias.find(c => String(c.id) === categoriaId)?.nombre.toLowerCase().includes('telefon');

  const filteredSubcategorias = subcategorias.filter(s => {
    if (!isTelefonia || !tipoTelefonia) return true;
    const normalizedName = s.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const isPlataforma = [
      'gestion de ivr y grabaciones', 
      'programacion de feriados', 
      'configuracion de colas de servicio', 
      'ajuste de horarios inbound'
    ].includes(normalizedName);
    return tipoTelefonia === 'plataforma' ? isPlataforma : !isPlataforma;
  });

  if (loadingMeta) return <Loading />;

  return (
    <>
      <PageHeader
        title={mode === 'nuevo' ? 'Nuevo Ticket' : 'Editar Ticket'}
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Tickets', href: mode === 'nuevo' ? '..' : '../..' },
          ...(mode === 'editar' && ticketId ? [{ label: `#${ticketId}`, href: '..' }] : []),
          { label: mode === 'nuevo' ? 'Nuevo' : 'Editar' }
        ]}
      >
        <Link to={mode === 'nuevo' ? '..' : '../..'} relative="path" className="btn btn-light-brand btn-sm">
          <i className="feather-arrow-left me-2" />
          <span>Volver a Tickets</span>
        </Link>
      </PageHeader>

      <div className="main-content">
        <div className="row g-4">
          <div className="col-xxl-8 col-lg-7">
            {metaError && <ErrorAlert error={metaError} />}
            {saveError && <ErrorAlert error={saveError} />}

            <form onSubmit={handleSubmit} id="form-ticket">
              <div className="card stretch stretch-full">
                <div className="card-header">
                  <h5 className="card-title mb-0"><i className="feather-tag me-2" />Identificación</h5>
                </div>
                <div className="card-body p-4">
                  {mode === 'nuevo' && (
                    <div className="mb-4">
                      <label className="form-label fw-semibold">
                        Cuenta Afectada <span className="text-danger">*</span>
                      </label>
                      <select
                        className="form-select"
                        value={cuentaId}
                        onChange={e => setCuentaId(e.target.value)}
                        required
                      >
                        <option value="">-- Selecciona una cuenta --</option>
                        {cuentas.map(c => (
                          <option key={c.id} value={String(c.id)}>{c.nombre}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="row g-4">
                    <div className="col-md-6">
                      <label className="form-label fw-semibold text-dark">Categoría <span className="text-danger">*</span></label>
                      <select
                        className="form-select"
                        value={categoriaId}
                        onChange={e => setCategoriaId(e.target.value)}
                        required
                      >
                        <option value="">-- Selecciona una categoría --</option>
                        {categorias.map(c => (
                          <option key={c.id} value={String(c.id)}>{c.nombre}</option>
                        ))}
                      </select>
                    </div>
                    {!isTelefonia && !requiereBi && (
                      <div className="col-md-6">
                        <label className="form-label fw-semibold text-dark">Subcategoría <span className="text-danger">*</span></label>
                        <select
                          className="form-select"
                          value={subcategoriaId}
                          onChange={e => setSubcategoriaId(e.target.value)}
                          required={mode === 'nuevo'}
                          disabled={subcategorias.length === 0}
                        >
                          <option value="">-- Selecciona una subcategoría --</option>
                          {filteredSubcategorias.map(s => (
                            <option key={s.id} value={String(s.id)}>{s.nombre}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {isTelefonia && (
                    <div className="mt-4 p-4 bg-light rounded">
                      <label className="form-label fw-semibold">Selecciona el Área de Telefonía <span className="text-danger">*</span></label>
                      <div className="d-flex gap-3 mb-4 flex-wrap">
                        <label className={`btn flex-grow-1 ${tipoTelefonia === 'plataforma' ? 'btn-primary' : 'btn-white border'}`}>
                          <input type="radio" name="tipoTelefonia" value="plataforma" className="d-none" checked={tipoTelefonia === 'plataforma'} onChange={() => { setTipoTelefonia('plataforma'); setSubcategoriaId(''); }} />
                          <i className="feather-server me-2"></i>Gestión de Plataforma
                        </label>
                        <label className={`btn flex-grow-1 ${tipoTelefonia === 'soporte' ? 'btn-primary' : 'btn-white border'}`}>
                          <input type="radio" name="tipoTelefonia" value="soporte" className="d-none" checked={tipoTelefonia === 'soporte'} onChange={() => { setTipoTelefonia('soporte'); setSubcategoriaId(''); }} />
                          <i className="feather-headphones me-2"></i>Soporte
                        </label>
                      </div>

                      <div className="mt-3">
                        <label className="form-label fw-semibold">Subcategoría <span className="text-danger">*</span></label>
                        <select
                          className="form-select"
                          value={subcategoriaId}
                          onChange={e => setSubcategoriaId(e.target.value)}
                          required={mode === 'nuevo'}
                          disabled={!tipoTelefonia}
                        >
                          <option value="">-- Selecciona una subcategoría --</option>
                          {filteredSubcategorias.map(s => (
                            <option key={s.id} value={String(s.id)}>{s.nombre}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {requiereBi && (
                    <div className="mt-4 p-4 bg-light rounded">
                      <label className="form-label fw-semibold">Selecciona la Plataforma BI <span className="text-danger">*</span></label>
                      <div className="d-flex gap-3 mb-4 flex-wrap">
                        <label className={`btn flex-grow-1 ${plataformaBi === 'PowerBI' ? 'btn-primary' : 'btn-white border'}`}>
                          <input type="radio" name="plataforma_bi" value="PowerBI" className="d-none" checked={plataformaBi === 'PowerBI'} onChange={() => { setPlataformaBi('PowerBI'); setSubcategoriaId(''); }} />
                          <i className="feather-bar-chart-2 me-2"></i>PowerBI
                        </label>
                        <label className={`btn flex-grow-1 ${plataformaBi === 'QlikView' ? 'btn-primary' : 'btn-white border'}`}>
                          <input type="radio" name="plataforma_bi" value="QlikView" className="d-none" checked={plataformaBi === 'QlikView'} onChange={() => { setPlataformaBi('QlikView'); setSubcategoriaId(''); }} />
                          <i className="feather-pie-chart me-2"></i>QlikView
                        </label>
                      </div>

                      <div className="mt-3">
                        <label className="form-label fw-semibold">Subcategoría <span className="text-danger">*</span></label>
                        <select
                          className="form-select"
                          value={subcategoriaId}
                          onChange={e => setSubcategoriaId(e.target.value)}
                          required={mode === 'nuevo'}
                          disabled={!plataformaBi}
                        >
                          <option value="">-- Selecciona una subcategoría --</option>
                          {subcategorias.map(s => (
                            <option key={s.id} value={String(s.id)}>{s.nombre}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="card stretch stretch-full">
                <div className="card-header">
                  <h5 className="card-title mb-0"><i className="feather-file-text me-2" />Detalle de la Incidencia</h5>
                </div>
                <div className="card-body p-4">
                  <div className="mb-4">
                    <label className="form-label fw-semibold">
                      Título breve del problema <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={titulo}
                      onChange={e => setTitulo(e.target.value)}
                      required
                      maxLength={255}
                      placeholder="Resumen corto del problema..."
                    />
                  </div>
                  <div className="mb-4">
                    <label className="form-label fw-semibold">
                      Descripción detallada <span className="text-danger">*</span>
                    </label>
                    <textarea
                      className="form-control"
                      rows={5}
                      value={descripcion}
                      onChange={e => setDescripcion(e.target.value)}
                      onPaste={handlePaste}
                      required
                      placeholder="Describe el problema con el mayor detalle posible... ¿Qué ocurre? ¿Desde cuándo? ¿A cuántos afecta?"
                    />
                  </div>

                  {mode === 'editar' && (
                    <div className="row g-4 mt-1">
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Estado</label>
                        <select
                          className="form-select"
                          value={estado}
                          onChange={e => setEstado(e.target.value)}
                        >
                          <option value="abierto">Abierto</option>
                          <option value="en_proceso">En Proceso</option>
                          <option value="resuelto">Resuelto</option>
                          <option value="cerrado">Cerrado</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="card stretch stretch-full">
                <div className="card-header">
                  <h5 className="card-title mb-0"><i className="feather-folder me-2" />Clasificación</h5>
                </div>
                <div className="card-body p-4">
                  <div className="row g-4">
                    {[1, 2, 3].map((num, idx) => (
                      <div className="col-md-4" key={num}>
                        <label className="form-label text-muted text-uppercase" style={{ fontSize: 11 }}>Archivo {num}</label>
                        <input 
                          type="file" 
                          ref={fileInputRefs[idx]}
                          className="form-control"
                          accept="image/*,.pdf,.doc,.docx"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="d-flex gap-3 mb-4">
                <button type="submit" className="btn btn-primary px-4" disabled={saving}>
                  {saving ? 'Guardando...' : (mode === 'nuevo' ? 'Crear Ticket' : 'Guardar Cambios')}
                </button>
                <Link to={mode === 'nuevo' ? '..' : '../..'} relative="path" className="btn btn-light">
                  Cancelar
                </Link>
              </div>
            </form>
          </div>

          <div className="col-xxl-4 col-lg-5">
            <div className="card stretch stretch-full border border-primary-subtle bg-primary-subtle">
              <div className="card-header bg-transparent border-0 pb-0">
                <h5 className="card-title text-primary mb-0"><i className="feather-settings me-2" />Gestión Admin TI</h5>
              </div>
              <div className="card-body p-4">
                <p className="text-dark mb-3 fw-semibold">Incluye estos puntos para agilizar la resolución:</p>
                <ul className="text-dark ps-3 mb-4" style={{ fontSize: 13, lineHeight: 1.6 }}>
                  <li className="mb-2">¿Cuántos usuarios están afectados?</li>
                  <li className="mb-2">¿Desde cuándo ocurre el problema?</li>
                  <li className="mb-2">Pasos para reproducirlo</li>
                  <li>Adjunta capturas o logs si los tienes</li>
                </ul>

                {/* SLA hint */}
                {sla?.tiene_sla && (
                  <div className="mt-4 pt-3 border-top border-primary-subtle">
                    <p className="fw-bold text-primary text-uppercase mb-2" style={{ fontSize: 12, letterSpacing: '0.5px' }}>
                      <i className="feather-clock me-1" /> SLA Aplicable
                    </p>
                    <div className="d-flex flex-column gap-2">
                      {sla.respuesta && (
                        <div className="d-flex justify-content-between align-items-center bg-white p-2 rounded shadow-sm" style={{ fontSize: 12 }}>
                          <span className="text-muted fw-semibold">⏱ Respuesta máx:</span>
                          <span className="fw-bold text-dark">{sla.respuesta}</span>
                        </div>
                      )}
                      {sla.cierre && (
                        <div className="d-flex justify-content-between align-items-center bg-white p-2 rounded shadow-sm" style={{ fontSize: 12 }}>
                          <span className="text-muted fw-semibold">🔒 Cierre máx:</span>
                          <span className="fw-bold text-dark">{sla.cierre}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
