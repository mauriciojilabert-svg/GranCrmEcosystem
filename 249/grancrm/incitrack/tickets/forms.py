"""
InciTrack - Formularios v2
Categoría → Subcategoría dinámico (AJAX)
SLA solo superusuario
"""
from django import forms
from django.contrib.auth.forms import UserCreationForm
from .models import (
    Usuario, Cuenta, Ticket, Comentario,
    NotificacionServicio, Categoria, Subcategoria, ConfiguracionSLA,
    PLATAFORMAS_BI,
)


# ── USUARIO ───────────────────────────────────────────────────────────────────

class UsuarioCrearForm(UserCreationForm):
    class Meta:
        model  = Usuario
        fields = ['nombre', 'email', 'rol', 'activo', 'password1', 'password2']

    def save(self, commit=True):
        user = super().save(commit=False)
        user.username = user.email
        if commit:
            user.save()
        return user


class UsuarioEditarForm(forms.ModelForm):
    # ── Campo para nueva contraseña (opcional) ────────────────────────────────
    password = forms.CharField(
        required=False,
        widget=forms.PasswordInput(attrs={'placeholder': 'Deja en blanco para no cambiar'}),
        label='Nueva Contraseña',
        help_text='Si no deseas cambiar la contraseña, deja este campo en blanco.'
    )

    # ── Campo para Supervisores (visible cuando rol = 'supervisor') ────────────
    cuentas_asignadas = forms.ModelMultipleChoiceField(
        queryset=Cuenta.objects.filter(activa=True),
        required=False,
        widget=forms.CheckboxSelectMultiple(),
        label='Cuentas asignadas (solo supervisores)',
        help_text='Selecciona cuentas para este Supervisor.',
    )

    # ── Campo para Jefe de Cuenta (visible cuando rol = 'jefe') ───────────────
    supervisores_asignados = forms.ModelMultipleChoiceField(
        queryset=Usuario.objects.filter(rol='supervisor', activo=True),
        required=False,
        widget=forms.CheckboxSelectMultiple(),
        label='Supervisores asignados',
        help_text='Selecciona los supervisores que trabajarán con este Jefe de Cuenta.',
    )

    class Meta:
        model  = Usuario
        fields = ['nombre', 'email', 'rol', 'activo']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.pk:
            # Proteccion visual: ocultar password para usuario protegido
            if self.instance.email == 'mauriciocaceres@in-touchcrm.cl':
                self.fields.pop('password', None)
                self.fields['email'].disabled = True

            # Pre-seleccionar cuentas si es supervisor
            self.fields['cuentas_asignadas'].initial = self.instance.cuentas_asignadas.all()

            # Pre-seleccionar supervisores: todos los supervisores que comparten
            # al menos una cuenta donde este usuario es jefe
            if self.instance.rol == 'jefe':
                mis_cuentas = Cuenta.objects.filter(jefe=self.instance, activa=True)
                supervisores_actuales = Usuario.objects.filter(
                    cuentas_asignadas__in=mis_cuentas
                ).distinct()
                self.fields['supervisores_asignados'].initial = supervisores_actuales

    def clean(self):
        cleaned_data = super().clean()
        if self.instance and self.instance.pk and self.instance.email == 'mauriciocaceres@in-touchcrm.cl':
            if cleaned_data.get('email') != 'mauriciocaceres@in-touchcrm.cl':
                self.add_error('email', 'No se puede cambiar el email de este usuario protegido.')
            if cleaned_data.get('password'):
                self.add_error('password', 'No se puede cambiar la contraseña de este usuario protegido.')
        return cleaned_data

    def save(self, commit=True):
        user = super().save(commit=False)
        user.username = user.email

        # ── Cambio de Contraseña ──────────────────────────────────────────
        password = self.cleaned_data.get('password')
        if password:
            user.set_password(password)

        if commit:
            user.save()

            # ── Lógica para Supervisores ──────────────────────────────────────
            if user.rol == 'supervisor':
                cuentas = self.cleaned_data.get('cuentas_asignadas', [])
                for cuenta in Cuenta.objects.filter(activa=True):
                    if cuenta in cuentas:
                        cuenta.supervisores.add(user)
                    else:
                        cuenta.supervisores.remove(user)
            else:
                # Si cambió de rol desde supervisor, quitarlo de todas las cuentas
                for cuenta in user.cuentas_asignadas.all():
                    cuenta.supervisores.remove(user)

            # ── Lógica para Jefe de Cuenta ────────────────────────────────────
            if user.rol == 'jefe':
                supervisores_sel = list(self.cleaned_data.get('supervisores_asignados', []))
                mis_cuentas = Cuenta.objects.filter(jefe=user, activa=True)
                for cuenta in mis_cuentas:
                    # Supervisores actuales en esta cuenta
                    supervisores_actuales = list(cuenta.supervisores.all())
                    # Agregar los seleccionados que no estén
                    for sup in supervisores_sel:
                        cuenta.supervisores.add(sup)
                    # Quitar los que ya estaban pero no están en la nueva selección
                    for sup in supervisores_actuales:
                        if sup not in supervisores_sel:
                            cuenta.supervisores.remove(sup)

        return user



