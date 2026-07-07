"""
InciTrack - Views v2
Nuevas vistas: AJAX subcategorías, Configuración SLA (solo superusuario)
"""
import base64
import uuid
import os
import logging
from datetime import timedelta

from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib import messages
from django.core.exceptions import PermissionDenied
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import render, redirect, get_object_or_404
from django.utils import timezone
from django.views import View
from django.views.generic import ListView

from .models import (
    Ticket, Cuenta, Usuario, Adjunto, Comentario,
    NotificacionServicio, Categoria, Subcategoria, ConfiguracionSLA,
)
from .forms import (
    TicketNuevoForm, TicketEditarForm, ComentarioForm,
    CuentaForm, UsuarioCrearForm, UsuarioEditarForm,
    NotificacionServicioForm, ConfiguracionSLAForm,
)
from .mixins import (
    SoloAdminMixin, AdminOJefeMixin,
    TicketAccesoMixin, TicketModificableMixin,
    tickets_visibles, cuentas_visibles,
)
from .email_service import notificar_nuevo_ticket

logger = logging.getLogger(__name__)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _guardar_adjunto(ticket, archivo):
    nombre_original = archivo.name
    ext = os.path.splitext(nombre_original)[1]
    nombre_guardado = f"{uuid.uuid4().hex}{ext}"
    Adjunto.objects.create(
        ticket=ticket,
        nombre_original=nombre_original,
        nombre_guardado=nombre_guardado,
        archivo=archivo,
    )


def _guardar_screenshot(ticket, data_url):
    try:
        if ',' not in data_url:
            return
        header, data = data_url.split(',', 1)
        ext = 'jpg' if ('jpeg' in header or 'jpg' in header) else 'png'
        nombre = f"screenshot_{uuid.uuid4().hex}.{ext}"
        from django.core.files.base import ContentFile
        content = ContentFile(base64.b64decode(data), name=nombre)
        adj = Adjunto(
            ticket=ticket,
            nombre_original=f"captura_pantalla.{ext}",
            nombre_guardado=nombre,
        )
        adj.archivo.save(nombre, content, save=True)
    except Exception as e:
        logger.error(f"Error guardando screenshot: {e}")


def _solo_superusuario(request):
    """Lanza PermissionDenied si el usuario no es superusuario."""
    if not request.user.is_superuser:
        raise PermissionDenied("Esta sección es solo para el superusuario.")


# ── AJAX: Subcategorías ───────────────────────────────────────────────────────

class SubcategoriasAjaxView(LoginRequiredMixin, View):
    """
    GET /ajax/subcategorias/?categoria_id=<id>
    Retorna JSON con las subcategorías activas de la categoría solicitada.
    También indica si la categoría requiere plataforma_bi.
    """
    def get(self, request):
        cat_id = request.GET.get('categoria_id', '')
        if not cat_id:
            return JsonResponse({'subcategorias': [], 'requiere_bi': False})
        try:
            categoria = Categoria.objects.get(pk=cat_id, activa=True)
        except Categoria.DoesNotExist:
            return JsonResponse({'subcategorias': [], 'requiere_bi': False})

        subcats = list(
            Subcategoria.objects.filter(categoria=categoria, activa=True)
            .values('id', 'nombre')
            .order_by('nombre')
        )
        return JsonResponse({
            'subcategorias':  subcats,
            'requiere_bi':    categoria.requiere_plataforma_bi,
        })


# ── Dashboard ─────────────────────────────────────────────────────────────────

