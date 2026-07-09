/**
 * Typed wrappers around apiFetch/apiUpload for every InciTrack API endpoint.
 */
import { apiFetch } from '../api';
import type {
  DashboardStatsOut,
  TicketListItemOut,
  TicketOut,
  TicketAuditOut,
  TicketCreateIn,
  TicketEditIn,
  ComentarioOut,
  ComentarioIn,
  CategoriaLookupItem,
  CuentaLookupItem,
  SubcategoriasOut,
  SLALookupOut,
  UsuarioOut,
  UsuarioIn,
  CuentaOut,
  CuentaIn,
  NotificacionOut,
  NotificacionIn,
  SLAOut,
  SLAIn,
  AvisoTIOut,
} from '../apiTypes';

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function getDashboard(params: { periodo?: string; ver_todos?: boolean }): Promise<DashboardStatsOut> {
  const qs = new URLSearchParams();
  if (params.periodo) qs.set('periodo', params.periodo);
  if (params.ver_todos) qs.set('ver_todos', 'true');
  const q = qs.toString();
  return apiFetch<DashboardStatsOut>(`dashboard/${q ? '?' + q : ''}`);
}

// ── Tickets ───────────────────────────────────────────────────────────────────

export interface TicketListParams {
  estado?: string;
  categoria?: string;
  q?: string;
  cuenta?: string;
  periodo?: string;
  desde?: string;
  hasta?: string;
  responsable_ti?: string;
  ver_todos?: boolean;
}

export function getTickets(params: TicketListParams = {}): Promise<TicketListItemOut[]> {
  const qs = new URLSearchParams();
  if (params.estado) qs.set('estado', params.estado);
  if (params.categoria) qs.set('categoria', params.categoria);
  if (params.q) qs.set('q', params.q);
  if (params.cuenta) qs.set('cuenta', params.cuenta);
  if (params.periodo) qs.set('periodo', params.periodo);
  if (params.desde) qs.set('desde', params.desde);
  if (params.hasta) qs.set('hasta', params.hasta);
  if (params.responsable_ti) qs.set('responsable_ti', params.responsable_ti);
  if (params.ver_todos) qs.set('ver_todos', 'true');
  const q = qs.toString();
  return apiFetch<TicketListItemOut[]>(`tickets/${q ? '?' + q : ''}`);
}

export function getTicket(id: number): Promise<TicketOut> {
  return apiFetch<TicketOut>(`tickets/${id}/`);
}

export function createTicket(data: TicketCreateIn): Promise<TicketOut> {
  return apiFetch<TicketOut>('tickets/', { method: 'POST', body: JSON.stringify(data) });
}

export function editTicket(id: number, data: TicketEditIn): Promise<TicketOut> {
  return apiFetch<TicketOut>(`tickets/${id}/`, { method: 'PUT', body: JSON.stringify(data) });
}

export function getTicketAuditoria(id: number): Promise<TicketAuditOut[]> {
  return apiFetch<TicketAuditOut[]>(`tickets/${id}/auditoria/`);
}

export function cerrarTicket(id: number): Promise<TicketOut> {
  return apiFetch<TicketOut>(`tickets/${id}/cerrar/`, { method: 'POST' });
}

// ── Comentarios ───────────────────────────────────────────────────────────────