# ── CUENTA ────────────────────────────────────────────────────────────────────

class CuentaForm(forms.ModelForm):
    class Meta:
        model   = Cuenta
        fields  = ['nombre', 'descripcion', 'activa', 'jefe', 'supervisores']
        widgets = {'supervisores': forms.CheckboxSelectMultiple()}


# ── TICKET ────────────────────────────────────────────────────────────────────

class TicketNuevoForm(forms.ModelForm):
    """
    Formulario de nuevo ticket con categoría / subcategoría dinámica.
    Las subcategorías se cargan vía AJAX según la categoría seleccionada.
    Para Plataformas BI: primero se elige plataforma_bi, luego subcategoría.
    """
    subcategoria  = forms.ModelChoiceField(
        queryset=Subcategoria.objects.none(),
        required=True,
        empty_label='-- Selecciona una subcategoría --',
        label='Subcategoría',
    )
    plataforma_bi = forms.ChoiceField(
        choices=[('', '-- Selecciona plataforma --')] + list(PLATAFORMAS_BI),
        required=False,
        label='Plataforma BI',
    )
    adjunto_1       = forms.FileField(required=False, label='Adjunto 1')
    adjunto_2       = forms.FileField(required=False, label='Adjunto 2')
    adjunto_3       = forms.FileField(required=False, label='Adjunto 3')
    screenshot_data = forms.CharField(required=False, widget=forms.HiddenInput())

    class Meta:
        model  = Ticket
        fields = ['cuenta', 'categoria', 'subcategoria', 'plataforma_bi',
                  'titulo', 'descripcion', 'prioridad']
        widgets = {
            'descripcion': forms.Textarea(attrs={
                'rows': 5,
                'placeholder': '¿Qué ocurre? ¿Desde cuándo? ¿A cuántos afecta?',
            }),
        }

    def __init__(self, *args, usuario=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.usuario = usuario

        # Placeholders
        self.fields['cuenta'].empty_label    = '-- Selecciona una cuenta --'
        self.fields['categoria'].empty_label = '-- Selecciona una categoría --'

        # Visibilidad de cuentas según rol
        from .mixins import cuentas_visibles
        if usuario:
            self.fields['cuenta'].queryset = cuentas_visibles(usuario).filter(activa=True)

        # Subcategorías: vacías al inicio, se cargan por JS o al re-renderizar con datos
        cat_id = None
        if self.data.get('categoria'):
            try:
                cat_id = int(self.data.get('categoria'))
            except (ValueError, TypeError):
                pass
        elif self.instance and self.instance.pk and self.instance.categoria_id:
            cat_id = self.instance.categoria_id

        if cat_id:
            self.fields['subcategoria'].queryset = (
                Subcategoria.objects.filter(categoria_id=cat_id, activa=True)
            )
        else:
            self.fields['subcategoria'].queryset = Subcategoria.objects.none()

        # Prioridad oculta en UI (persiste en BD)
        self.fields['prioridad'].widget = forms.HiddenInput()
        self.fields['prioridad'].initial = 'media'

    def clean(self):
        cleaned = super().clean()
        categoria     = cleaned.get('categoria')
        subcategoria  = cleaned.get('subcategoria')
        plataforma_bi = cleaned.get('plataforma_bi')

        if categoria:
            # Subcategoría siempre requerida
            if not subcategoria:
                self.add_error('subcategoria', 'Debes seleccionar una subcategoría.')

            # Plataforma BI obligatoria para la categoría correspondiente
            if categoria.requiere_plataforma_bi and not plataforma_bi:
                self.add_error('plataforma_bi', 'Debes seleccionar una plataforma BI.')

            # Limpiar plataforma_bi si la categoría no la requiere
            if not categoria.requiere_plataforma_bi:
                cleaned['plataforma_bi'] = None
                
            # Validar que exista un responsable TI asignado
            # Misma precedencia que el email_service y la vista: subcategoria > categoria > global
            ns = None
            if subcategoria:
                ns = NotificacionServicio.objects.filter(
                    categoria=categoria, subcategoria=subcategoria, activo=True
                ).first()
            if not ns:
                ns = NotificacionServicio.objects.filter(
                    categoria=categoria, subcategoria__isnull=True, activo=True
                ).first()
            if not ns:
                ns = NotificacionServicio.objects.filter(
                    categoria__isnull=True, subcategoria__isnull=True, activo=True
                ).first()

            if not ns or not ns.usuarios.exists():
                self.add_error(None, 'No existe un responsable de TI configurado para esta categoría/subcategoría. Configura una Notificación de Servicio antes de crear el ticket.')

        return cleaned


class TicketEditarForm(forms.ModelForm):
    """Solo Admin TI puede cambiar estado y asignación."""
    class Meta:
        model  = Ticket
        fields = ['estado', 'asignado_a']

    def __init__(self, *args, usuario=None, **kwargs):
        self.usuario = usuario
        super().__init__(*args, **kwargs)
        if usuario and not usuario.es_admin:
            self.fields.pop('asignado_a', None)

    def clean_estado(self):
        estado = self.cleaned_data.get('estado')
        if estado in ['resuelto', 'cerrado'] and self.usuario and self.usuario.es_admin:
            if not self.instance.comentarios.filter(autor=self.usuario).exists():
                raise forms.ValidationError('No puedes resolver o cerrar el ticket sin haber escrito al menos un comentario antes.')
        return estado


# ── COMENTARIO ────────────────────────────────────────────────────────────────

class ComentarioForm(forms.ModelForm):
    class Meta:
        model   = Comentario
        fields  = ['contenido', 'interno']
        widgets = {
            'contenido': forms.Textarea(attrs={
                'rows': 3,
                'placeholder': 'Escribe un comentario...',
            }),
        }

    def __init__(self, *args, usuario=None, **kwargs):
        super().__init__(*args, **kwargs)
        if usuario and usuario.es_supervisor:
            self.fields.pop('interno', None)


# ── NOTIFICACIÓN DE SERVICIO ──────────────────────────────────────────────────

class NotificacionServicioForm(forms.ModelForm):
    class Meta:
        model   = NotificacionServicio
        fields  = ['categoria', 'subcategoria', 'usuarios', 'emails_cc', 'activo']
        widgets = {
            'usuarios': forms.CheckboxSelectMultiple(),
            'emails_cc': forms.TextInput(attrs={
                'placeholder': 'correo1@empresa.cl, correo2@empresa.cl'
            }),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['categoria'].empty_label   = '-- Todas las categorías --'
        self.fields['subcategoria'].empty_label = '-- Todas las subcategorías --'
        self.fields['subcategoria'].queryset   = Subcategoria.objects.none()

        cat_id = None
        if self.data.get('categoria'):
            try:
                cat_id = int(self.data['categoria'])
            except (ValueError, TypeError):
                pass
        elif self.instance and self.instance.pk and self.instance.categoria_id:
            cat_id = self.instance.categoria_id

        if cat_id:
            self.fields['subcategoria'].queryset = (
                Subcategoria.objects.filter(categoria_id=cat_id)
            )


# ── CONFIGURACIÓN SLA ─────────────────────────────────────────────────────────

class ConfiguracionSLAForm(forms.ModelForm):
    cierre_horas = forms.IntegerField(
        min_value=0, required=True, label='Tiempo de cierre (Horas)'
    )
    cierre_minutos = forms.IntegerField(
        min_value=0, max_value=59, required=True, label='Tiempo de cierre (Minutos)'
    )

    class Meta:
        model  = ConfiguracionSLA
        fields = [
            'categoria', 'subcategoria', 'plataforma_bi',
            'tiempo_respuesta_minutos',
            'descripcion', 'activo',
        ]
        widgets = {
            'descripcion': forms.TextInput(attrs={
                'placeholder': 'Notas opcionales sobre este SLA...'
            }),
        }
        labels = {
            'tiempo_respuesta_minutos': 'Tiempo de respuesta (minutos)',
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['categoria'].empty_label   = '-- Selecciona categoría --'
        self.fields['subcategoria'].empty_label = '-- Todas (SLA general) --'
        self.fields['plataforma_bi'].required  = False

        # Inicializar cierre_horas y cierre_minutos si hay una instancia
        if self.instance and self.instance.pk:
            total_m = self.instance.tiempo_cierre_minutos
            self.fields['cierre_horas'].initial = total_m // 60
            self.fields['cierre_minutos'].initial = total_m % 60
        else:
            self.fields['cierre_horas'].initial = 0
            self.fields['cierre_minutos'].initial = 0

        cat_id = None
        if self.data.get('categoria'):
            try:
                cat_id = int(self.data['categoria'])
            except (ValueError, TypeError):
                pass
        elif self.instance and self.instance.pk and self.instance.categoria_id:
            cat_id = self.instance.categoria_id

        if cat_id:
            self.fields['subcategoria'].queryset = (
                Subcategoria.objects.filter(categoria_id=cat_id)
            )
        else:
            self.fields['subcategoria'].queryset = Subcategoria.objects.none()

    def save(self, commit=True):
        instance = super().save(commit=False)
        h = self.cleaned_data.get('cierre_horas')
        m = self.cleaned_data.get('cierre_minutos')
        
        h = int(h) if h is not None else 0
        m = int(m) if m is not None else 0
        
        instance.tiempo_cierre_minutos = (h * 60) + m
        
        if commit:
            instance.save()
        return instance