class DashboardView(LoginRequiredMixin, View):
    template_name = 'tickets/dashboard.html'

    def get(self, request):
        usuario   = request.user
        ahora     = timezone.now()
        qs        = tickets_visibles(usuario)
        periodo   = request.GET.get('periodo', '')
        ver_todos = request.GET.get('ver_todos', '0') == '1'

        # ── Admin TI: por defecto solo sus tickets asignados ──
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
        elif periodo == 'este_año':
            qs_filtrado = qs.filter(fecha_creacion__year=ahora.year)

        limite_48h = ahora - timedelta(hours=48)
        limite_20h = ahora - timedelta(hours=20)
        limite_24h = ahora - timedelta(hours=24)
        por_cerrar = qs.filter(
            estado__in=['abierto', 'en_proceso'],
            fecha_actualizacion__lte=limite_20h,
            fecha_actualizacion__gte=limite_24h,
        ).count()

        ahora_local = timezone.localtime(ahora)

        return render(request, self.template_name, {
            'total_filtrado':    qs_filtrado.count(),
            'periodo_activo':    periodo,
            'abiertos':          qs.filter(estado='abierto').count(),
            'en_proceso':        qs.filter(estado='en_proceso').count(),
            'resueltos':         qs.filter(estado='resuelto').count(),
            'cerrados':          qs.filter(estado='cerrado').count(),
            'cerrados_48h':      qs.filter(estado='cerrado', fecha_resolucion__gte=limite_48h).count(),
            'por_cerrar':        por_cerrar,
            'tickets_hoy':       qs.filter(fecha_creacion__date=ahora_local.date()).count(),
            'sin_asignar':       qs.filter(estado__in=['abierto','en_proceso'], asignado_a__isnull=True).count(),
            'tickets_recientes': list(qs.values(
                'id','titulo','estado','fecha_creacion','fue_reasignado','tipo_incidencia',
                'cuenta__nombre','creado_por__nombre',
                'asignado_a__nombre','asignado_a__id',
                'categoria__nombre','subcategoria__nombre',
                'plataforma_bi',
            )[:10]),
            'ahora':             ahora_local,
            'solo_mis_tickets':  solo_mis_tickets,
            'ver_todos':         ver_todos,
        })


# ── Lista / Resumen de Tickets ────────────────────────────────────────────────

class TicketListaView(LoginRequiredMixin, View):
    template_name = 'tickets/ticket_lista.html'

    def get(self, request):
        ver_todos = request.GET.get('ver_todos', '0') == '1'
        qs = tickets_visibles(request.user).prefetch_related(
            'cuenta', 'creado_por', 'asignado_a', 'categoria', 'subcategoria'
        )

        # ── Admin TI: por defecto solo sus tickets asignados ──
        solo_mis_tickets = request.user.es_admin and not ver_todos
        if solo_mis_tickets:
            qs = qs.filter(asignado_a=request.user)

        # ── Supervisor / Jefe: solo los tickets que ellos crearon ──
        if not request.user.es_admin:
            qs = qs.filter(creado_por=request.user)
        estado       = request.GET.get('estado', '')
        categoria    = request.GET.get('categoria', '')
        servicio     = request.GET.get('servicio', '')   # legacy
        busqueda     = request.GET.get('q', '')
        cuenta_id    = request.GET.get('cuenta', '')
        periodo      = request.GET.get('periodo', '')
        desde        = request.GET.get('desde', '')
        hasta        = request.GET.get('hasta', '')
        por_cerrar   = request.GET.get('por_cerrar', '')
        responsable  = request.GET.get('responsable', '')

        if estado:
            qs = qs.filter(estado=estado)
        if categoria:
            qs = qs.filter(categoria_id=categoria)
        if servicio:
            qs = qs.filter(tipo_incidencia__icontains=servicio)
        if busqueda:
            qs = qs.filter(Q(titulo__icontains=busqueda) | Q(descripcion__icontains=busqueda))
        if cuenta_id:
            qs = qs.filter(cuenta_id=cuenta_id)
        if responsable:
            qs = qs.filter(asignado_a_id=responsable)
        if por_cerrar:
            ahora = timezone.now()
            qs = qs.filter(
                estado__in=['abierto', 'en_proceso'],
                fecha_actualizacion__lte=ahora - timedelta(hours=20),
                fecha_actualizacion__gte=ahora - timedelta(hours=24),
            )

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

        return render(request, self.template_name, {
            'tickets':             qs,
            'total':               qs.count(),
            'estado_activo':       estado,
            'categoria_activa':    categoria,
            'servicio_activo':     servicio,
            'busqueda':            busqueda,
            'cuenta_activa':       cuenta_id,
            'periodo_activo':      periodo,
            'desde_activo':        desde,
            'hasta_activo':        hasta,
            'por_cerrar_activo':   bool(por_cerrar),
            'responsable_activo':  responsable,
            'cuentas_disponibles': cuentas_visibles(request.user).filter(activa=True),
            'categorias':          Categoria.objects.filter(activa=True),
            'admins_ti':           Usuario.objects.filter(rol='admin', activo=True).order_by('nombre'),
            'solo_mis_tickets':    solo_mis_tickets,
            'ver_todos':           ver_todos,
        })


