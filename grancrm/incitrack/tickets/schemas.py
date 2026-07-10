"""
InciTrack — Ninja Schema definitions

All schemas match model field names from tickets/models.py exactly.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from ninja import Schema


# ══════════════════════════════════════════════════════════════════════════════
# USUARIO
# ══════════════════════════════════════════════════════════════════════════════

class UsuarioOut(Schema):
    id: int
    nombre: str
    email: str
    rol: str
    activo: bool
    fecha_creacion: datetime
    cuentas_asignadas_ids: list[int] = []


class UsuarioIn(Schema):
    nombre: str
    email: str
    rol: str
    activo: bool = True
    cuentas_asignadas_ids: list[int] = []


# ══════════════════════════════════════════════════════════════════════════════
# CUENTA
# ══════════════════════════════════════════════════════════════════════════════

class CuentaOut(Schema):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    activa: bool
    fecha_creacion: datetime
    jefe_id: Optional[int] = None
    supervisor_ids: list[int] = []


class CuentaIn(Schema):
    nombre: str
    descripcion: Optional[str] = None
    activa: bool = True
    jefe_id: Optional[int] = None
    supervisor_ids: list[int] = []


# ══════════════════════════════════════════════════════════════════════════════
# TICKET
# ══════════════════════════════════════════════════════════════════════════════

class TicketListItemOut(Schema):
    id: int
    titulo: str
    estado: str
    prioridad: str
    fecha_creacion: datetime
    fecha_actualizacion: datetime
    tipo_incidencia: str
    fue_reasignado: bool
    cuenta_id: int
    cuenta_nombre: Optional[str] = None
    creado_por_id: int
    creado_por_nombre: Optional[str] = None
    asignado_a_id: Optional[int] = None
    asignado_a_nombre: Optional[str] = None
    categoria_id: Optional[int] = None
    categoria_nombre: Optional[str] = None
    subcategoria_id: Optional[int] = None
    subcategoria_nombre: Optional[str] = None
    plataforma_bi: Optional[str] = None


class TicketOut(Schema):
    id: int
    titulo: str
    descripcion: str
    estado: str
    prioridad: str
    fecha_creacion: datetime
    fecha_actualizacion: datetime
    fecha_resolucion: Optional[datetime] = None
    tipo_incidencia: str
    fue_reasignado: bool
    cuenta_id: int
    cuenta_nombre: Optional[str] = None
    creado_por_id: int
    creado_por_nombre: Optional[str] = None
    asignado_a_id: Optional[int] = None
    asignado_a_nombre: Optional[str] = None
    categoria_id: Optional[int] = None
    categoria_nombre: Optional[str] = None
    subcategoria_id: Optional[int] = None
    subcategoria_nombre: Optional[str] = None
    plataforma_bi: Optional[str] = None
    comentarios: list[ComentarioOut] = []


class TicketCreateIn(Schema):
    titulo: str
    descripcion: str
    prioridad: str = 'media'
    cuenta_id: int
    categoria_id: Optional[int] = None
    subcategoria_id: Optional[int] = None
    plataforma_bi: Optional[str] = None


class TicketEditIn(Schema):
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    estado: Optional[str] = None
    prioridad: Optional[str] = None
    asignado_a_id: Optional[int] = None
    categoria_id: Optional[int] = None
    subcategoria_id: Optional[int] = None
    plataforma_bi: Optional[str] = None


# ══════════════════════════════════════════════════════════════════════════════
# COMENTARIO
# ══════════════════════════════════════════════════════════════════════════════

class ComentarioOut(Schema):
    id: int
    ticket_id: int
    autor_id: int
    autor_nombre: Optional[str] = None
    contenido: str
    fecha: datetime
    interno: bool


class ComentarioIn(Schema):
    contenido: str
    interno: bool = False


# ══════════════════════════════════════════════════════════════════════════════
# DASHBOARD
# ══════════════════════════════════════════════════════════════════════════════

class TicketResumenItem(Schema):
    id: int
    titulo: str
    estado: str
    fecha_creacion: datetime
    fue_reasignado: bool
    tipo_incidencia: str
    cuenta__nombre: Optional[str] = None
    creado_por__nombre: Optional[str] = None
    asignado_a__nombre: Optional[str] = None
    asignado_a__id: Optional[int] = None
    categoria__nombre: Optional[str] = None
    subcategoria__nombre: Optional[str] = None
    plataforma_bi: Optional[str] = None


class DashboardStatsOut(Schema):
    total_filtrado: int
    periodo_activo: str
    abiertos: int
    en_proceso: int
    resueltos: int
    cerrados: int
    cerrados_48h: int
    por_cerrar: int
    tickets_hoy: int
    sin_asignar: int
    solo_mis_tickets: bool
    ver_todos: bool
    # Todos opcionales para compatibilidad con ambas versiones del api.py
    tickets_recientes: list[dict] = []
    tickets_urgentes: list[dict] = []
    mis_tickets_activos: list[dict] = []
    auditoria_reciente: list[dict] = []


# ══════════════════════════════════════════════════════════════════════════════
# NOTIFICACION
# ══════════════════════════════════════════════════════════════════════════════

class NotificacionOut(Schema):
    id: int
    categoria_id: Optional[int] = None
    subcategoria_id: Optional[int] = None
    servicio: Optional[str] = None
    emails_cc: Optional[str] = None
    activo: bool
    clasificacion_display: str
    usuario_ids: list[int] = []


class NotificacionIn(Schema):
    categoria_id: Optional[int] = None
    subcategoria_id: Optional[int] = None
    servicio: Optional[str] = None
    emails_cc: Optional[str] = None
    activo: bool = True
    usuario_ids: list[int] = []


# ══════════════════════════════════════════════════════════════════════════════
# SLA
# ══════════════════════════════════════════════════════════════════════════════

class SLAOut(Schema):
    id: int
    categoria_id: int
    categoria_nombre: Optional[str] = None
    subcategoria_id: Optional[int] = None
    subcategoria_nombre: Optional[str] = None
    plataforma_bi: Optional[str] = None
    tiempo_respuesta_minutos: Optional[int] = 0
    tiempo_cierre_minutos: Optional[int] = 0
    descripcion: Optional[str] = None
    activo: bool
    tiempo_respuesta_display: str
    tiempo_cierre_display: str


class SLAIn(Schema):
    categoria_id: int
    subcategoria_id: Optional[int] = None
    plataforma_bi: Optional[str] = None
    tiempo_respuesta_minutos: Optional[int] = 0
    tiempo_cierre_minutos: Optional[int] = 0
    descripcion: Optional[str] = None
    activo: bool = True


# ══════════════════════════════════════════════════════════════════════════════
# LOOKUPS
# ══════════════════════════════════════════════════════════════════════════════

class SubcategoriaItem(Schema):
    id: int
    nombre: str


class SubcategoriasOut(Schema):
    subcategorias: list[SubcategoriaItem]
    requiere_bi: bool


class SLALookupOut(Schema):
    tiene_sla: bool
    respuesta: Optional[str] = None
    cierre: Optional[str] = None


class CategoriaLookupItem(Schema):
    id: int
    nombre: str
    slug: str
    requiere_bi: bool
    subcategorias: list[SubcategoriaItem]


class CuentaLookupItem(Schema):
    id: int
    nombre: str


# ══════════════════════════════════════════════════════════════════════════════
# AVISOS TI
# ══════════════════════════════════════════════════════════════════════════════

class AvisoTIOut(Schema):
    id: int
    tipo: str
    contenido: str
    creado_por_nombre: Optional[str] = None
    fecha_creacion: datetime
    expira_en: datetime
    activo: bool


class AvisoTIIn(Schema):
    tipo: str = 'info'
    contenido: str

