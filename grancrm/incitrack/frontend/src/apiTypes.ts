/**
 * TypeScript types mirroring incitrack/tickets/schemas.py exactly.
 * Field names match what the API returns.
 */

// ── Ticket ──────────────────────────────────────────────────────────────────

export type TicketEstado = 'abierto' | 'en_proceso' | 'resuelto' | 'cerrado';


export interface TicketListItemOut {
  id: number;
  titulo: string;
  estado: TicketEstado;
  fecha_creacion: string;
  fecha_actualizacion: string;
  tipo_incidencia: string;
  fue_reasignado: boolean;
  cuenta_id: number;
  cuenta_nombre: string | null;
  creado_por_id: number;
  creado_por_nombre: string | null;
  asignado_a_id: number | null;
  asignado_a_nombre: string | null;
  categoria_id: number | null;
  categoria_nombre: string | null;
  subcategoria_id: number | null;
  subcategoria_nombre: string | null;
  plataforma_bi: string | null;
}

export interface TicketOut {
  id: number;
  titulo: string;
  descripcion: string;
  estado: TicketEstado;
  fecha_creacion: string;
  fecha_actualizacion: string;
  fecha_resolucion: string | null;
  tipo_incidencia: string;
  fue_reasignado: boolean;
  cuenta_id: number;
  cuenta_nombre: string | null;
  creado_por_id: number;
  creado_por_nombre: string | null;
  asignado_a_id: number | null;
  asignado_a_nombre: string | null;
  categoria_id: number | null;
  categoria_nombre: string | null;
  subcategoria_id: number | null;
  subcategoria_nombre: string | null;
  plataforma_bi: string | null;
  comentarios: ComentarioOut[];
}

export interface TicketAuditOut {
  id: number;
  ticket_id: number;
  usuario_id: number | null;
  usuario_nombre: string | null;
  campo_modificado: string;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  fecha_modificacion: string;
}

export interface TicketCreateIn {
  titulo: string;
  descripcion: string;
  cuenta_id: number;
  categoria_id?: number | null;
  subcategoria_id?: number | null;
  plataforma_bi?: string | null;
}

export interface TicketEditIn {
  titulo?: string | null;
  descripcion?: string | null;
  estado?: TicketEstado | null;
  asignado_a_id?: number | null;
  categoria_id?: number | null;
  subcategoria_id?: number | null;
  plataforma_bi?: string | null;
}

// ── Comentario ───────────────────────────────────────────────────────────────

export interface ComentarioOut {
  id: number;
  ticket_id: number;
  autor_id: number;
  autor_nombre: string | null;
  contenido: string;
  fecha: string;
  interno: boolean;
}

export interface ComentarioIn {
  contenido: string;
  interno?: boolean;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface TicketResumenItem {
  id: number;
  titulo: string;
  estado: TicketEstado;
  fecha_creacion: string;
  fue_reasignado: boolean;
  tipo_incidencia: string;
  cuenta__nombre: string | null;
  creado_por__nombre: string | null;
  asignado_a__nombre: string | null;
  asignado_a__id: number | null;
  categoria__nombre: string | null;
  subcategoria__nombre: string | null;
  plataforma_bi: string | null;
}

export interface DashboardStatsOut {
  total_filtrado: number;
  periodo_activo: string;
  abiertos: number;
  en_proceso: number;
  resueltos: number;
  cerrados: number;
  cerrados_48h: number;
  por_cerrar: number;
  tickets_hoy: number;
  sin_asignar: number;
  solo_mis_tickets: boolean;
  ver_todos: boolean;
  tickets_urgentes: TicketResumenItem[];
  mis_tickets_activos: TicketResumenItem[];
  auditoria_reciente: AuditoriaItem[];
}

export interface AuditoriaItem {
  id: number;
  ticket_id: number;
  ticket_titulo: string;
  autor_nombre: string;
  contenido: string;
  fecha: string;
  tipo: string;
}

// ── Lookups ───────────────────────────────────────────────────────────────────

export interface SubcategoriaItem {
  id: number;
  nombre: string;
}

export interface SubcategoriasOut {
  subcategorias: SubcategoriaItem[];
  requiere_bi: boolean;
}

export interface SLALookupOut {
  tiene_sla: boolean;
  respuesta: string | null;
  cierre: string | null;
}

export interface CategoriaLookupItem {
  id: number;
  nombre: string;
  slug: string;
  requiere_bi: boolean;
  subcategorias: SubcategoriaItem[];
}

export interface CuentaLookupItem {
  id: number;
  nombre: string;
}

// ── Admin: Usuario ─────────────────────────────────────────────────────────────

export type UsuarioRol = 'admin' | 'jefe' | 'supervisor';

export interface UsuarioOut {
  id: number;
  nombre: string;
  email: string;
  rol: UsuarioRol;
  activo: boolean;
  fecha_creacion: string;
  cuentas_asignadas_ids: number[];
}

export interface UsuarioIn {
  nombre: string;
  email: string;
  rol: UsuarioRol;
  activo: boolean;
  cuentas_asignadas_ids: number[];
}

// ── Admin: Cuenta ─────────────────────────────────────────────────────────────

export interface CuentaOut {
  id: number;
  nombre: string;
  descripcion: string | null;
  activa: boolean;
  fecha_creacion: string;
  jefe_id: number | null;
  supervisor_ids: number[];
}

export interface CuentaIn {
  nombre: string;
  descripcion?: string | null;
  activa: boolean;
  jefe_id?: number | null;
  supervisor_ids: number[];
}

// ── Admin: Notificacion ───────────────────────────────────────────────────────

export interface NotificacionOut {
  id: number;
  categoria_id: number | null;
  subcategoria_id: number | null;
  servicio: string;
  emails_cc: string;
  activo: boolean;
  clasificacion_display: string;
  usuario_ids: number[];
}

export interface NotificacionIn {
  categoria_id?: number | null;
  subcategoria_id?: number | null;
  servicio?: string;
  emails_cc?: string;
  activo: boolean;
  usuario_ids: number[];
}

// ── Admin: SLA ────────────────────────────────────────────────────────────────

export interface SLAOut {
  id: number;
  categoria_id: number;
  categoria_nombre: string | null;
  subcategoria_id: number | null;
  subcategoria_nombre: string | null;
  plataforma_bi: string | null;
  tiempo_respuesta_minutos: number;
  tiempo_cierre_minutos: number;
  descripcion: string;
  activo: boolean;
  tiempo_respuesta_display: string;
  tiempo_cierre_display: string;
}

export interface SLAIn {
  categoria_id: number;
  subcategoria_id?: number | null;
  plataforma_bi?: string | null;
  tiempo_respuesta_minutos: number;
  tiempo_cierre_minutos: number;
  descripcion?: string;
  activo: boolean;
}

// \u2500\u2500 Avisos TI \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

export type AvisoTipo = 'info' | 'advertencia' | 'critico' | 'resolucion';

export interface AvisoTIOut {
  id: number;
  tipo: AvisoTipo;
  contenido: string;
  creado_por_nombre: string | null;
  fecha_creacion: string;
  expira_en: string;
  activo: boolean;
}