# ── Nuevo Ticket ──────────────────────────────────────────────────────────────

class TicketNuevoView(LoginRequiredMixin, View):
    template_name = 'tickets/ticket_nuevo.html'

    def get(self, request):
        form = TicketNuevoForm(usuario=request.user)
        return render(request, self.template_name, {
            'form': form,
            'categorias_json': _categorias_json(),
        })

    def post(self, request):
        form = TicketNuevoForm(request.POST, request.FILES, usuario=request.user)
        if form.is_valid():
            ticket            = form.save(commit=False)
            ticket.creado_por = request.user
            # tipo_incidencia vacío para tickets nuevos (usan categoria/subcategoria)
            ticket.tipo_incidencia = ''

            # ── Auto-asignar responsable TI desde NotificacionServicio ──────────
            # Misma precedencia que el email_service: subcategoria > categoria > global
            _ns = None
            if ticket.subcategoria:
                _ns = NotificacionServicio.objects.filter(
                    categoria=ticket.categoria,
                    subcategoria=ticket.subcategoria,
                    activo=True,
                ).first()
            if not _ns:
                _ns = NotificacionServicio.objects.filter(
                    categoria=ticket.categoria,
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
            # ────────────────────────────────────────────────────────────────────

            ticket.save()
            for i in range(1, 4):
                f = request.FILES.get(f'adjunto_{i}')
                if f:
                    _guardar_adjunto(ticket, f)
            screenshot = form.cleaned_data.get('screenshot_data', '')
            if screenshot:
                _guardar_screenshot(ticket, screenshot)
            notificar_nuevo_ticket(ticket, request)
            messages.success(request, f"Ticket #{ticket.pk} creado exitosamente.")
            return redirect('ticket_detalle', pk=ticket.pk)
        return render(request, self.template_name, {
            'form': form,
            'categorias_json': _categorias_json(),
        })



def _categorias_json():
    """Serializa categorías y subcategorías para el JS del formulario."""
    import json
    data = {}
    for cat in Categoria.objects.prefetch_related('subcategorias'):
        data[str(cat.pk)] = {
            'slug': cat.slug,
            'requiere_bi': cat.requiere_plataforma_bi,
            'subcategorias': [
                {'id': s.pk, 'nombre': s.nombre, 'slug': s.slug}
                for s in cat.subcategorias.filter(activa=True).order_by('nombre')
            ],
        }
    return json.dumps(data)


# ── Detalle de Ticket ─────────────────────────────────────────────────────────

class TicketDetalleView(TicketAccesoMixin, View):
    template_name = 'tickets/ticket_detalle.html'

    def get(self, request, pk):
        ticket      = self.get_ticket()
        comentarios = ticket.comentarios.prefetch_related('autor').all()
        # Comentarios internos: solo visibles para Admin TI
        if not request.user.es_admin:
            comentarios = comentarios.filter(interno=False)

        form_comentario = ComentarioForm(usuario=request.user)
        form_editar = None
        if not ticket.esta_cerrado and request.user.es_admin:
            form_editar = TicketEditarForm(instance=ticket, usuario=request.user)

        return render(request, self.template_name, {
            'ticket':          ticket,
            'comentarios':     comentarios,
            'form_comentario': form_comentario,
            'form_editar':     form_editar,
            'puede_modificar': ticket.puede_modificar(request.user),
        })


# ── Editar / Cerrar Ticket ────────────────────────────────────────────────────

class TicketEditarView(TicketModificableMixin, View):
    def post(self, request, pk):
        ticket = self.get_ticket()
        if not request.user.es_admin:
            raise PermissionDenied
            
        responsable_anterior = ticket.asignado_a
        
        form = TicketEditarForm(request.POST, instance=ticket, usuario=request.user)
        if form.is_valid():
            ticket_modificado = form.save(commit=False)
            if ticket_modificado.asignado_a != responsable_anterior:
                ticket_modificado.fue_reasignado = True
            ticket_modificado.save()
            messages.success(request, f"Ticket #{pk} actualizado correctamente.")
        else:
            logger.warning(f"TicketEditarForm inválido pk={pk}: {form.errors}")
            messages.error(request, f"Error al guardar: {form.errors.as_text()}")
        return redirect('ticket_detalle', pk=pk)


class TicketCierreView(LoginRequiredMixin, View):
    def post(self, request, pk):
        ticket = get_object_or_404(Ticket, pk=pk)
        if ticket.esta_cerrado:
            messages.warning(request, "El ticket ya está cerrado.")
            return redirect('ticket_detalle', pk=pk)
            
        puede_cerrar = (
            request.user == ticket.creado_por
            or request.user.es_admin
            or (request.user.es_jefe and ticket.cuenta.jefe == request.user)
            or (request.user.es_supervisor
                and ticket.cuenta.supervisores.filter(pk=request.user.pk).exists())
        )
        if not puede_cerrar:
            raise PermissionDenied
            
        # Validación extra: ningún admin puede cerrar un ticket sin haber escrito un comentario antes
        if request.user.es_admin and not ticket.comentarios.filter(autor=request.user).exists():
            messages.error(request, "No puedes cerrar el ticket sin haber escrito al menos un comentario.")
            return redirect('ticket_detalle', pk=pk)
            
        ticket.cerrar()
        messages.success(request, f"Ticket #{pk} cerrado correctamente.")
        return redirect('ticket_detalle', pk=pk)


# ── Comentarios ───────────────────────────────────────────────────────────────

class ComentarioAgregarView(TicketModificableMixin, View):
    def post(self, request, pk):
        ticket = self.get_ticket()
        form   = ComentarioForm(request.POST, usuario=request.user)
        if form.is_valid():
            com        = form.save(commit=False)
            com.ticket = ticket
            com.autor  = request.user
            if request.user.es_supervisor:
                com.interno = False
            com.save()
            ticket.save(update_fields=['fecha_actualizacion'])
            messages.success(request, "Comentario agregado.")
        else:
            messages.error(request, "Error al agregar el comentario.")
        return redirect('ticket_detalle', pk=pk)


# ── Admin: Usuarios ───────────────────────────────────────────────────────────

class UsuarioListaView(SoloAdminMixin, ListView):
    model               = Usuario
    template_name       = 'tickets/admin/usuario_lista.html'
    context_object_name = 'usuarios'
    ordering            = ['nombre']


class UsuarioCrearView(SoloAdminMixin, View):
    template_name = 'tickets/admin/usuario_form.html'

    def get(self, request):
        return render(request, self.template_name, {'form': UsuarioCrearForm()})

    def post(self, request):
        form = UsuarioCrearForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, "Usuario creado.")
            return redirect('usuario_lista')
        return render(request, self.template_name, {'form': form})


