import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  getNotificaciones, createNotificacion, updateNotificacion,
  getUsuarios, getLookupCategorias,
} from '../lib/api';
import { useFormSubmit } from '../hooks/useFormSubmit';
import type { UsuarioOut, CategoriaLookupItem, SubcategoriaItem } from '../apiTypes';
import { Loading } from '../components/Loading';
import { ErrorAlert } from '../components/ErrorAlert';
import { PageHeader } from '../components/duralux/PageHeader';

type Mode = 'nuevo' | 'editar';

interface Props {
  mode: Mode;
}

export function NotificacionFormPage({ mode }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const notifId = id ? Number(id) : null;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Lookup data
  const [categorias, setCategorias] = useState<CategoriaLookupItem[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioOut[]>([]);
  const [subcategorias, setSubcategorias] = useState<SubcategoriaItem[]>([]);

  // Form state
  const [categoriaId, setCategoriaId] = useState<string>('');
  const [subcategoriaId, setSubcategoriaId] = useState<string>('');
  const [emailsCc, setEmailsCc] = useState('');
  const [activo, setActivo] = useState(true);
  const [usuarioIds, setUsuarioIds] = useState<number[]>([]);

  useEffect(() => {
    const promises: Promise<unknown>[] = [getLookupCategorias(), getUsuarios()];
    if (mode === 'editar' && notifId) {
      promises.push(getNotificaciones());
    }
    Promise.all(promises)
      .then(results => {
        const cats = results[0] as CategoriaLookupItem[];
        // Filter to only include users with 'admin' role
        const usrs = (results[1] as UsuarioOut[]).filter(u => u.rol === 'admin');
        setCategorias(cats);
        setUsuarios(usrs);

        if (mode === 'editar' && notifId) {
          const lista = results[2] as import('../apiTypes').NotificacionOut[];
          const n = lista.find(x => x.id === notifId);
          if (!n) throw new Error('Notificación no encontrada');
          setCategoriaId(n.categoria_id ? String(n.categoria_id) : '');
          setSubcategoriaId(n.subcategoria_id ? String(n.subcategoria_id) : '');
          setEmailsCc(n.emails_cc);
          setActivo(n.activo);
          setUsuarioIds(n.usuario_ids);
          // Populate subcategorias for the selected categoria
          if (n.categoria_id) {
            const cat = cats.find(c => c.id === n.categoria_id);
            if (cat) setSubcategorias(cat.subcategorias);
          }
        }
        setLoading(false);
      })
      .catch(e => {
        setLoadError(String(e.message ?? e));
        setLoading(false);
      });
  }, [mode, notifId]);

  // Update subcategorias when categoria changes
  function handleCategoriaChange(catId: string) {
    setCategoriaId(catId);
    setSubcategoriaId('');
    if (!catId) {
      setSubcategorias([]);
      return;
    }
    const cat = categorias.find(c => String(c.id) === catId);
    setSubcategorias(cat ? cat.subcategorias : []);
  }

  function toggleUsuario(uid: number) {
    setUsuarioIds(prev =>
      prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid]
    );
  }

  const { saving, saveError, handleSubmit } = useFormSubmit(
    async () => {
      const data = {
        categoria_id: categoriaId ? Number(categoriaId) : null,
        subcategoria_id: subcategoriaId ? Number(subcategoriaId) : null,
        emails_cc: emailsCc,
        activo,
        usuario_ids: usuarioIds,
      };
      if (mode === 'nuevo') {
        await createNotificacion(data);
      } else {
        if (!notifId) return;
        await updateNotificacion(notifId, data);
      }
    },
    () => navigate('..', { relative: 'path' })
  );

  if (loading) return <Loading />;

  return (
    <>
      <PageHeader
        title={mode === 'nuevo' ? 'Nueva Configuración' : 'Editar Configuración'}
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Notificaciones', href: '..' },
          { label: mode === 'nuevo' ? 'Nueva' : 'Editar' }
        ]}
      >
        <Link to=".." relative="path" className="btn btn-light-brand btn-sm">
          <i className="feather-arrow-left me-2" />
          <span>Volver a Notificaciones</span>
        </Link>
      </PageHeader>

      <div className="main-content">
        <div className="row">
          <div className="col-xxl-8 col-lg-10">
            {loadError && <ErrorAlert error={loadError} />}
            {saveError && <ErrorAlert error={saveError} />}

            <div className="card stretch stretch-full">
              <div className="card-header">
                <h5 className="card-title">
                  {mode === 'nuevo' ? 'Detalles de configuración de notificación' : 'Actualizar detalles de notificación'}
                </h5>
              </div>
              <div className="card-body">
                <form onSubmit={handleSubmit}>
                  <div className="row">
                    <div className="col-md-6 mb-4">
                      <label className="form-label fw-semibold">Categoría</label>
                      <select
                        className="form-select"
                        value={categoriaId}
                        onChange={e => handleCategoriaChange(e.target.value)}
                      >
                        <option value="">-- Todas las categorías --</option>
                        {categorias.map(c => (
                          <option key={c.id} value={String(c.id)}>{c.nombre}</option>
                        ))}
                      </select>
                      <div className="form-text mt-1 text-muted">
                        Dejar vacío para notificación global
                      </div>
                    </div>

                    <div className="col-md-6 mb-4">
                      <label className="form-label fw-semibold">Subcategoría</label>
                      <select
                        className="form-select"
                        value={subcategoriaId}
                        onChange={e => setSubcategoriaId(e.target.value)}
                        disabled={!categoriaId || subcategorias.length === 0}
                      >
                        <option value="">-- Todas las subcategorías --</option>
                        {subcategorias.map(s => (
                          <option key={s.id} value={String(s.id)}>{s.nombre}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="form-label fw-semibold">Emails CC</label>
                    <input
                      type="text"
                      className="form-control"
                      value={emailsCc}
                      onChange={e => setEmailsCc(e.target.value)}
                      placeholder="correo1@empresa.cl, correo2@empresa.cl"
                    />
                    <div className="form-text mt-1 text-muted">
                      Emails CC separados por coma
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="form-label fw-semibold">
                      Usuarios <span className="text-muted fw-normal" style={{ fontSize: 12 }}>(selecciona uno o más)</span>
                    </label>
                    <div className="border rounded p-3 d-flex flex-wrap gap-3 bg-light-subtle">
                      {usuarios.length === 0 ? (
                        <span className="text-muted" style={{ fontSize: 13 }}>
                          <i className="feather-info me-1" /> Sin usuarios disponibles.
                        </span>
                      ) : (
                        usuarios.map(u => (
                          <div className="form-check custom-checkbox mb-0" key={u.id}>
                            <input
                              type="checkbox"
                              className="form-check-input"
                              id={`u-${u.id}`}
                              checked={usuarioIds.includes(u.id)}
                              onChange={() => toggleUsuario(u.id)}
                            />
                            <label className="form-check-label text-dark" htmlFor={`u-${u.id}`}>
                              {u.nombre} (Admin TI)
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="mb-4 form-check form-switch custom-switch">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="activo"
                      checked={activo}
                      onChange={e => setActivo(e.target.checked)}
                    />
                    <label className="form-check-label fw-semibold text-dark" htmlFor="activo">Activo</label>
                  </div>

                  <hr className="my-4" />

                  <div className="d-flex gap-2">
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      <i className="feather-save me-2" />
                      <span>{saving ? 'Guardando...' : 'Guardar Configuración'}</span>
                    </button>
                    <Link to=".." relative="path" className="btn btn-light-secondary">Cancelar</Link>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
