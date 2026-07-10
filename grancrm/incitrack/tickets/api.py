"""
InciTrack — Django-Ninja JSON API v1

All endpoints reuse the visibility helpers from tickets/mixins.py so the API
enforces the same per-role/per-tenant access the templates do.

Auth: GranCrmCookieAuth reads request.jwt_payload set by GranCRMAuthMiddleware.
      Unauthenticated requests → 401.
"""
from datetime import timedelta
from typing import Optional

from django.http import HttpRequest
from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import NinjaAPI, Router
from ninja.security import HttpBearer


def _grancrm_auth(request: HttpRequest):
    """
    Auth inline para Django Ninja.
    Lee jwt_payload seteado por GranCRMSessionMiddleware.
    BYPASS activo en QA: si hay payload en request, lo acepta directamente.
    """
    payload = getattr(request, 'jwt_payload', None)
    if payload:
        print(f"api.py _grancrm_auth: OK via jwt_payload - {payload.get('email')}", flush=True)
        return payload
    print("api.py _grancrm_auth: SIN jwt_payload en request", flush=True)
    return None


from .models import (
    Ticket, Cuenta, Usuario, Comentario,
    NotificacionServicio, Categoria, Subcategoria, ConfiguracionSLA,
    AvisoTI,
)
from .mixins import (
    tickets_visibles, cuentas_visibles, puede_ver_ticket,
)
from .email_service import notificar_nuevo_ticket
from .schemas import (
    TicketOut, TicketListItemOut, TicketCreateIn, TicketEditIn,
    ComentarioOut, ComentarioIn,
    DashboardStatsOut,
    UsuarioOut, UsuarioIn,
    CuentaOut, CuentaIn,
    NotificacionOut, NotificacionIn,
    SLAOut, SLAIn,
    SubcategoriasOut, SLALookupOut,
    CategoriaLookupItem, CuentaLookupItem,
    AvisoTIOut, AvisoTIIn,
)

grcrm_auth = _grancrm_auth

api = NinjaAPI(
    auth=grcrm_auth,
    title="InciTrack API",
    version="1.0.0",
    description="API JSON de InciTrack. Requiere cookie grancrm_session válida.",
    urls_namespace="incitrack_api",
)


# ─── Auth guard helpers ───────────────────────────────────────────────────────

def _require_auth(request: HttpRequest):
    """Returns jwt_payload or raises 401. Use at top of each endpoint."""
    payload = getattr(request, "jwt_payload", None)
    if not payload:
        return None
    return payload


def _get_user(request: HttpRequest):
    """Returns authenticated local Usuario or None."""
    if not request.user or not request.user.is_authenticated:
        return None
    return request.user


def _require_admin(request: HttpRequest):
    """Returns True if user is admin, else False (caller should return 403)."""
    user = _get_user(request)
    if not user:
        return False
    return user.es_admin


def _require_admin_or_jefe(request: HttpRequest):
    """Returns True if user is admin or jefe."""
    user = _get_user(request)
    if not user:
        return False
    return user.es_admin or user.es_jefe


# ─── DASHBOARD ───────────────────────────────────────────────────────────────

@api.get("/dashboard/", response={200: DashboardStatsOut, 401: dict, 403: dict}, tags=["dashboard"])
def dashboard(request: HttpRequest, periodo: str = "", ver_todos: bool = False):
    """Estadísticas del dashboard para el usuario autenticado."""
    if not _require_auth(request):
        return 401, {"detail": "No autenticado"}
    usuario = _get_user(request)
    if not usuario:
        return 401, {"detail": "No autenticado"}

    ahora = timezone.now()
    qs = tickets_visibles(usuario)

    solo_mis_tickets = usuario.es_admin and not ver_todos
    if solo_mis_tickets:
        qs = qs.filter(asignado_a=usuario)

    qs_filtrado = qs
    if periodo == 'hoy':
        qs_filtrado = qs.filter(fecha_creacion__date=ahora.date())
    elif periodo == 'ayer':
        qs_filtrado = qs.filter(fecha_creacion__date=ahora.date() - timedelta(days=1))
    elif periodo == 'esta_semana':
        qs_filtrado = qs.filter(fecha_creacion__gte=ahora - timedelta(days=ahora.weekday()))
    elif periodo == 'este_mes':
        qs_filtrado = qs.filter(fecha_creacion__year=ahora.year, fecha_creacion__month=ahora.month)
    elif periodo == 'mes_pasado':
        if ahora.month == 1:
            qs_filtrado = qs.filter(fecha_creacion__year=ahora.year - 1, fecha_creacion__month=12)
        else:
            qs_filtrado = qs.filter(fecha_creacion__year=ahora.year, fecha_creacion__month=ahora.month - 1)
    elif periodo == 'este_anio':
        qs_filtrado = qs.filter(fecha_creacion__year=ahora.year)

    limite_48h = ahora - timedelta(hours=48)
    limite_20h = ahora - timedelta(hours=20)
    limite_24h = ahora - timedelta(hours=24)
    por_cerrar = qs_filtrado.filter(
        estado__in=['abierto', 'en_proceso'],
        fecha_actualizacion__lte=limite_20h,
        fecha_actualizacion__gte=limite_24h,
    ).count()

    ahora_local = timezone.localtime(ahora)
    tickets_recientes = list(qs.values(
        'id', 'titulo', 'estado', 'fecha_creacion', 'fue_reasignado', 'tipo_incidencia',
        'cuenta__nombre', 'creado_por__nombre',
        'asignado_a__nombre', 'asignado_a__id',
        'categoria__nombre', 'subcategoria__nombre',
        'plataforma_bi',
    )[:10])
    # Convert datetimes to strings for JSON serialization
    for t in tickets_recientes:
        if t.get('fecha_creacion'):
            t['fecha_creacion'] = t['fecha_creacion'].isoformat()

    return 200, DashboardStatsOut(
        total_filtrado=qs_filtrado.count(),
        periodo_activo=periodo,
        abiertos=qs_filtrado.filter(estado='abierto').count(),
        en_proceso=qs_filtrado.filter(estado='en_proceso').count(),
        resueltos=qs_filtrado.filter(estado='resuelto').count(),
        cerrados=qs_filtrado.filter(estado='cerrado').count(),
        cerrados_48h=qs_filtrado.filter(estado='cerrado', fecha_resolucion__gte=limite_48h).count(),
        por_cerrar=por_cerrar,
        tickets_hoy=qs.filter(fecha_creacion__date=ahora_local.date()).count(),
        sin_asignar=qs_filtrado.filter(estado__in=['abierto', 'en_proceso'], asignado_a__isnull=True).count(),
        solo_mis_tickets=solo_mis_tickets,
        ver_todos=ver_todos,
        tickets_recientes=tickets_recientes,
    )


