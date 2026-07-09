"""
InciTrack - Models v2
Arquitectura nueva: Categoria → Subcategoria (BD, no hardcoded strings)
SLA configurable por superusuario
Migración segura: tickets existentes conservan tipo_incidencia legacy
"""
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone


# ══════════════════════════════════════════════════════════════════════════════
# USUARIO
# ══════════════════════════════════════════════════════════════════════════════

class Usuario(AbstractUser):
    ROL_CHOICES = [
        ('admin',      'Admin TI'),
        ('jefe',       'Jefe de Cuenta'),
        ('supervisor', 'Supervisor'),
    ]
    username       = models.CharField(max_length=150, blank=True)
    nombre         = models.CharField(max_length=100)
    email          = models.EmailField(unique=True)
    rol            = models.CharField(max_length=20, choices=ROL_CHOICES, default='supervisor')
    activo         = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD  = 'email'
    REQUIRED_FIELDS = ['nombre']

    class Meta:
        verbose_name = 'Usuario'
        verbose_name_plural = 'Usuarios'

    def __str__(self):
        return f"{self.nombre} ({self.get_rol_display()})"

    @property
    def es_admin(self):
        return self.rol == 'admin'

    @property
    def es_jefe(self):
        return self.rol == 'jefe'

    @property
    def es_supervisor(self):
        return self.rol == 'supervisor'


# ══════════════════════════════════════════════════════════════════════════════
# CUENTA
# ══════════════════════════════════════════════════════════════════════════════

class Cuenta(models.Model):
    nombre         = models.CharField(max_length=150, unique=True)
    descripcion    = models.CharField(max_length=300, blank=True, null=True)
    activa         = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    jefe           = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='cuentas_como_jefe',
        limit_choices_to={'rol': 'jefe'},
    )
    supervisores = models.ManyToManyField(
        Usuario, blank=True,
        related_name='cuentas_asignadas',
        limit_choices_to={'rol': 'supervisor'},
    )

    class Meta:
        verbose_name = 'Cuenta'
        verbose_name_plural = 'Cuentas'
        ordering = ['nombre']

    def __str__(self):
        return self.nombre


# ══════════════════════════════════════════════════════════════════════════════
# CATEGORÍA / SUBCATEGORÍA
# Arquitectura BD-first: escalable, sin strings hardcodeados
# ══════════════════════════════════════════════════════════════════════════════

PLATAFORMAS_BI = [
    ('PowerBI',   'Power BI'),
    ('QlikView',  'QlikView'),
]


class Categoria(models.Model):
    """
    Categoría principal de incidencia.
    Ejemplos: Telefonía, CRM, Correo, Plataformas BI, Hardware...
    """
    nombre  = models.CharField(max_length=100, unique=True)
    slug    = models.SlugField(max_length=100, unique=True,
                               help_text="Identificador técnico sin espacios ni tildes")
    orden   = models.PositiveSmallIntegerField(default=0,
                                               help_text="Orden de aparición en formularios")
    activa  = models.BooleanField(default=True)
    # Indica si esta categoría requiere elegir plataforma BI primero
    requiere_plataforma_bi = models.BooleanField(
        default=False,
        help_text="Activar solo para 'Plataformas BI'. Muestra selector PowerBI/QlikView."
    )

    class Meta:
        verbose_name = 'Categoría'
        verbose_name_plural = 'Categorías'
        ordering = ['orden', 'nombre']

    def __str__(self):
        return self.nombre


class Subcategoria(models.Model):
    """
    Subcategoría ligada a una Categoría.
    Ejemplo: Categoría=Telefonía → Subcategoría=Caída Softcall
    """
    categoria = models.ForeignKey(
        Categoria, on_delete=models.CASCADE,
        related_name='subcategorias'
    )
    nombre    = models.CharField(max_length=150)
    slug      = models.SlugField(max_length=150)
    orden     = models.PositiveSmallIntegerField(default=0)
    activa    = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Subcategoría'
        verbose_name_plural = 'Subcategorías'
        ordering = ['orden', 'nombre']
        unique_together = [('categoria', 'slug')]

    def __str__(self):
        return f"{self.categoria.nombre} › {self.nombre}"


