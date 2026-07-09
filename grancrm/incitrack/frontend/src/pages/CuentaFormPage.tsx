import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getCuentas, createCuenta, updateCuenta, getUsuarios } from '../lib/api';
import type { CuentaOut, UsuarioOut } from '../apiTypes';
import { useFormSubmit } from '../hooks/useFormSubmit';
import { Loading } from '../components/Loading';
import { ErrorAlert } from '../components/ErrorAlert';
import { PageHeader } from '../components/duralux/PageHeader';

type Mode = 'nuevo' | 'editar';

interface Props {
  mode: Mode;
}

export function CuentaFormPage({ mode }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const cuentaId = id ? Number(id) : null;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [jefes, setJefes] = useState<UsuarioOut[]>([]);
  const [supervisores, setSupervisores] = useState<UsuarioOut[]>([]);

  // Form state
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [activa, setActiva] = useState(true);
  const [jefeId, setJefeId] = useState<string>('');
  const [supervisorIds, setSupervisorIds] = useState<number[]>([]);

  useEffect(() => {
    const promises: Promise<unknown>[] = [getUsuarios()];
    if (mode === 'editar' && cuentaId) {
      promises.push(getCuentas());
    }
    Promise.all(promises)
      .then(results => {
        const usuarios = results[0] as UsuarioOut[];
        setJefes(usuarios.filter(u => u.rol === 'jefe'));
        setSupervisores(usuarios.filter(u => u.rol === 'supervisor'));

        if (mode === 'editar' && cuentaId) {
          const lista = results[1] as import('../apiTypes').CuentaOut[];
          const c = lista.find(x => x.id === cuentaId);
          if (!c) throw new Error('Cuenta no encontrada');
          setNombre(c.nombre);
          setDescripcion(c.descripcion ?? '');
          setActiva(c.activa);
          setJefeId(c.jefe_id ? String(c.jefe_id) : '');
          setSupervisorIds(c.supervisor_ids);
        }
        setLoading(false);
      })
      .catch(e => {
        setLoadError(String(e.message ?? e));
        setLoading(false);
      });
  }, [mode, cuentaId]);

  function toggleSupervisor(sid: number) {
    setSupervisorIds(prev =>
      prev.includes(sid) ? prev.filter(x => x !== sid) : [...prev, sid]
    );
  }

  const { saving, saveError, handleSubmit } = useFormSubmit(
    async () => {
      const data = {
        nombre,
        descripcion: descripcion || null,
        activa,
        jefe_id: jefeId ? Number(jefeId) : null,
        supervisor_ids: supervisorIds,
      };
      if (mode === 'nuevo') {
        await createCuenta(data);
      } else {
        if (!cuentaId) return;
        await updateCuenta(cuentaId, data);
      }
    },
    () => navigate('..', { relative: 'path' })
  );

  if (loading) return <Loading />;

  return (
    <>
      <PageHeader
        title={mode === 'nuevo' ? 'Nueva Cuenta' : 'Editar Cuenta'}
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Cuentas', href: '..' },
          { label: mode === 'nuevo' ? 'Nueva' : 'Editar' }
        ]}
      >
        <Link to=".." relative="path" className="btn btn-light-brand btn-sm">
          <i className="feather-arrow-left me-2" />
          <span>Volver a Cuentas</span>
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
                  {mode === 'nuevo' ? 'Detalles de la nueva cuenta' : 'Actualizar detalles de la cuenta'}
                </h5>
              </div>
              <div className="card-body">
                <form onSubmit={handleSubmit}>
                  <div className="mb-4">
                    <label className="form-label fw-semibold">
                      Nombre <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={nombre}
                      onChange={e => setNombre(e.target.value)}
                      required
                      maxLength={150}
                      placeholder="Ej. Acme Corp"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="form-label fw-semibold">Descripción</label>
                    <textarea
                      className="form-control"
                      value={descripcion}
                      onChange={e => setDescripcion(e.target.value)}
                      maxLength={300}
                      rows={3}
                      placeholder="Breve descripción de la cuenta..."
                    />
                  </div>

                  <div className="mb-4">
                    <label className="form-label fw-semibold">Jefe de Cuenta</label>
                    <select
                      className="form-select"
                      value={jefeId}
                      onChange={e => setJefeId(e.target.value)}
                    >
                      <option value="">-- Sin jefe asignado --</option>
                      {jefes.map(u => (
                        <option key={u.id} value={String(u.id)}>{u.nombre}</option>
                      ))}
                    </select>
                    {jefes.length === 0 && (
                      <div className="text-muted mt-2" style={{ fontSize: 13 }}>
                        <i className="feather-info me-1" /> No hay usuarios con rol Jefe de Cuenta disponibles.
                      </div>
                    )}
                  </div>

                  <div className="mb-4">
                    <label className="form-label fw-semibold">
                      Supervisores <span className="text-muted fw-normal" style={{ fontSize: 12 }}>(selecciona uno o más)</span>
                    </label>
                    <div className="border rounded p-3 d-flex flex-wrap gap-3 bg-light-subtle">
                      {supervisores.length === 0 ? (
                        <span className="text-muted" style={{ fontSize: 13 }}>
                          <i className="feather-info me-1" /> No hay supervisores disponibles.
                        </span>
                      ) : (
                        supervisores.map(u => (
                          <div className="form-check custom-checkbox mb-0" key={u.id}>
                            <input
                              type="checkbox"
                              className="form-check-input"
                              id={`sup-${u.id}`}
                              checked={supervisorIds.includes(u.id)}
                              onChange={() => toggleSupervisor(u.id)}
                            />
                            <label className="form-check-label text-dark" htmlFor={`sup-${u.id}`}>
                              {u.nombre}
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
                      id="activa"
                      checked={activa}
                      onChange={e => setActiva(e.target.checked)}
                    />
                    <label className="form-check-label fw-semibold text-dark" htmlFor="activa">Cuenta Activa</label>
                  </div>

                  <hr className="my-4" />

                  <div className="d-flex gap-2">
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      <i className="feather-save me-2" />
                      <span>{saving ? 'Guardando...' : 'Guardar Cuenta'}</span>
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