# ─── TICKETS ─────────────────────────────────────────────────────────────────

@api.get("/tickets/", response={200: list[TicketListItemOut], 401: dict}, tags=["tickets"])
def ticket_list(
    request: HttpRequest,
    estado: str = "",
    categoria: str = "",
    q: str = "",
    cuenta: str = "",
    periodo: str = "",
    desde: str = "",
    hasta: str = "",
    responsable_ti: str = "",
    ver_todos: bool = False,
):
    """Lista de tickets visibles para el usuario autenticado."""
    if not _require_auth(request):
        return 401, {"detail": "No autenticado"}
    usuario = _get_user(request)
    if not usuario:
        return 401, {"detail": "No autenticado"}

    from django.db.models import Q as DQ

    qs = tickets_visibles(usuario).select_related(
        'cuenta', 'creado_por', 'asignado_a', 'categoria', 'subcategoria'
    )

    solo_mis_tickets = usuario.es_admin and not ver_todos
    if solo_mis_tickets:
        qs = qs.filter(asignado_a=usuario)

    if not usuario.es_admin:
        qs = qs.filter(creado_por=usuario)

    if estado:
        qs = qs.filter(estado=estado)
    if categoria:
        qs = qs.filter(categoria_id=categoria)
    if q:
        qs = qs.filter(DQ(titulo__icontains=q) | DQ(descripcion__icontains=q))
    if cuenta:
        qs = qs.filter(cuenta_id=cuenta)
    if responsable_ti:
        qs = qs.filter(asignado_a_id=responsable_ti)

    ahora = timezone.now()
    if periodo == 'hoy':
        qs = qs.filter(fecha_creacion__date=ahora.date())
    elif periodo == 'ayer':
        qs = qs.filter(fecha_creacion__date=ahora.date() - timedelta(days=1))
    elif periodo == 'semana':
        qs = qs.filter(fecha_creacion__gte=ahora - timedelta(days=7))
    elif periodo == 'mes':
        qs = qs.filter(fecha_creacion__year=ahora.year, fecha_creacion__month=ahora.month)

    if desde:
        try:
            qs = qs.filter(fecha_creacion__date__gte=desde)
        except Exception:
            pass
    if hasta:
        try:
            qs = qs.filter(fecha_creacion__date__lte=hasta)
        except Exception:
            pass

    result = []
    for t in qs:
        result.append(TicketListItemOut(
            id=t.id,
            titulo=t.titulo,
            estado=t.estado,
            prioridad=t.prioridad,
            fecha_creacion=t.fecha_creacion,
            fecha_actualizacion=t.fecha_actualizacion,
            tipo_incidencia=t.tipo_incidencia,
            fue_reasignado=t.fue_reasignado,
            cuenta_id=t.cuenta_id,
            cuenta_nombre=t.cuenta.nombre if t.cuenta else None,
            creado_por_id=t.creado_por_id,
            creado_por_nombre=t.creado_por.nombre if t.creado_por else None,
            asignado_a_id=t.asignado_a_id,
            asignado_a_nombre=t.asignado_a.nombre if t.asignado_a else None,
            categoria_id=t.categoria_id,
            categoria_nombre=t.categoria.nombre if t.categoria else None,
            subcategoria_id=t.subcategoria_id,
            subcategoria_nombre=t.subcategoria.nombre if t.subcategoria else None,
            plataforma_bi=t.plataforma_bi,
        ))
    return 200, result


@api.get("/tickets/{ticket_id}/", response={200: TicketOut, 401: dict, 403: dict, 404: dict}, tags=["tickets"])
def ticket_detail(request: HttpRequest, ticket_id: int):
    """Detalle de un ticket. Aplica puede_ver_ticket."""
    if not _require_auth(request):
        return 401, {"detail": "No autenticado"}
    usuario = _get_user(request)
    if not usuario:
        return 401, {"detail": "No autenticado"}

    ticket = get_object_or_404(Ticket, pk=ticket_id)
    if not puede_ver_ticket(usuario, ticket):
        return 403, {"detail": "Sin acceso a este ticket"}

    # Mirror ticket_detalle.html: internal comments only visible to admins
    comentarios_qs = ticket.comentarios.select_related('autor').order_by('fecha')
    if not usuario.es_admin:
        comentarios_qs = comentarios_qs.filter(interno=False)

    comentarios_out = [
        ComentarioOut(
            id=c.id,
            ticket_id=c.ticket_id,
            autor_id=c.autor_id,
            autor_nombre=c.autor.nombre,
            contenido=c.contenido,
            fecha=c.fecha,
            interno=c.interno,
        )
        for c in comentarios_qs
    ]

    return 200, TicketOut(
        id=ticket.id,
        titulo=ticket.titulo,
        descripcion=ticket.descripcion,
        estado=ticket.estado,
        prioridad=ticket.prioridad,
        fecha_creacion=ticket.fecha_creacion,
        fecha_actualizacion=ticket.fecha_actualizacion,
        fecha_resolucion=ticket.fecha_resolucion,
        tipo_incidencia=ticket.tipo_incidencia,
        fue_reasignado=ticket.fue_reasignado,
        cuenta_id=ticket.cuenta_id,
        cuenta_nombre=ticket.cuenta.nombre if ticket.cuenta else None,
        creado_por_id=ticket.creado_por_id,
        creado_por_nombre=ticket.creado_por.nombre if ticket.creado_por else None,
        asignado_a_id=ticket.asignado_a_id,
        asignado_a_nombre=ticket.asignado_a.nombre if ticket.asignado_a else None,
        categoria_id=ticket.categoria_id,
        categoria_nombre=ticket.categoria.nombre if ticket.categoria else None,
        subcategoria_id=ticket.subcategoria_id,
        subcategoria_nombre=ticket.subcategoria.nombre if ticket.subcategoria else None,
        plataforma_bi=ticket.plataforma_bi,
        comentarios=comentarios_out,
    )