# ══════════════════════════════════════════════════════════════════════════════
# TICKET
# ══════════════════════════════════════════════════════════════════════════════

ESTADOS = [
    ('abierto',    'Abierto'),
    ('en_proceso', 'En Proceso'),
    ('resuelto',   'Resuelto'),
    ('cerrado',    'Cerrado'),
]

PRIORIDADES = [
    ('baja',    'Baja'),
    ('media',   'Media'),
    ('alta',    'Alta'),
    ('critica', 'Crítica'),
]


class Ticket(models.Model):
    titulo       = models.CharField(max_length=200)
    descripcion  = models.TextField()
    estado       = models.CharField(max_length=20, choices=ESTADOS, default='abierto')
    prioridad    = models.CharField(max_length=20, choices=PRIORIDADES, default='media')

    # ── Nueva clasificación escalable ──────────────────────────────────────
    categoria    = models.ForeignKey(
        Categoria, on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='tickets',
    )
    subcategoria = models.ForeignKey(
        Subcategoria, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='tickets',
    )
    # Campo extra solo para Plataformas BI
    plataforma_bi = models.CharField(
        max_length=20,
        choices=PLATAFORMAS_BI,
        blank=True, null=True,
        help_text="Obligatorio cuando la categoría es Plataformas BI"
    )

    # ── Campo legacy: compatibilidad con tickets anteriores ────────────────
    # Se conserva para no romper datos históricos.
    # Los tickets nuevos usarán categoria/subcategoria.
    # Los tickets antiguos mantienen su tipo_incidencia original.
    tipo_incidencia = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="[LEGACY] Valor de clasificación para tickets creados antes de v2"
    )

    # ── Fechas ──────────────────────────────────────────────────────────────
    fecha_creacion      = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)
    fecha_resolucion    = models.DateTimeField(null=True, blank=True)

    # ── Relaciones ──────────────────────────────────────────────────────────
    cuenta     = models.ForeignKey(Cuenta, on_delete=models.PROTECT, related_name='tickets')
    creado_por = models.ForeignKey(
        Usuario, on_delete=models.PROTECT,
        related_name='tickets_creados',
    )
    asignado_a = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='tickets_asignados',
        limit_choices_to={'rol': 'admin'},
    )
    fue_reasignado = models.BooleanField(
        default=False,
        help_text="True cuando el responsable TI fue cambiado manualmente tras la asignación automática."
    )

    class Meta:
        verbose_name = 'Ticket'
        verbose_name_plural = 'Tickets'
        ordering = ['-fecha_creacion']

    def __str__(self):
        return f"#{self.pk} — {self.titulo}"

    # ── Propiedad de clasificación legible ─────────────────────────────────
    @property
    def clasificacion_display(self):
        """Retorna la clasificación legible independientemente de si es nuevo o legacy."""
        if self.categoria:
            parts = [self.categoria.nombre]
            if self.plataforma_bi:
                parts.append(self.get_plataforma_bi_display())
            if self.subcategoria:
                parts.append(self.subcategoria.nombre)
            return ' › '.join(parts)
        return self.tipo_incidencia or '—'

    # ── Reglas de negocio ──────────────────────────────────────────────────
    @property
    def esta_cerrado(self):
        return self.estado == 'cerrado'

    def cerrar(self):
        if not self.esta_cerrado:
            self.estado = 'cerrado'
            self.fecha_resolucion = timezone.now()
            self.save(update_fields=['estado', 'fecha_resolucion', 'fecha_actualizacion'])

    def puede_modificar(self, usuario):
        if self.esta_cerrado:
            return False
        if usuario.es_admin:
            return True
        if usuario.es_jefe and self.cuenta.jefe == usuario:
            return True
        if usuario.es_supervisor and self.creado_por == usuario:
            return True
        return False


