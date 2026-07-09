"""
InciTrack - Template Tags
Uso en templates:
    {% load incitrack_tags %}
    {% if request.user|es_admin %}...{% endif %}
    {% if ticket|puede_modificar:request.user %}...{% endif %}
"""
from django import template

register = template.Library()


@register.filter
def es_admin(usuario):
    return getattr(usuario, 'rol', '') == 'admin'


@register.filter
def es_jefe(usuario):
    return getattr(usuario, 'rol', '') == 'jefe'


@register.filter
def es_supervisor(usuario):
    return getattr(usuario, 'rol', '') == 'supervisor'


@register.filter
def puede_modificar(ticket, usuario):
    return ticket.puede_modificar(usuario)


@register.filter
def estado_badge(estado):
    """Retorna clase CSS Bootstrap para el badge de estado."""
    mapa = {
        'abierto':    'badge-abierto',
        'en_proceso': 'badge-proceso',
        'resuelto':   'badge-resuelto',
        'cerrado':    'badge-cerrado',
    }
    return mapa.get(estado, 'badge-secondary')


@register.simple_tag
def url_filtro(request, **kwargs):
    """
    Genera URL con parámetros GET actualizados.
    Uso: {% url_filtro request estado='abierto' %}
    """
    params = request.GET.copy()
    for key, value in kwargs.items():
        if value:
            params[key] = value
        else:
            params.pop(key, None)
    return f"?{params.urlencode()}"