@api.post("/tickets/", response={201: TicketOut, 400: dict, 401: dict}, tags=["tickets"])
def ticket_create(request: HttpRequest, data: TicketCreateIn):
    """Crea un nuevo ticket. Mirrors TicketNuevoView including auto-assign + email notification."""
    if not _require_auth(request):
        return 401, {"detail": "No autenticado"}
    usuario = _get_user(request)
    if not usuario:
        return 401, {"detail": "No autenticado"}

    cuenta = get_object_or_404(Cuenta, pk=data.cuenta_id)
    categoria = get_object_or_404(Categoria, pk=data.categoria_id) if data.categoria_id else None
    subcategoria = get_object_or_404(Subcategoria, pk=data.subcategoria_id) if data.subcategoria_id else None

    ticket = Ticket(
        titulo=data.titulo,
        descripcion=data.descripcion,
        prioridad=data.prioridad,
        cuenta=cuenta,
        creado_por=usuario,
        categoria=categoria,
        subcategoria=subcategoria,
        plataforma_bi=data.plataforma_bi or '',
        tipo_incidencia='',
    )

    # Auto-assign: mirror TicketNuevoView logic
    _ns = None
    if subcategoria:
        _ns = NotificacionServicio.objects.filter(
            categoria=categoria,
            subcategoria=subcategoria,
            activo=True,
        ).first()
    if not _ns:
        _ns = NotificacionServicio.objects.filter(
            categoria=categoria,
            subcategoria__isnull=True,
            activo=True,
        ).first()
    if not _ns:
        _ns = NotificacionServicio.objects.filter(
            categoria__isnull=True,
            subcategoria__isnull=True,
            activo=True,
        ).first()
    ticket.asignado_a = _ns.usuarios.first() if (_ns and _ns.usuarios.exists()) else None

    ticket.save()
    try:
        notificar_nuevo_ticket(ticket, request)
    except Exception as _email_exc:
        import logging
        logging.getLogger(__name__).error(
            f"[ticket_create] Email notification failed for ticket #{ticket.pk}: {_email_exc}"
        )

    return 201, TicketOut(
        id=ticket.id,
        titulo=ticket.titulo,
        descripcion=ticket.descripcion,
        estado=ticket.estado,
        prioridad=ticket.prioridad,
        fecha_creacion=ticket.fecha_creacion,
        fecha_actualizacion=ticket.fecha_actualizacion,
        fecha_resolucion=ticket.fecha_resolucion,
        tipo_incidencia=ticket.tipo_incidencia,
        fue_reasignado=ticket.fue_reasignado,
        cuenta_id=ticket.cuenta_id,
        cuenta_nombre=ticket.cuenta.nombre if ticket.cuenta else None,
        creado_por_id=ticket.creado_por_id,
        creado_por_nombre=ticket.creado_por.nombre if ticket.creado_por else None,
        asignado_a_id=ticket.asignado_a_id,
        asignado_a_nombre=ticket.asignado_a.nombre if ticket.asignado_a else None,
        categoria_id=ticket.categoria_id,
        categoria_nombre=ticket.categoria.nombre if ticket.categoria else None,
        subcategoria_id=ticket.subcategoria_id,
        subcategoria_nombre=ticket.subcategoria.nombre if ticket.subcategoria else None,
        plataforma_bi=ticket.plataforma_bi or None,
    )


@api.put("/tickets/{ticket_id}/", response={200: TicketOut, 401: dict, 403: dict, 404: dict}, tags=["tickets"])
def ticket_edit(request: HttpRequest, ticket_id: int, data: TicketEditIn):
    """Edita un ticket. Solo admin puede editar."""
    if not _require_auth(request):
        return 401, {"detail": "No autenticado"}
    usuario = _get_user(request)
    if not usuario:
        return 401, {"detail": "No autenticado"}

    ticket = get_object_or_404(Ticket, pk=ticket_id)
    if not puede_ver_ticket(usuario, ticket):
        return 403, {"detail": "Sin acceso a este ticket"}
    if not usuario.es_admin:
        return 403, {"detail": "Solo Admin TI puede editar tickets"}
    if ticket.esta_cerrado:
        return 403, {"detail": "El ticket está cerrado y no puede modificarse"}

    responsable_anterior = ticket.asignado_a_id

    if data.titulo is not None:
        ticket.titulo = data.titulo
    if data.descripcion is not None:
        ticket.descripcion = data.descripcion
    if data.estado is not None:
        ticket.estado = data.estado
    if data.prioridad is not None:
        ticket.prioridad = data.prioridad
    if data.categoria_id is not None:
        ticket.categoria_id = data.categoria_id
    if data.subcategoria_id is not None:
        ticket.subcategoria_id = data.subcategoria_id
    if data.plataforma_bi is not None:
        ticket.plataforma_bi = data.plataforma_bi
    if data.asignado_a_id is not None:
        if data.asignado_a_id != responsable_anterior:
            ticket.fue_reasignado = True
        ticket.asignado_a_id = data.asignado_a_id

    ticket.save()
    ticket.refresh_from_db()

    return 200, TicketOut(
        id=ticket.id,
        titulo=ticket.titulo,
        descripcion=ticket.descripcion,
        estado=ticket.estado,
        prioridad=ticket.prioridad,
        fecha_creacion=ticket.fecha_creacion,
        fecha_actualizacion=ticket.fecha_actualizacion,
        fecha_resolucion=ticket.fecha_resolucion,
        tipo_incidencia=ticket.tipo_incidencia,
        fue_reasignado=ticket.fue_reasignado,
        cuenta_id=ticket.cuenta_id,
        cuenta_nombre=ticket.cuenta.nombre if ticket.cuenta else None,
        creado_por_id=ticket.creado_por_id,
        creado_por_nombre=ticket.creado_por.nombre if ticket.creado_por else None,
        asignado_a_id=ticket.asignado_a_id,
        asignado_a_nombre=ticket.asignado_a.nombre if ticket.asignado_a else None,
        categoria_id=ticket.categoria_id,
        categoria_nombre=ticket.categoria.nombre if ticket.categoria else None,
        subcategoria_id=ticket.subcategoria_id,
        subcategoria_nombre=ticket.subcategoria.nombre if ticket.subcategoria else None,
        plataforma_bi=ticket.plataforma_bi or None,
    )