# ══════════════════════════════════════════════════════════════════════════════
# ADJUNTO
# ══════════════════════════════════════════════════════════════════════════════

def adjunto_upload_path(instance, filename):
    return f"adjuntos/ticket_{instance.ticket_id}/{filename}"


class Adjunto(models.Model):
    ticket          = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name='adjuntos')
    nombre_original = models.CharField(max_length=255)
    nombre_guardado = models.CharField(max_length=255)
    archivo         = models.FileField(upload_to=adjunto_upload_path)
    fecha_subida    = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Adjunto'
        verbose_name_plural = 'Adjuntos'

    def __str__(self):
        return self.nombre_original


# ══════════════════════════════════════════════════════════════════════════════
# COMENTARIO
# ══════════════════════════════════════════════════════════════════════════════

class Comentario(models.Model):
    ticket    = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name='comentarios')
    autor     = models.ForeignKey(Usuario, on_delete=models.PROTECT, related_name='comentarios')
    contenido = models.TextField()
    fecha     = models.DateTimeField(auto_now_add=True)
    interno   = models.BooleanField(
        default=False,
        help_text="Visible solo para admin y jefe. Invisible para supervisor."
    )

    class Meta:
        verbose_name = 'Comentario'
        verbose_name_plural = 'Comentarios'
        ordering = ['fecha']

    def __str__(self):
        return f"Comentario de {self.autor} en #{self.ticket_id}"


# ══════════════════════════════════════════════════════════════════════════════
# NOTIFICACIÓN DE SERVICIO
# ══════════════════════════════════════════════════════════════════════════════

class NotificacionServicio(models.Model):
    """Define qué Admin TI recibe correos según categoría/subcategoría."""
    categoria    = models.ForeignKey(
        Categoria, on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='notificaciones',
        help_text="Dejar vacío para notificación global"
    )
    subcategoria = models.ForeignKey(
        Subcategoria, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='notificaciones',
    )
    # Legacy: mantener el campo servicio para notificaciones antiguas
    servicio  = models.CharField(max_length=100, blank=True, default='',
                                 help_text="[LEGACY] Valor anterior a v2")
    usuarios = models.ManyToManyField(
        Usuario, blank=True,
        related_name='notificaciones_servicio',
        limit_choices_to={'rol': 'admin'},
    )
    emails_cc = models.TextField(blank=True, help_text="Emails CC separados por coma")
    activo    = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Notificación de Servicio'
        verbose_name_plural = 'Notificaciones de Servicio'

    def __str__(self):
        cat = self.categoria.nombre if self.categoria else self.servicio or 'Global'
        sub = f" › {self.subcategoria.nombre}" if self.subcategoria else ''
        usrs = ", ".join(u.nombre for u in self.usuarios.all()) if self.pk else 'Sin asignar'
        return f"Notif. {cat}{sub} → {usrs}"

    def get_emails_cc_list(self):
        if not self.emails_cc:
            return []
        return [e.strip() for e in self.emails_cc.split(',') if e.strip()]

    @property
    def clasificacion_display(self):
        cat = self.categoria.nombre if self.categoria else self.servicio or 'Todas las categorías'
        sub = f" › {self.subcategoria.nombre}" if self.subcategoria else ''
        return f"{cat}{sub}"


# ══════════════════════════════════════════════════════════════════════════════
# SLA (Service Level Agreement)
# Solo configurable por superusuario
# ══════════════════════════════════════════════════════════════════════════════

