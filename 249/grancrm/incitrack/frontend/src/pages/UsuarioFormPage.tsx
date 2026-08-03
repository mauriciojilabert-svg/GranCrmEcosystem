import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getUsuarios, createUsuario, updateUsuario, getCuentas } from '../lib/api';
import { useFormSubmit } from '../hooks/useFormSubmit';
import type { UsuarioOut, UsuarioRol, CuentaOut } from '../apiTypes';
import { Loading } from '../components/Loading';
import { ErrorAlert } from '../components/ErrorAlert';
import { PageHeader } from '../components/duralux/PageHeader';

type Mode = 'nuevo' | 'editar';

interface Props {
  mode: Mode;
}

const ROL_OPTIONS: { value: UsuarioRol; label: string }[] = [
  { value: 'admin', label: 'Admin TI' },
  { value: 'jefe', label: 'Jefe de Cuenta' },
  { value: 'supervisor', label: 'Supervisor' },
];

export function UsuarioFormPage({ mode }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const usuarioId = id ? Number(id) : null;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Lookup data
  const [cuentas, setCuentas] = useState<CuentaOut[]>([]);

  // Form state
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState<UsuarioRol>('supervisor');
  const [activo, setActivo] = useState(true);
  const [cuentasAsignadasIds, setCuentasAsignadasIds] = useState<number[]>([]);

  useEffect(() => {
    const promises: Promise<unknown>[] = [getCuentas()];
    if (mode === 'editar' && usuarioId) {
      promises.push(getUsuarios());
    }
    Promise.all(promises)
      .then(results => {
        const allCuentas = results[0] as CuentaOut[];
        setCuentas(allCuentas);

        if (mode === 'editar' && usuarioId) {
          const lista = results[1] as UsuarioOut[];
          const u = lista.find(x => x.id === usuarioId);
          if (!u) throw new Error('Usuario no encontrado');
          setNombre(u.nombre);
          setEmail(u.email);
          setRol(u.rol);
          setActivo(u.activo);
          setCuentasAsignadasIds(u.cuentas_asignadas_ids);
        }
        setLoading(false);
      })
      .catch(e => {
        setLoadError(String(e.message ?? e));
        setLoading(false);
      });
  }, [mode, usuarioId]);

  function toggleCuenta(cid: number) {
    setCuentasAsignadasIds(prev =>
      prev.includes(cid) ? prev.filter(x => x !== cid) : [...prev, cid]
    );
  }

  const { saving, saveError, handleSubmit } = useFormSubmit(
    async () => {
      const data = { nombre, email, rol, activo, cuentas_asignadas_ids: cuentasAsignadasIds };
      if (mode === 'nuevo') {
        await createUsuario(data);
      } else {
        if (!usuarioId) return;
        await updateUsuario(usuarioId, data);
      }
    },
    () => navigate('..', { relative: 'path' })
  );

  if (loading) return <Loading />;

  return (
    <>
      <PageHeader
        title={mode === 'nuevo' ? 'Nuevo Usuario' : 'Editar Usuario'}
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Usuarios', href: '..' },
          { label: mode === 'nuevo' ? 'Nuevo' : 'Editar' }
        ]}
      >
        <Link to=".." relative="path" className="btn btn-light-brand btn-sm">
          <i className="feather-arrow-left me-2" />
          <span>Volver a Usuarios</span>
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
                  {mode === 'nuevo' ? 'Detalles del nuevo usuario' : 'Actualizar detalles del usuario'}
                </h5>
              </div>
              <div className="card-body">
                <form onSubmit={handleSubmit}>
                  <div className="mb-4">
                    <label className="form-label fw-semibold">
                      Nombre completo <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={nombre}
                      onChange={e => setNombre(e.target.value)}
                      required
                      maxLength={100}
                      placeholder="Ej. Juan Pérez"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="form-label fw-semibold">
                      Email <span className="text-danger">*</span>
                    </label>
                    <input
                      type="email"
                      className="form-control"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      placeholder="juan.perez@ejemplo.com"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="form-label fw-semibold">
                      Rol <span className="text-danger">*</span>
                    </label>
                    <select
                      className="form-select"
                      value={rol}
                      onChange={e => setRol(e.target.value as UsuarioRol)}
                      required
                    >
                      {ROL_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  {rol === 'supervisor' && (
                    <div className="mb-4">
                      <label className="form-label fw-semibold">
                        Cuentas asignadas <span className="text-muted fw-normal" style={{ fontSize: 12 }}>(solo supervisores)</span>
                      </label>
                      <div className="border rounded p-3 d-flex flex-wrap gap-3 bg-light-subtle">
                        {cuentas.length === 0 ? (
                          <span className="text-muted" style={{ fontSize: 13 }}>
                            <i className="feather-info me-1" /> Sin cuentas disponibles.
                          </span>
                        ) : (
                          cuentas.map(c => (
                            <div className="form-check custom-checkbox mb-0" key={c.id}>
                              <input
                                type="checkbox"
                                className="form-check-input"
                                id={`cuenta-${c.id}`}
                                checked={cuentasAsignadasIds.includes(c.id)}
                                onChange={() => toggleCuenta(c.id)}
                              />
                              <label className="form-check-label text-dark" htmlFor={`cuenta-${c.id}`}>
                                {c.nombre}
                              </label>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mb-4 form-check form-switch custom-switch">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="activo"
                      checked={activo}
                      onChange={e => setActivo(e.target.checked)}
                    />
                    <label className="form-check-label fw-semibold text-dark" htmlFor="activo">Usuario Activo</label>
                  </div>

                  <hr className="my-4" />

                  <div className="d-flex gap-2">
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      <i className="feather-save me-2" />
                      <span>{saving ? 'Guardando...' : 'Guardar Usuario'}</span>
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
