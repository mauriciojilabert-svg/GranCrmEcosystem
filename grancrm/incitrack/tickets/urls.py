"""
InciTrack - URLs v2
Nuevas rutas: AJAX subcategorías, Configuración SLA
"""
from django.urls import path
from . import views

urlpatterns = [
    # ── Dashboard ──────────────────────────────────────────────────────────
    path('', views.DashboardView.as_view(), name='dashboard'),

    # ── Tickets ────────────────────────────────────────────────────────────
    path('tickets/',                    views.TicketListaView.as_view(),   name='ticket_lista'),
    path('tickets/nuevo/',              views.TicketNuevoView.as_view(),   name='ticket_nuevo'),
    path('tickets/<int:pk>/',           views.TicketDetalleView.as_view(), name='ticket_detalle'),
    path('tickets/<int:pk>/editar/',    views.TicketEditarView.as_view(),  name='ticket_editar'),
    path('tickets/<int:pk>/cerrar/',    views.TicketCierreView.as_view(),  name='ticket_cerrar'),

    # ── Comentarios ────────────────────────────────────────────────────────
    path('tickets/<int:pk>/comentar/', views.ComentarioAgregarView.as_view(), name='comentario_agregar'),

    # ── AJAX ───────────────────────────────────────────────────────────────
    path('ajax/subcategorias/', views.SubcategoriasAjaxView.as_view(), name='ajax_subcategorias'),
    path('ajax/sla/', views.SLAAjaxView.as_view(), name='ajax_sla'),

    # ── Admin: Usuarios ────────────────────────────────────────────────────
    path('admin-panel/usuarios/',                    views.UsuarioListaView.as_view(),    name='usuario_lista'),
    path('admin-panel/usuarios/nuevo/',              views.UsuarioCrearView.as_view(),    name='usuario_crear'),
    path('admin-panel/usuarios/<int:pk>/',           views.UsuarioEditarView.as_view(),   name='usuario_editar'),
    path('admin-panel/usuarios/<int:pk>/eliminar/',  views.UsuarioEliminarView.as_view(), name='usuario_eliminar'),

    # ── Admin: Cuentas ─────────────────────────────────────────────────────
    path('admin-panel/cuentas/',          views.CuentaListaView.as_view(),  name='cuenta_lista'),
    path('admin-panel/cuentas/nueva/',    views.CuentaCrearView.as_view(),  name='cuenta_crear'),
    path('admin-panel/cuentas/<int:pk>/', views.CuentaEditarView.as_view(), name='cuenta_editar'),

    # ── Admin: Notificaciones ──────────────────────────────────────────────
    path('admin-panel/notificaciones/',          views.NotificacionListaView.as_view(), name='notificacion_lista'),
    path('admin-panel/notificaciones/nueva/',    views.NotificacionFormView.as_view(),  name='notificacion_crear'),
    path('admin-panel/notificaciones/<int:pk>/', views.NotificacionFormView.as_view(),  name='notificacion_editar'),
    path('admin-panel/notificaciones/<int:pk>/eliminar/', views.NotificacionServicioEliminarView.as_view(), name='notificacion_eliminar'),

    # ── Configuración SLA (solo superusuario) ──────────────────────────────
    path('superadmin/sla/',              views.SLAListaView.as_view(),    name='sla_lista'),
    path('superadmin/sla/nuevo/',        views.SLACrearView.as_view(),    name='sla_crear'),
    path('superadmin/sla/<int:pk>/',     views.SLAEditarView.as_view(),   name='sla_editar'),
    path('superadmin/sla/<int:pk>/del/', views.SLAEliminarView.as_view(), name='sla_eliminar'),
]
