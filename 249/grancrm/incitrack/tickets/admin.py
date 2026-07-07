from django.contrib import admin
from .models import (
    Usuario, Cuenta, Categoria, Subcategoria,
    Ticket, Adjunto, Comentario, NotificacionServicio, ConfiguracionSLA,
)

admin.site.register(Usuario)
admin.site.register(Cuenta)
admin.site.register(Categoria)
admin.site.register(Subcategoria)
admin.site.register(Ticket)
admin.site.register(NotificacionServicio)
admin.site.register(ConfiguracionSLA)