@api.post("/tickets/{ticket_id}/cerrar/", response={200: TicketOut, 400: dict, 401: dict, 403: dict, 404: dict}, tags=["tickets"])
def ticket_cerrar(request: HttpRequest, ticket_id: int):
    """Cierra un ticket. Mirrors TicketCierreView logic."""
    if not _require_auth(request):
        return 401, {"detail": "No autenticado"}
    usuario = _get_user(request)
    if not usuario:
        return 401, {"detail": "No autenticado"}

    ticket = get_object_or_404(Ticket, pk=ticket_id)
    if ticket.esta_cerrado:
        return 400, {"detail": "El ticket ya está cerrado"}

    puede_cerrar = (
        usuario == ticket.creado_por
        or usuario.es_admin
        or (usuario.es_jefe and ticket.cuenta.jefe == usuario)
        or (usuario.es_supervisor and ticket.cuenta.supervisores.filter(pk=usuario.pk).exists())
    )
    if not puede_cerrar:
        return 403, {"detail": "Sin permiso para cerrar este ticket"}

    if usuario.es_admin and not ticket.comentarios.filter(autor=usuario).exists():
        return 400, {"detail": "No puedes cerrar el ticket sin haber escrito al menos un comentario"}

    ticket.cerrar()

    return 200, TicketOut(
        id=ticket.id,
        titulo=ticket.titulo,
        descripcion=ticket.descripcion,
        estado=ticket.estado,
        prioridad=ticket.prioridad,
        fecha_creacion=ticket.fecha_creacion,
        fecha_actualizacion=ticket.fecha_actualizacion,
        fecha_resolucion=ticket.fecha_resolucion,
        tipo_incidencia=ticket.tipo_incidencia,
        fue_reasignado=ticket.fue_reasignado,
        cuenta_id=ticket.cuenta_id,
        cuenta_nombre=ticket.cuenta.nombre if ticket.cuenta else None,
        creado_por_id=ticket.creado_por_id,
        creado_por_nombre=ticket.creado_por.nombre if ticket.creado_por else None,
        asignado_a_id=ticket.asignado_a_id,
        asignado_a_nombre=ticket.asignado_a.nombre if ticket.asignado_a else None,
        categoria_id=ticket.categoria_id,
        categoria_nombre=ticket.categoria.nombre if ticket.categoria else None,
        subcategoria_id=ticket.subcategoria_id,
        subcategoria_nombre=ticket.subcategoria.nombre if ticket.subcategoria else None,
        plataforma_bi=ticket.plataforma_bi or None,
    )


# ─── COMENTARIOS ─────────────────────────────────────────────────────────────

@api.post("/tickets/{ticket_id}/comentarios/", response={201: ComentarioOut, 400: dict, 401: dict, 403: dict, 404: dict}, tags=["comentarios"])
def comentario_agregar(request: HttpRequest, ticket_id: int, data: ComentarioIn):
    """Agrega un comentario a un ticket. Mirrors ComentarioAgregarView."""
    if not _require_auth(request):
        return 401, {"detail": "No autenticado"}
    usuario = _get_user(request)
    if not usuario:
        return 401, {"detail": "No autenticado"}

    ticket = get_object_or_404(Ticket, pk=ticket_id)
    if not puede_ver_ticket(usuario, ticket):
        return 403, {"detail": "Sin acceso a este ticket"}
    if ticket.esta_cerrado:
        return 403, {"detail": "No se pueden agregar comentarios a un ticket cerrado"}

    interno = data.interno
    if usuario.es_supervisor:
        interno = False  # supervisores no pueden crear comentarios internos

    comentario = Comentario.objects.create(
        ticket=ticket,
        autor=usuario,
        contenido=data.contenido,
        interno=interno,
    )
    ticket.save(update_fields=['fecha_actualizacion'])

    return 201, ComentarioOut(
        id=comentario.id,
        ticket_id=comentario.ticket_id,
        autor_id=comentario.autor_id,
        autor_nombre=comentario.autor.nombre,
        contenido=comentario.contenido,
        fecha=comentario.fecha,
        interno=comentario.interno,
    )


# ─── LOOKUPS ─────────────────────────────────────────────────────────────────