class ConfiguracionSLA(models.Model):
    """
    Define los tiempos de SLA por categoría/subcategoría.
    Solo el superusuario puede crear/editar/eliminar registros.

    Campos de tiempo:
      - tiempo_respuesta_minutos: minutos para primera respuesta del equipo TI
      - tiempo_cierre_horas: horas máximas para cerrar el ticket

    Preparado para métricas futuras de cumplimiento.
    """
    categoria    = models.ForeignKey(
        Categoria, on_delete=models.CASCADE,
        related_name='slas',
    )
    subcategoria = models.ForeignKey(
        Subcategoria, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='slas',
        help_text="Dejar vacío para SLA general de la categoría"
    )
    plataforma_bi = models.CharField(
        max_length=20,
        choices=PLATAFORMAS_BI,
        blank=True, null=True,
        help_text="Aplicar solo cuando categoría es Plataformas BI"
    )

    tiempo_respuesta_minutos = models.PositiveIntegerField(
        help_text="Tiempo máximo de primera respuesta en minutos (ej: 60 = 1 hora)"
    )
    tiempo_cierre_minutos = models.PositiveIntegerField(
        help_text="Tiempo máximo para cerrar el ticket en minutos totales",
        default=0
    )

    descripcion = models.CharField(
        max_length=255, blank=True,
        help_text="Notas opcionales sobre este SLA"
    )
    activo      = models.BooleanField(default=True)
    creado_en   = models.DateTimeField(auto_now_add=True)
    actualizado = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Configuración SLA'
        verbose_name_plural = 'Configuraciones SLA'
        ordering = ['categoria__orden', 'categoria__nombre', 'subcategoria__nombre']
        # Un SLA por combinación categoria + subcategoria + plataforma_bi
        unique_together = [('categoria', 'subcategoria', 'plataforma_bi')]

    def __str__(self):
        cat  = self.categoria.nombre
        sub  = f" › {self.subcategoria.nombre}" if self.subcategoria else ''
        bi   = f" [{self.get_plataforma_bi_display()}]" if self.plataforma_bi else ''
        return f"SLA: {cat}{sub}{bi} — R:{self.tiempo_respuesta_display} / C:{self.tiempo_cierre_display}"

    @property
    def tiempo_respuesta_display(self):
        m = self.tiempo_respuesta_minutos
        if m is None:
            return "N/A"
        if m < 60:
            return f"{m} min"
        h = m // 60
        rem = m % 60
        return f"{h}h {rem}min" if rem else f"{h}h"

    @property
    def tiempo_cierre_display(self):
        total = self.tiempo_cierre_minutos
        if total is None:
            return "N/A"
        if total < 60:
            return f"{total} min"
        h = total // 60
        rem_m = total % 60
        if h < 24:
            return f"{h}h {rem_m}min" if rem_m else f"{h}h"
        d = h // 24
        rem_h = h % 24
        
        parts = []
        if d > 0: parts.append(f"{d}d")
        if rem_h > 0: parts.append(f"{rem_h}h")
        if rem_m > 0: parts.append(f"{rem_m}min")
        return " ".join(parts)


# ══════════════════════════════════════════════════════════════════════════════
# AVISO TI
# Panel de comunicación interna: Admin TI publica avisos visibles a todos.
# Expiran automáticamente a las 24h (o se eliminan manualmente).
# ══════════════════════════════════════════════════════════════════════════════

AVISO_TIPOS = [
    ('info',       'Informativo'),
    ('advertencia','Advertencia'),
    ('critico',    'Crítico'),
    ('resolucion', 'Resolución'),
]


class AvisoTI(models.Model):
    """
    Aviso interno publicado por un Admin TI.
    Se muestra en el dashboard de todos los usuarios hasta expirar (24h)
    o ser eliminado manualmente por un admin.
    """
    tipo           = models.CharField(max_length=20, choices=AVISO_TIPOS, default='info')
    contenido      = models.TextField(help_text="Mensaje del aviso (máx. 500 caracteres)")
    creado_por     = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='avisos_creados',
        db_constraint=False,
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    expira_en      = models.DateTimeField(
        help_text="Calculado automáticamente: fecha_creacion + 24h"
    )
    activo         = models.BooleanField(default=True)

    class Meta:
        verbose_name        = 'Aviso TI'
        verbose_name_plural = 'Avisos TI'
        ordering            = ['-fecha_creacion']

    def __str__(self):
        return f"[{self.get_tipo_display()}] {self.contenido[:60]}"

    class Meta:
        verbose_name = 'Comentario'
        verbose_name_plural = 'Comentarios'
        ordering = ['fecha']

    def __str__(self):
        return f"Comentario de {self.autor} en #{self.ticket_id}"


