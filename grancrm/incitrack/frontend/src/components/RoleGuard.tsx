import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useSession } from '../context';

interface Props {
  roles: string[];
  children: ReactNode;
}

/**
 * Renders children only if session.rol is in the allowed roles list.
 * Otherwise redirects to the app root.
 */
export function RoleGuard({ roles, children }: Props) {
  const session = useSession();
  if (!session || !roles.includes(session.rol)) {
    return (
      <div style={{ padding: 24, color: '#b91c1c', background: '#fee2e2', borderRadius: 8, margin: 24 }}>
        <strong>Acceso Denegado:</strong> Tu rol actual es "{session?.rol || 'undefined'}". Se requiere alguno de los siguientes roles: {roles.join(', ')}.
      </div>
    );
  }
  return <>{children}</>;
}