@api.get("/lookups/subcategorias/", response={200: SubcategoriasOut, 401: dict}, auth=None, tags=["lookups"])
def lookup_subcategorias(request: HttpRequest, categoria_id: str = ""):
    """Subcategorías activas de una categoría. Mirror SubcategoriasAjaxView."""
    # Note: auth=None here since the original view is LoginRequiredMixin but
    # the ninja API caller will have auth from the API-level auth.
    # We keep a manual jwt check for consistency:
    if not getattr(request, "jwt_payload", None):
        return 401, {"detail": "No autenticado"}

    if not categoria_id:
        return 200, SubcategoriasOut(subcategorias=[], requiere_bi=False)
    try:
        categoria = Categoria.objects.get(pk=categoria_id, activa=True)
    except Categoria.DoesNotExist:
        return 200, SubcategoriasOut(subcategorias=[], requiere_bi=False)

    subcats = list(
        Subcategoria.objects.filter(categoria=categoria, activa=True)
        .values('id', 'nombre')
        .order_by('nombre')
    )
    return 200, SubcategoriasOut(
        subcategorias=[{'id': s['id'], 'nombre': s['nombre']} for s in subcats],
        requiere_bi=categoria.requiere_plataforma_bi,
    )


@api.get("/lookups/sla/", response={200: SLALookupOut, 401: dict}, auth=None, tags=["lookups"])
def lookup_sla(request: HttpRequest, categoria_id: str = "", subcategoria_id: str = ""):
    """SLA aplicable. Mirror SLAAjaxView."""
    if not getattr(request, "jwt_payload", None):
        return 401, {"detail": "No autenticado"}

    if not categoria_id:
        return 200, SLALookupOut(tiene_sla=False)

    sla = None
    if subcategoria_id:
        sla = ConfiguracionSLA.objects.filter(
            categoria_id=categoria_id, subcategoria_id=subcategoria_id, activo=True
        ).first()
    if not sla:
        sla = ConfiguracionSLA.objects.filter(
            categoria_id=categoria_id, subcategoria__isnull=True, activo=True
        ).first()
    if not sla:
        return 200, SLALookupOut(tiene_sla=False)

    return 200, SLALookupOut(
        tiene_sla=True,
        respuesta=sla.tiempo_respuesta_display,
        cierre=sla.tiempo_cierre_display,
    )


@api.get("/lookups/categorias/", response={200: list[CategoriaLookupItem], 401: dict}, tags=["lookups"])
def lookup_categorias(request: HttpRequest):
    """Lista de categorías activas con sus subcategorías. Disponible para cualquier usuario autenticado."""
    if not _require_auth(request):
        return 401, {"detail": "No autenticado"}
    if not _get_user(request):
        return 401, {"detail": "No autenticado"}

    result = []
    for cat in Categoria.objects.prefetch_related('subcategorias').filter(activa=True).order_by('nombre'):
        subcats = [
            {'id': s.pk, 'nombre': s.nombre}
            for s in cat.subcategorias.filter(activa=True).order_by('nombre')
        ]
        result.append(CategoriaLookupItem(
            id=cat.pk,
            nombre=cat.nombre,
            slug=cat.slug,
            requiere_bi=cat.requiere_plataforma_bi,
            subcategorias=subcats,
        ))
    return 200, result


@api.get("/lookups/cuentas/", response={200: list[CuentaLookupItem], 401: dict}, tags=["lookups"])
def lookup_cuentas(request: HttpRequest):
    """Cuentas visibles para el usuario autenticado (para selección en formulario de ticket)."""
    if not _require_auth(request):
        return 401, {"detail": "No autenticado"}
    usuario = _get_user(request)
    if not usuario:
        return 401, {"detail": "No autenticado"}

    qs = cuentas_visibles(usuario).filter(activa=True).order_by('nombre')
    return 200, [
        CuentaLookupItem(id=c.pk, nombre=c.nombre)
        for c in qs
    ]


# ─── ADMIN: USUARIOS ─────────────────────────────────────────────────────────

@api.get("/usuarios/", response={200: list[UsuarioOut], 401: dict, 403: dict}, tags=["admin"])
def usuario_list(request: HttpRequest):
    """Lista todos los usuarios. Solo Admin."""
    if not _require_auth(request):
        return 401, {"detail": "No autenticado"}
    if not _require_admin(request):
        return 403, {"detail": "Solo Admin TI"}
    qs = Usuario.objects.prefetch_related('cuentas_asignadas').all().order_by('nombre')
    return 200, [
        UsuarioOut(
            id=u.id, nombre=u.nombre, email=u.email,
            rol=u.rol, activo=u.activo, fecha_creacion=u.fecha_creacion,
            cuentas_asignadas_ids=list(u.cuentas_asignadas.values_list('id', flat=True)),
        )
        for u in qs
    ]


@api.post("/usuarios/", response={201: UsuarioOut, 400: dict, 401: dict, 403: dict}, tags=["admin"])
def usuario_crear(request: HttpRequest, data: UsuarioIn):
    """Crea un usuario. Solo Admin."""
    if not _require_auth(request):
        return 401, {"detail": "No autenticado"}
    if not _require_admin(request):
        return 403, {"detail": "Solo Admin TI"}
    if Usuario.objects.filter(email=data.email).exists():
        return 400, {"detail": f"Ya existe un usuario con el email {data.email}"}
    u = Usuario.objects.create(
        nombre=data.nombre,
        email=data.email,
        username=data.email[:150],
        rol=data.rol,
        activo=data.activo,
    )
    u.set_unusable_password()
    u.save()
    return 201, UsuarioOut(
        id=u.id, nombre=u.nombre, email=u.email,
        rol=u.rol, activo=u.activo, fecha_creacion=u.fecha_creacion,
        cuentas_asignadas_ids=[],
    )