class UsuarioEditarView(SoloAdminMixin, View):
    template_name = 'tickets/admin/usuario_form.html'

    def get(self, request, pk):
        u = get_object_or_404(Usuario, pk=pk)
        return render(request, self.template_name, {'form': UsuarioEditarForm(instance=u), 'objeto': u})

    def post(self, request, pk):
        u    = get_object_or_404(Usuario, pk=pk)
        form = UsuarioEditarForm(request.POST, instance=u)
        if form.is_valid():
            form.save()
            messages.success(request, "Usuario actualizado.")
            return redirect('usuario_lista')
        return render(request, self.template_name, {'form': form, 'objeto': u})


class UsuarioEliminarView(SoloAdminMixin, View):
    def post(self, request, pk):
        from django.db.models.deletion import ProtectedError
        u = get_object_or_404(Usuario, pk=pk)
        if u.pk == request.user.pk:
            messages.error(request, "No puedes eliminar tu propia cuenta.")
            return redirect('usuario_lista')
        if u.is_superuser:
            messages.error(request, "No se puede eliminar al superusuario.")
            return redirect('usuario_lista')
        if u.email == 'mauriciocaceres@in-touchcrm.cl':
            messages.error(request, "Este usuario está protegido y no puede ser eliminado.")
            return redirect('usuario_lista')
        nombre = u.nombre
        try:
            u.delete()
            messages.success(request, f"Usuario '{nombre}' eliminado correctamente.")
        except ProtectedError:
            messages.error(
                request,
                f"No se puede eliminar a '{nombre}' porque tiene tickets o comentarios asociados. "
                "Reasigna o elimina esos registros antes de borrar el usuario."
            )
        return redirect('usuario_lista')