export function agregarComentario(ticketId: number, data: ComentarioIn): Promise<ComentarioOut> {
  return apiFetch<ComentarioOut>(`tickets/${ticketId}/comentarios/`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ── Lookups ───────────────────────────────────────────────────────────────────

export function getLookupCategorias(): Promise<CategoriaLookupItem[]> {
  return apiFetch<CategoriaLookupItem[]>('lookups/categorias/');
}

export function getLookupCuentas(): Promise<CuentaLookupItem[]> {
  return apiFetch<CuentaLookupItem[]>('lookups/cuentas/');
}

export function getLookupSubcategorias(categoriaId: number): Promise<SubcategoriasOut> {
  return apiFetch<SubcategoriasOut>(`lookups/subcategorias/?categoria_id=${categoriaId}`);
}

export function getLookupSLA(categoriaId: number, subcategoriaId?: number): Promise<SLALookupOut> {
  let path = `lookups/sla/?categoria_id=${categoriaId}`;
  if (subcategoriaId) path += `&subcategoria_id=${subcategoriaId}`;
  return apiFetch<SLALookupOut>(path);
}

// ── Admin: Usuarios ───────────────────────────────────────────────────────────

export function getUsuarios(): Promise<UsuarioOut[]> {
  return apiFetch<UsuarioOut[]>('usuarios/');
}

export function getUsuario(id: number): Promise<UsuarioOut> {
  return apiFetch<UsuarioOut>(`usuarios/${id}/`);
}

export function createUsuario(data: UsuarioIn): Promise<UsuarioOut> {
  return apiFetch<UsuarioOut>('usuarios/', { method: 'POST', body: JSON.stringify(data) });
}

export function updateUsuario(id: number, data: UsuarioIn): Promise<UsuarioOut> {
  return apiFetch<UsuarioOut>(`usuarios/${id}/`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteUsuario(id: number): Promise<void> {
  return apiFetch<void>(`usuarios/${id}/`, { method: 'DELETE' });
}

// ── Admin: Cuentas ────────────────────────────────────────────────────────────

export function getCuentas(): Promise<CuentaOut[]> {
  return apiFetch<CuentaOut[]>('cuentas/');
}

export function getCuenta(id: number): Promise<CuentaOut> {
  return apiFetch<CuentaOut>(`cuentas/${id}/`);
}

export function createCuenta(data: CuentaIn): Promise<CuentaOut> {
  return apiFetch<CuentaOut>('cuentas/', { method: 'POST', body: JSON.stringify(data) });
}

export function updateCuenta(id: number, data: CuentaIn): Promise<CuentaOut> {
  return apiFetch<CuentaOut>(`cuentas/${id}/`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteCuenta(id: number): Promise<void> {
  return apiFetch<void>(`cuentas/${id}/`, { method: 'DELETE' });
}

// ── Admin: Notificaciones ─────────────────────────────────────────────────────

export function getNotificaciones(): Promise<NotificacionOut[]> {
  return apiFetch<NotificacionOut[]>('notificaciones/');
}

export function getNotificacion(id: number): Promise<NotificacionOut> {
  return apiFetch<NotificacionOut>(`notificaciones/${id}/`);
}

export function createNotificacion(data: NotificacionIn): Promise<NotificacionOut> {
  return apiFetch<NotificacionOut>('notificaciones/', { method: 'POST', body: JSON.stringify(data) });
}

export function updateNotificacion(id: number, data: NotificacionIn): Promise<NotificacionOut> {
  return apiFetch<NotificacionOut>(`notificaciones/${id}/`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteNotificacion(id: number): Promise<void> {
  return apiFetch<void>(`notificaciones/${id}/`, { method: 'DELETE' });
}

// ── Admin: SLA ────────────────────────────────────────────────────────────────

export function getSLAs(): Promise<SLAOut[]> {
  return apiFetch<SLAOut[]>('sla/');
}

export function getSLA(id: number): Promise<SLAOut> {
  return apiFetch<SLAOut>(`sla/${id}/`);
}

export function createSLA(data: SLAIn): Promise<SLAOut> {
  return apiFetch<SLAOut>('sla/', { method: 'POST', body: JSON.stringify(data) });
}

export function updateSLA(id: number, data: SLAIn): Promise<SLAOut> {
  return apiFetch<SLAOut>(`sla/${id}/`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteSLA(id: number): Promise<void> {
  return apiFetch<void>(`sla/${id}/`, { method: 'DELETE' });
}

// ── Avisos TI ────────────────────────────────────────────────────────────────

export function getAvisos(): Promise<AvisoTIOut[]> {
  return apiFetch<AvisoTIOut[]>('avisos/');
}

export function createAviso(data: { tipo: string; contenido: string }): Promise<AvisoTIOut> {
  return apiFetch<AvisoTIOut>('avisos/', { method: 'POST', body: JSON.stringify(data) });
}

export function deleteAviso(id: number): Promise<void> {
  return apiFetch<void>(`avisos/${id}/`, { method: 'DELETE' });
}