@api.put("/usuarios/{usuario_id}/", response={200: UsuarioOut, 401: dict, 403: dict, 404: dict}, tags=["admin"])
def usuario_editar(request: HttpRequest, usuario_id: int, data: UsuarioIn):
    """Edita un usuario. Solo Admin."""
    if not _require_auth(request):
        return 401, {"detail": "No autenticado"}
    if not _require_admin(request):
        return 403, {"detail": "Solo Admin TI"}
    u = get_object_or_404(Usuario, pk=usuario_id)
    u.nombre = data.nombre
    u.email = data.email
    u.username = data.email[:150]
    u.rol = data.rol
    u.activo = data.activo
    u.save()

    # Mirror UsuarioEditarForm.save() supervisor logic exactly:
    # When rol == 'supervisor', add/remove user from each active cuenta's supervisores.
    # When rol changed away from supervisor, remove from all cuentas.
    if u.rol == 'supervisor':
        cuentas_sel_ids = set(data.cuentas_asignadas_ids)
        for cuenta in Cuenta.objects.filter(activa=True):
            if cuenta.id in cuentas_sel_ids:
                cuenta.supervisores.add(u)
            else:
                cuenta.supervisores.remove(u)
    else:
        # Removed from supervisor role — strip from all cuentas
        for cuenta in u.cuentas_asignadas.all():
            cuenta.supervisores.remove(u)

    return 200, UsuarioOut(
        id=u.id, nombre=u.nombre, email=u.email,
        rol=u.rol, activo=u.activo, fecha_creacion=u.fecha_creacion,
        cuentas_asignadas_ids=list(u.cuentas_asignadas.values_list('id', flat=True)),
    )


@api.delete("/usuarios/{usuario_id}/", response={204: None, 401: dict, 403: dict, 404: dict}, tags=["admin"])
def usuario_eliminar(request: HttpRequest, usuario_id: int):
    """Elimina un usuario. Solo Admin."""
    if not _require_auth(request):
        return 401, {"detail": "No autenticado"}
    if not _require_admin(request):
        return 403, {"detail": "Solo Admin TI"}
    u = get_object_or_404(Usuario, pk=usuario_id)
    if u.pk == request.user.pk:
        return 403, {"detail": "No puedes eliminar tu propia cuenta"}
    u.delete()
    return 204, None


# ─── ADMIN: CUENTAS ──────────────────────────────────────────────────────────

@api.get("/cuentas/", response={200: list[CuentaOut], 401: dict, 403: dict}, tags=["admin"])
def cuenta_list(request: HttpRequest):
    """Lista cuentas visibles. Admin ve todas; Jefe ve las suyas."""
    if not _require_auth(request):
        return 401, {"detail": "No autenticado"}
    if not _require_admin_or_jefe(request):
        return 403, {"detail": "Solo Admin o Jefe de Cuenta"}
    usuario = _get_user(request)
    qs = cuentas_visibles(usuario).prefetch_related('supervisores')
    return 200, [
        CuentaOut(
            id=c.id, nombre=c.nombre, descripcion=c.descripcion,
            activa=c.activa, fecha_creacion=c.fecha_creacion,
            jefe_id=c.jefe_id,
            supervisor_ids=list(c.supervisores.values_list('id', flat=True)),
        )
        for c in qs
    ]


@api.post("/cuentas/", response={201: CuentaOut, 400: dict, 401: dict, 403: dict}, tags=["admin"])
def cuenta_crear(request: HttpRequest, data: CuentaIn):
    """Crea una cuenta. Solo Admin."""
    if not _require_auth(request):
        return 401, {"detail": "No autenticado"}
    if not _require_admin(request):
        return 403, {"detail": "Solo Admin TI"}
    if Cuenta.objects.filter(nombre=data.nombre).exists():
        return 400, {"detail": f"Ya existe una cuenta con el nombre {data.nombre}"}
    c = Cuenta.objects.create(
        nombre=data.nombre,
        descripcion=data.descripcion or '',
        activa=data.activa,
        jefe_id=data.jefe_id,
    )
    # Mirror CuentaForm: set supervisores M2M directly on the cuenta
    if data.supervisor_ids:
        c.supervisores.set(Usuario.objects.filter(pk__in=data.supervisor_ids, rol='supervisor'))
    return 201, CuentaOut(
        id=c.id, nombre=c.nombre, descripcion=c.descripcion,
        activa=c.activa, fecha_creacion=c.fecha_creacion,
        jefe_id=c.jefe_id,
        supervisor_ids=list(c.supervisores.values_list('id', flat=True)),
    )


@api.put("/cuentas/{cuenta_id}/", response={200: CuentaOut, 401: dict, 403: dict, 404: dict}, tags=["admin"])
def cuenta_editar(request: HttpRequest, cuenta_id: int, data: CuentaIn):
    """Edita una cuenta. Solo Admin."""
    if not _require_auth(request):
        return 401, {"detail": "No autenticado"}
    if not _require_admin(request):
        return 403, {"detail": "Solo Admin TI"}
    c = get_object_or_404(Cuenta, pk=cuenta_id)
    c.nombre = data.nombre
    c.descripcion = data.descripcion or ''
    c.activa = data.activa
    c.jefe_id = data.jefe_id
    c.save()
    # Mirror CuentaForm: set supervisores M2M directly on the cuenta
    c.supervisores.set(Usuario.objects.filter(pk__in=data.supervisor_ids, rol='supervisor'))
    return 200, CuentaOut(
        id=c.id, nombre=c.nombre, descripcion=c.descripcion,
        activa=c.activa, fecha_creacion=c.fecha_creacion,
        jefe_id=c.jefe_id,
        supervisor_ids=list(c.supervisores.values_list('id', flat=True)),
    )


@api.delete("/cuentas/{cuenta_id}/", response={204: None, 401: dict, 403: dict, 404: dict}, tags=["admin"])
def cuenta_eliminar(request: HttpRequest, cuenta_id: int):
    """Elimina una cuenta. Solo Admin."""
    if not _require_auth(request):
        return 401, {"detail": "No autenticado"}
    if not _require_admin(request):
        return 403, {"detail": "Solo Admin TI"}
    c = get_object_or_404(Cuenta, pk=cuenta_id)
    c.delete()
    return 204, None


# ─── ADMIN: NOTIFICACIONES ────────────────────────────────────────────────────