# ── Admin: Cuentas ────────────────────────────────────────────────────────────

class CuentaListaView(AdminOJefeMixin, ListView):
    model               = Cuenta
    template_name       = 'tickets/admin/cuenta_lista.html'
    context_object_name = 'cuentas'

    def get_queryset(self):
        return cuentas_visibles(self.request.user)


class CuentaCrearView(SoloAdminMixin, View):
    template_name = 'tickets/admin/cuenta_form.html'

    def get(self, request):
        return render(request, self.template_name, {'form': CuentaForm()})

    def post(self, request):
        form = CuentaForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, "Cuenta creada.")
            return redirect('cuenta_lista')
        return render(request, self.template_name, {'form': form})


class CuentaEditarView(SoloAdminMixin, View):
    template_name = 'tickets/admin/cuenta_form.html'

    def get(self, request, pk):
        c = get_object_or_404(Cuenta, pk=pk)
        return render(request, self.template_name, {'form': CuentaForm(instance=c), 'objeto': c})

    def post(self, request, pk):
        c    = get_object_or_404(Cuenta, pk=pk)
        form = CuentaForm(request.POST, instance=c)
        if form.is_valid():
            form.save()
            messages.success(request, "Cuenta actualizada.")
            return redirect('cuenta_lista')
        return render(request, self.template_name, {'form': form, 'objeto': c})


# ── Admin: Notificaciones ─────────────────────────────────────────────────────

class NotificacionListaView(SoloAdminMixin, ListView):
    model               = NotificacionServicio
    template_name       = 'tickets/admin/notificacion_lista.html'
    context_object_name = 'notificaciones'


class NotificacionFormView(SoloAdminMixin, View):
    template_name = 'tickets/admin/notificacion_form.html'

    def _obj(self, pk):
        return get_object_or_404(NotificacionServicio, pk=pk) if pk else None

    def get(self, request, pk=None):
        obj = self._obj(pk)
        return render(request, self.template_name, {
            'form': NotificacionServicioForm(instance=obj),
            'objeto': obj,
            'categorias_json': _categorias_json(),
        })

    def post(self, request, pk=None):
        obj  = self._obj(pk)
        form = NotificacionServicioForm(request.POST, instance=obj)
        if form.is_valid():
            form.save()
            messages.success(request, "Notificación guardada.")
            return redirect('notificacion_lista')
        return render(request, self.template_name, {
            'form': form,
            'objeto': obj,
            'categorias_json': _categorias_json(),
        })


class NotificacionServicioEliminarView(SoloAdminMixin, View):
    def post(self, request, pk):
        from django.db.models import ProtectedError
        obj = get_object_or_404(NotificacionServicio, pk=pk)
        try:
            obj.delete()
            messages.success(request, f"Notificación eliminada correctamente.")
        except ProtectedError:
            messages.error(request, "No se puede eliminar esta notificación porque tiene registros dependientes.")
        except Exception as e:
            messages.error(request, f"Ocurrió un error al eliminar: {e}")
        return redirect('notificacion_lista')