# ══════════════════════════════════════════════════════════════════════════════
# NOTIFICACIÓN DE SERVICIO
# ══════════════════════════════════════════════════════════════════════════════

class NotificacionServicio(models.Model):
    """Define qué Admin TI recibe correos según categoría/subcategoría."""
    categoria    = models.ForeignKey(
        Categoria, on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='notificaciones',
        help_text="Dejar vacío para notificación global"
    )
    subcategoria = models.ForeignKey(
        Subcategoria, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='notificaciones',
    )
    # Legacy: mantener el campo servicio para notificaciones antiguas
    servicio  = models.CharField(max_length=100, blank=True, default='',
                                 help_text="[LEGACY] Valor anterior a v2")
    usuarios = models.ManyToManyField(
        Usuario, blank=True,
        related_name='notificaciones_servicio',
        limit_choices_to={'rol': 'admin'},
    )
    emails_cc = models.TextField(blank=True, help_text="Emails CC separados por coma")
    activo    = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Notificación de Servicio'
        verbose_name_plural = 'Notificaciones de Servicio'

    def __str__(self):
        cat = self.categoria.nombre if self.categoria else self.servicio or 'Global'
        sub = f" › {self.subcategoria.nombre}" if self.subcategoria else ''
        usrs = ", ".join(u.nombre for u in self.usuarios.all()) if self.pk else 'Sin asignar'
        return f"Notif. {cat}{sub} → {usrs}"

    def get_emails_cc_list(self):
        if not self.emails_cc:
            return []
        return [e.strip() for e in self.emails_cc.split(',') if e.strip()]

    @property
    def clasificacion_display(self):
        cat = self.categoria.nombre if self.categoria else self.servicio or 'Todas las categorías'
        sub = f" › {self.subcategoria.nombre}" if self.subcategoria else ''
        return f"{cat}{sub}"


# ══════════════════════════════════════════════════════════════════════════════
# SLA (Service Level Agreement)
# Solo configurable por superusuario
# ══════════════════════════════════════════════════════════════════════════════

class ConfiguracionSLA(models.Model):
    """
    Define los tiempos de SLA por categoría/subcategoría.
    Solo el superusuario puede crear/editar/eliminar registros.

    Campos de tiempo:
      - tiempo_respuesta_minutos: minutos para primera respuesta del equipo TI
      - tiempo_cierre_horas: horas máximas para cerrar el ticket

    Preparado para métricas futuras de cumplimiento.
    """
    categoria    = models.ForeignKey(
        Categoria, on_delete=models.CASCADE,
        related_name='slas',
    )
    subcategoria = models.ForeignKey(
        Subcategoria, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='slas',
        help_text="Dejar vacío para SLA general de la categoría"
    )
    plataforma_bi = models.CharField(
        max_length=20,
        choices=PLATAFORMAS_BI,
        blank=True, null=True,
        help_text="Aplicar solo cuando categoría es Plataformas BI"
    )

    tiempo_respuesta_minutos = models.PositiveIntegerField(
        help_text="Tiempo máximo de primera respuesta en minutos (ej: 60 = 1 hora)"
    )
    tiempo_cierre_minutos = models.PositiveIntegerField(
        help_text="Tiempo máximo para cerrar el ticket en minutos totales",
        default=0
    )

    descripcion = models.CharField(
        max_length=255, blank=True,
        help_text="Notas opcionales sobre este SLA"
    )
    activo      = models.BooleanField(default=True)
    creado_en   = models.DateTimeField(auto_now_add=True)
    actualizado = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Configuración SLA'
        verbose_name_plural = 'Configuraciones SLA'
        ordering = ['categoria__orden', 'categoria__nombre', 'subcategoria__nombre']
        # Un SLA por combinación categoria + subcategoria + plataforma_bi
        unique_together = [('categoria', 'subcategoria', 'plataforma_bi')]

    def __str__(self):
        cat  = self.categoria.nombre
        sub  = f" › {self.subcategoria.nombre}" if self.subcategoria else ''
        bi   = f" [{self.get_plataforma_bi_display()}]" if self.plataforma_bi else ''
        return f"SLA: {cat}{sub}{bi} — R:{self.tiempo_respuesta_display} / C:{self.tiempo_cierre_display}"

    @property
    def tiempo_respuesta_display(self):
        m = self.tiempo_respuesta_minutos
        if m is None:
            return "N/A"
        if m < 60:
            return f"{m} min"
        h = m // 60
        rem = m % 60
        return f"{h}h {rem}min" if rem else f"{h}h"

    @property
    def tiempo_cierre_display(self):
        total = self.tiempo_cierre_minutos
        if total is None:
            return "N/A"
        if total < 60:
            return f"{total} min"
        h = total // 60
        rem_m = total % 60
        if h < 24:
            return f"{h}h {rem_m}min" if rem_m else f"{h}h"
        d = h // 24
        rem_h = h % 24
        
        parts = []
        if d > 0: parts.append(f"{d}d")
        if rem_h > 0: parts.append(f"{rem_h}h")
        if rem_m > 0: parts.append(f"{rem_m}min")
        return " ".join(parts)