@api.get("/notificaciones/", response={200: list[NotificacionOut], 401: dict, 403: dict}, tags=["admin"])
def notificacion_list(request: HttpRequest):
    """Lista notificaciones de servicio. Solo Admin."""
    if not _require_auth(request):
        return 401, {"detail": "No autenticado"}
    if not _require_admin(request):
        return 403, {"detail": "Solo Admin TI"}
    qs = NotificacionServicio.objects.prefetch_related('usuarios').all()
    return 200, [
        NotificacionOut(
            id=n.id,
            categoria_id=n.categoria_id,
            subcategoria_id=n.subcategoria_id,
            servicio=n.servicio,
            emails_cc=n.emails_cc,
            activo=n.activo,
            clasificacion_display=n.clasificacion_display,
            usuario_ids=list(n.usuarios.values_list('id', flat=True)),
        )
        for n in qs
    ]


@api.post("/notificaciones/", response={201: NotificacionOut, 401: dict, 403: dict}, tags=["admin"])
def notificacion_crear(request: HttpRequest, data: NotificacionIn):
    """Crea una notificación de servicio. Solo Admin."""
    if not _require_auth(request):
        return 401, {"detail": "No autenticado"}
    if not _require_admin(request):
        return 403, {"detail": "Solo Admin TI"}
    n = NotificacionServicio.objects.create(
        categoria_id=data.categoria_id,
        subcategoria_id=data.subcategoria_id,
        servicio=data.servicio,
        emails_cc=data.emails_cc,
        activo=data.activo,
    )
    if data.usuario_ids:
        n.usuarios.set(Usuario.objects.filter(pk__in=data.usuario_ids))
    return 201, NotificacionOut(
        id=n.id,
        categoria_id=n.categoria_id,
        subcategoria_id=n.subcategoria_id,
        servicio=n.servicio,
        emails_cc=n.emails_cc,
        activo=n.activo,
        clasificacion_display=n.clasificacion_display,
        usuario_ids=list(n.usuarios.values_list('id', flat=True)),
    )


@api.put("/notificaciones/{notif_id}/", response={200: NotificacionOut, 401: dict, 403: dict, 404: dict}, tags=["admin"])
def notificacion_editar(request: HttpRequest, notif_id: int, data: NotificacionIn):
    """Edita una notificación de servicio. Solo Admin."""
    if not _require_auth(request):
        return 401, {"detail": "No autenticado"}
    if not _require_admin(request):
        return 403, {"detail": "Solo Admin TI"}
    n = get_object_or_404(NotificacionServicio, pk=notif_id)
    n.categoria_id = data.categoria_id
    n.subcategoria_id = data.subcategoria_id
    n.servicio = data.servicio
    n.emails_cc = data.emails_cc
    n.activo = data.activo
    n.save()
    if data.usuario_ids is not None:
        n.usuarios.set(Usuario.objects.filter(pk__in=data.usuario_ids))
    return 200, NotificacionOut(
        id=n.id,
        categoria_id=n.categoria_id,
        subcategoria_id=n.subcategoria_id,
        servicio=n.servicio,
        emails_cc=n.emails_cc,
        activo=n.activo,
        clasificacion_display=n.clasificacion_display,
        usuario_ids=list(n.usuarios.values_list('id', flat=True)),
    )


@api.delete("/notificaciones/{notif_id}/", response={204: None, 401: dict, 403: dict, 404: dict}, tags=["admin"])
def notificacion_eliminar(request: HttpRequest, notif_id: int):
    """Elimina una notificación de servicio. Solo Admin."""
    if not _require_auth(request):
        return 401, {"detail": "No autenticado"}
    if not _require_admin(request):
        return 403, {"detail": "Solo Admin TI"}
    n = get_object_or_404(NotificacionServicio, pk=notif_id)
    n.delete()
    return 204, None


# ─── ADMIN: SLA ───────────────────────────────────────────────────────────────

@api.get("/sla/", response={200: list[SLAOut], 401: dict, 403: dict}, tags=["admin"])
def sla_list(request: HttpRequest):
    """Lista configuraciones SLA. Solo Admin."""
    if not _require_auth(request):
        return 401, {"detail": "No autenticado"}
    if not _require_admin(request):
        return 403, {"detail": "Solo Admin TI"}
    qs = ConfiguracionSLA.objects.select_related('categoria', 'subcategoria').all()
    return 200, [
        SLAOut(
            id=s.id,
            categoria_id=s.categoria_id,
            categoria_nombre=s.categoria.nombre if s.categoria else None,
            subcategoria_id=s.subcategoria_id,
            subcategoria_nombre=s.subcategoria.nombre if s.subcategoria else None,
            plataforma_bi=s.plataforma_bi,
            tiempo_respuesta_minutos=s.tiempo_respuesta_minutos,
            tiempo_cierre_minutos=s.tiempo_cierre_minutos,
            descripcion=s.descripcion,
            activo=s.activo,
            tiempo_respuesta_display=s.tiempo_respuesta_display,
            tiempo_cierre_display=s.tiempo_cierre_display,
        )
        for s in qs
    ]


@api.post("/sla/", response={201: SLAOut, 400: dict, 401: dict, 403: dict}, tags=["admin"])
def sla_crear(request: HttpRequest, data: SLAIn):
    """Crea una configuración SLA. Solo Admin."""
    if not _require_auth(request):
        return 401, {"detail": "No autenticado"}
    if not _require_admin(request):
        return 403, {"detail": "Solo Admin TI"}
    s = ConfiguracionSLA.objects.create(
        categoria_id=data.categoria_id,
        subcategoria_id=data.subcategoria_id,
        plataforma_bi=data.plataforma_bi or '',
        tiempo_respuesta_minutos=data.tiempo_respuesta_minutos,
        tiempo_cierre_minutos=data.tiempo_cierre_minutos,
        descripcion=data.descripcion,
        activo=data.activo,
    )
    return 201, SLAOut(
        id=s.id,
        categoria_id=s.categoria_id,
        categoria_nombre=s.categoria.nombre if s.categoria else None,
        subcategoria_id=s.subcategoria_id,
        subcategoria_nombre=s.subcategoria.nombre if s.subcategoria else None,
        plataforma_bi=s.plataforma_bi or None,
        tiempo_respuesta_minutos=s.tiempo_respuesta_minutos,
        tiempo_cierre_minutos=s.tiempo_cierre_minutos,
        descripcion=s.descripcion,
        activo=s.activo,
        tiempo_respuesta_display=s.tiempo_respuesta_display,
        tiempo_cierre_display=s.tiempo_cierre_display,
    )