# ══════════════════════════════════════════════════════════════════════════════
# CONFIGURACIÓN SLA — Solo superusuario
# ══════════════════════════════════════════════════════════════════════════════



class SLAAjaxView(LoginRequiredMixin, View):
    """
    GET /ajax/sla/?categoria_id=<id>&subcategoria_id=<id>
    Retorna el SLA aplicable para mostrar hint en el formulario de nuevo ticket.
    Precedencia: subcategoria > categoria general.
    """
    def get(self, request):
        cat_id = request.GET.get('categoria_id', '')
        sub_id = request.GET.get('subcategoria_id', '')
        if not cat_id:
            return JsonResponse({'tiene_sla': False})
        sla = None
        # Buscar SLA específico por subcategoría
        if sub_id:
            sla = ConfiguracionSLA.objects.filter(
                categoria_id=cat_id, subcategoria_id=sub_id, activo=True
            ).first()
        # Fallback: SLA general de la categoría
        if not sla:
            sla = ConfiguracionSLA.objects.filter(
                categoria_id=cat_id, subcategoria__isnull=True, activo=True
            ).first()
        if not sla:
            return JsonResponse({'tiene_sla': False})
        return JsonResponse({
            'tiene_sla': True,
            'respuesta': sla.tiempo_respuesta_display,
            'cierre':    sla.tiempo_cierre_display,
        })

class SLAListaView(LoginRequiredMixin, View):
    """Tabla editable de SLAs. Solo superusuario."""
    template_name = 'tickets/sla/sla_lista.html'

    def get(self, request):
        _solo_superusuario(request)
        slas       = ConfiguracionSLA.objects.prefetch_related(
            'categoria', 'subcategoria'
        ).order_by('categoria__orden', 'categoria__nombre', 'subcategoria__nombre')
        categorias = Categoria.objects.filter(activa=True)
        return render(request, self.template_name, {
            'slas':       slas,
            'categorias': categorias,
        })


class SLACrearView(LoginRequiredMixin, View):
    template_name = 'tickets/sla/sla_form.html'

    def get(self, request):
        _solo_superusuario(request)
        return render(request, self.template_name, {
            'form':   ConfiguracionSLAForm(),
            'titulo': 'Nuevo SLA',
        })

    def post(self, request):
        _solo_superusuario(request)
        form = ConfiguracionSLAForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, "Configuración SLA creada correctamente.")
            return redirect('sla_lista')
        return render(request, self.template_name, {'form': form, 'titulo': 'Nuevo SLA'})


class SLAEditarView(LoginRequiredMixin, View):
    template_name = 'tickets/sla/sla_form.html'

    def get(self, request, pk):
        _solo_superusuario(request)
        sla = get_object_or_404(ConfiguracionSLA, pk=pk)
        return render(request, self.template_name, {
            'form':   ConfiguracionSLAForm(instance=sla),
            'objeto': sla,
            'titulo': f'Editar SLA — {sla.categoria.nombre}',
        })

    def post(self, request, pk):
        _solo_superusuario(request)
        sla  = get_object_or_404(ConfiguracionSLA, pk=pk)
        form = ConfiguracionSLAForm(request.POST, instance=sla)
        if form.is_valid():
            form.save()
            messages.success(request, "SLA actualizado correctamente.")
            return redirect('sla_lista')
        return render(request, self.template_name, {
            'form':   form,
            'objeto': sla,
            'titulo': f'Editar SLA — {sla.categoria.nombre}',
        })


class SLAEliminarView(LoginRequiredMixin, View):
    def post(self, request, pk):
        _solo_superusuario(request)
        sla = get_object_or_404(ConfiguracionSLA, pk=pk)
        nombre = str(sla)
        sla.delete()
        messages.success(request, f"SLA eliminado: {nombre}")
        return redirect('sla_lista')
