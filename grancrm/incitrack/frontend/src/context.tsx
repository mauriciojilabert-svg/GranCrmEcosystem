import { createContext, useContext } from 'react';
import type { GranCrmSession } from './types';

interface GranCrmCtx {
  session: GranCrmSession | null;
  apiBase: string;
  basename: string;
}

const Ctx = createContext<GranCrmCtx>({
  session: null,
  apiBase: '',
  basename: '',
});

export const GranCrmProvider = Ctx.Provider;

export const useGranCrm = () => useContext(Ctx);
export const useSession = () => useContext(Ctx).session;
export const useRole = () => useContext(Ctx).session?.rol ?? '';

export function useAppPath() {
  const { basename } = useContext(Ctx);
  return (p = '') => {
    const base = basename.replace(/\/$/, '');
    return `${base}${p && !p.startsWith('/') ? '/' + p : p}`;
  };
}

// Pliega los valores de rol VIEJOS (compat) y NUEVOS al canónico viejo
export function normalizeRole(rol: string): string {
  if (rol === 'sa' || rol === 'admin_ti') return 'sa';
  if (rol === 'admin' || rol === 'admin_cuenta') return 'admin';
  if (rol === 'supervisor' || rol === 'agente') return 'ejecutivo';
  return rol;
}

export function canManage(rol: string): boolean {
  const r = normalizeRole(rol);
  return r === 'sa' || r === 'admin';
}