# ══════════════════════════════════════════════════════════════════════════════
# AVISO TI
# Panel de comunicación interna: Admin TI publica avisos visibles a todos.
# Expiran automáticamente a las 24h (o se eliminan manualmente).
# ══════════════════════════════════════════════════════════════════════════════

AVISO_TIPOS = [
    ('info',       'Informativo'),
    ('advertencia','Advertencia'),
    ('critico',    'Crítico'),
    ('resolucion', 'Resolución'),
]


class AvisoTI(models.Model):
    """
    Aviso interno publicado por un Admin TI.
    Se muestra en el dashboard de todos los usuarios hasta expirar (24h)
    o ser eliminado manualmente por un admin.
    """
    tipo           = models.CharField(max_length=20, choices=AVISO_TIPOS, default='info')
    contenido      = models.TextField(help_text="Mensaje del aviso (máx. 500 caracteres)")
    creado_por     = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='avisos_creados',
        db_constraint=False,
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    expira_en      = models.DateTimeField(
        help_text="Calculado automáticamente: fecha_creacion + 24h"
    )
    activo         = models.BooleanField(default=True)

    class Meta:
        verbose_name        = 'Aviso TI'
        verbose_name_plural = 'Avisos TI'
        ordering            = ['-fecha_creacion']

    def __str__(self):
        return f"[{self.get_tipo_display()}] {self.contenido[:60]}"

    def save(self, *args, **kwargs):
        if not self.pk and not self.expira_en:
            self.expira_en = timezone.now() + timedelta(hours=24)
        super().save(*args, **kwargs)

    @property
    def esta_vigente(self):
        return self.activo and timezone.now() < self.expira_en


# ══════════════════════════════════════════════════════════════════════════════
# TICKET AUDIT
# ══════════════════════════════════════════════════════════════════════════════

class TicketAudit(models.Model):
    ticket = models.ForeignKey(
        Ticket, on_delete=models.CASCADE,
        related_name='auditorias'
    )
    usuario = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='auditorias_realizadas'
    )
    campo_modificado = models.CharField(max_length=100)
    valor_anterior = models.TextField(blank=True, null=True)
    valor_nuevo = models.TextField(blank=True, null=True)
    fecha_modificacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Auditoría de Ticket'
        verbose_name_plural = 'Auditorías de Tickets'
        ordering = ['-fecha_modificacion']

    def __str__(self):
        return f"Ticket #{self.ticket.id} - {self.campo_modificado} cambiado por {self.usuario.nombre if self.usuario else 'Sistema'}"