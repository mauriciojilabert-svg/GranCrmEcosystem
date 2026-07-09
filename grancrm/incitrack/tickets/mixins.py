"""
InciTrack - Mixins de control de acceso y visibilidad jerárquica

Jerarquía de visibilidad:
  Admin    → ve TODO sin restricción.
  Jefe     → ve sus cuentas propias (donde es jefe) MAS todas las cuentas
             donde alguno de sus supervisores dependientes está asignado.
  Supervisor → ve SOLO las cuentas a las que está asignado directamente.
"""
from datetime import timedelta
from django.contrib.auth.mixins import LoginRequiredMixin
from django.core.exceptions import PermissionDenied
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone


# ─── HELPERS DE VISIBILIDAD ───────────────────────────────────────────────────

def cuentas_visibles(usuario):
    """
    Retorna QuerySet de Cuenta según rol.
    Jefe ve sus cuentas + cuentas de sus supervisores dependientes.
    """
    from .models import Cuenta, Usuario

    if usuario.es_admin:
        return Cuenta.objects.all()

    if usuario.es_jefe:
        # Cuentas donde el jefe es responsable directo
        cuentas_directas = Cuenta.objects.filter(jefe=usuario)

        # IDs de esas cuentas
        ids_directas = set(cuentas_directas.values_list('pk', flat=True))

        # Supervisores que trabajan en ESAS cuentas
        from .models import Cuenta as C
        supervisores_bajo_jefe = Usuario.objects.filter(
            rol='supervisor',
            cuentas_asignadas__jefe=usuario
        ).distinct()

        # Todas las cuentas donde esos supervisores están asignados
        cuentas_supervisores = Cuenta.objects.filter(
            supervisores__in=supervisores_bajo_jefe
        )

        return (cuentas_directas | cuentas_supervisores).distinct()

    # Supervisor: solo sus cuentas asignadas directamente
    return usuario.cuentas_asignadas.all()


def tickets_visibles(usuario):
    """
    Retorna QuerySet de Ticket según rol, usando cuentas_visibles como base.
    """
    from .models import Ticket

    if usuario.es_admin:
        return Ticket.objects.all()

    cuentas = cuentas_visibles(usuario)
    return Ticket.objects.filter(cuenta__in=cuentas)


def puede_ver_ticket(usuario, ticket):
    """Verifica si un usuario puede ver un ticket específico."""
    if usuario.es_admin:
        return True
    return tickets_visibles(usuario).filter(pk=ticket.pk).exists()


# ─── MIXINS ───────────────────────────────────────────────────────────────────

class RolRequeridoMixin(LoginRequiredMixin):
    roles_permitidos = []

    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return self.handle_no_permission()
        if self.roles_permitidos and request.user.rol not in self.roles_permitidos:
            raise PermissionDenied
        return super().dispatch(request, *args, **kwargs)


class SoloAdminMixin(RolRequeridoMixin):
    roles_permitidos = ['admin']


class AdminOJefeMixin(RolRequeridoMixin):
    roles_permitidos = ['admin', 'jefe']


class TicketAccesoMixin(LoginRequiredMixin):
    """
    Verifica visibilidad de un ticket según la jerarquía de roles.
    """
    def get_ticket(self):
        from .models import Ticket
        ticket = get_object_or_404(Ticket, pk=self.kwargs['pk'])
        if not puede_ver_ticket(self.request.user, ticket):
            raise PermissionDenied
        return ticket


class TicketModificableMixin(TicketAccesoMixin):
    """
    Además de poder ver, verifica que el ticket NO esté cerrado.
    Tickets cerrados son inmutables para todos.
    """
    def get_ticket(self):
        ticket = super().get_ticket()
        if ticket.esta_cerrado:
            raise PermissionDenied("Este ticket está cerrado y no puede modificarse.")
        return ticket