@api.put("/sla/{sla_id}/", response={200: SLAOut, 401: dict, 403: dict, 404: dict}, tags=["admin"])
def sla_editar(request: HttpRequest, sla_id: int, data: SLAIn):
    """Edita una configuración SLA. Solo Admin."""
    if not _require_auth(request):
        return 401, {"detail": "No autenticado"}
    if not _require_admin(request):
        return 403, {"detail": "Solo Admin TI"}
    s = get_object_or_404(ConfiguracionSLA, pk=sla_id)
    s.categoria_id = data.categoria_id
    s.subcategoria_id = data.subcategoria_id
    s.plataforma_bi = data.plataforma_bi or ''
    s.tiempo_respuesta_minutos = data.tiempo_respuesta_minutos
    s.tiempo_cierre_minutos = data.tiempo_cierre_minutos
    s.descripcion = data.descripcion
    s.activo = data.activo
    s.save()
    s.refresh_from_db()
    return 200, SLAOut(
        id=s.id,
        categoria_id=s.categoria_id,
        categoria_nombre=s.categoria.nombre if s.categoria else None,
        subcategoria_id=s.subcategoria_id,
        subcategoria_nombre=s.subcategoria.nombre if s.subcategoria else None,
        plataforma_bi=s.plataforma_bi or None,
        tiempo_respuesta_minutos=s.tiempo_respuesta_minutos,
        tiempo_cierre_minutos=s.tiempo_cierre_minutos,
        descripcion=s.descripcion,
        activo=s.activo,
        tiempo_respuesta_display=s.tiempo_respuesta_display,
        tiempo_cierre_display=s.tiempo_cierre_display,
    )


@api.delete("/sla/{sla_id}/", response={204: None, 401: dict, 403: dict, 404: dict}, tags=["admin"])
def sla_eliminar(request: HttpRequest, sla_id: int):
    """Elimina una configuración SLA. Solo Admin."""
    if not _require_auth(request):
        return 401, {"detail": "No autenticado"}
    if not _require_admin(request):
        return 403, {"detail": "Solo Admin TI"}
    s = get_object_or_404(ConfiguracionSLA, pk=sla_id)
    s.delete()
    return 204, None


# ─── AVISOS TI ─────────────────────────────────────────────────────────────────

@api.get("/avisos/", response={200: list[AvisoTIOut], 401: dict}, tags=["avisos"])
def avisos_list(request: HttpRequest):
    """Lista avisos activos y vigentes (no expirados). Visible para todos los usuarios autenticados."""
    if not _require_auth(request):
        return 401, {"detail": "No autenticado"}
    ahora = timezone.now()
    qs = AvisoTI.objects.select_related('creado_por').filter(
        activo=True,
        expira_en__gt=ahora,
    ).order_by('-fecha_creacion')
    return 200, [
        AvisoTIOut(
            id=a.id,
            tipo=a.tipo,
            contenido=a.contenido,
            creado_por_nombre=a.creado_por.nombre if a.creado_por else None,
            fecha_creacion=a.fecha_creacion,
            expira_en=a.expira_en,
            activo=a.activo,
        )
        for a in qs
    ]


@api.post("/avisos/", response={201: AvisoTIOut, 400: dict, 401: dict, 403: dict}, tags=["avisos"])
def avisos_crear(request: HttpRequest, data: AvisoTIIn):
    """Crea un nuevo aviso TI. Solo Admin TI."""
    if not _require_auth(request):
        return 401, {"detail": "No autenticado"}
    if not _require_admin(request):
        return 403, {"detail": "Solo Admin TI puede publicar avisos"}
    usuario = _get_user(request)
    if not data.contenido.strip():
        return 400, {"detail": "El contenido no puede estar vacío"}
    if len(data.contenido) > 500:
        return 400, {"detail": "El contenido no puede superar los 500 caracteres"}
    tipos_validos = ['info', 'advertencia', 'critico', 'resolucion']
    if data.tipo not in tipos_validos:
        return 400, {"detail": f"Tipo inválido. Use: {', '.join(tipos_validos)}"}

    aviso = AvisoTI.objects.create(
        tipo=data.tipo,
        contenido=data.contenido.strip(),
        creado_por=usuario,
        expira_en=timezone.now() + timedelta(hours=24),
    )
    return 201, AvisoTIOut(
        id=aviso.id,
        tipo=aviso.tipo,
        contenido=aviso.contenido,
        creado_por_nombre=usuario.nombre if usuario else None,
        fecha_creacion=aviso.fecha_creacion,
        expira_en=aviso.expira_en,
        activo=aviso.activo,
    )


@api.delete("/avisos/{aviso_id}/", response={204: None, 401: dict, 403: dict, 404: dict}, tags=["avisos"])
def avisos_eliminar(request: HttpRequest, aviso_id: int):
    """Elimina (desactiva) un aviso TI. Solo Admin TI."""
    if not _require_auth(request):
        return 401, {"detail": "No autenticado"}
    if not _require_admin(request):
        return 403, {"detail": "Solo Admin TI puede eliminar avisos"}
    aviso = get_object_or_404(AvisoTI, pk=aviso_id)
    aviso.activo = False
    aviso.save(update_fields=['activo'])
    return 204, None

