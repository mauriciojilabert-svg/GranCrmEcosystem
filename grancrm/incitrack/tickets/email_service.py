"""
InciTrack - Servicio de Email Asíncrono
Reemplaza el threading.Thread de Flask.
Envía el correo en un hilo separado para que la request web retorne inmediatamente.

Para producción con mayor volumen, reemplazar por Celery:
    @shared_task
    def enviar_email_nuevo_ticket(ticket_id): ...
"""
import threading
import logging
from django.core.mail import EmailMultiAlternatives
from django.conf import settings
from django.template.loader import render_to_string

logger = logging.getLogger(__name__)


def _enviar_en_hilo(subject, to_list, cc_list, html_content, text_content):
    """Función interna que corre en un thread separado."""
    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=to_list,
            cc=cc_list,
        )
        msg.attach_alternative(html_content, "text/html")
        msg.send(fail_silently=False)
        logger.info(f"Email enviado a {to_list} | CC: {cc_list}")
    except Exception as e:
        logger.error(f"Error al enviar email: {e}")


def notificar_nuevo_ticket(ticket, request=None):
    """
    Dispara el envío de correo cuando se crea un nuevo ticket.
    Destinatarios:
      - Jefe de la cuenta
      - Responsable TI (NotificacionServicio.usuario)
      - CC: emails_cc de NotificacionServicio
    La request web no espera este envío.
    """
    from .models import NotificacionServicio  # import tardío para evitar circulares
    from django.urls import reverse

    to_list = []
    cc_list = []

    # Jefe de la cuenta
    if ticket.cuenta.jefe and ticket.cuenta.jefe.email:
        to_list.append(ticket.cuenta.jefe.email)

    # Responsable TI según categoría/subcategoría
    try:
        # 1. Buscar notificación específica para la subcategoría
        notif = NotificacionServicio.objects.filter(
            categoria=ticket.categoria,
            subcategoria=ticket.subcategoria,
            activo=True
        ).first()

        # 2. Si no hay, buscar notificación general de la categoría
        if not notif:
            notif = NotificacionServicio.objects.filter(
                categoria=ticket.categoria,
                subcategoria__isnull=True,
                activo=True
            ).first()

        # 3. Si tampoco hay, buscar notificación global (sin categoría)
        if not notif:
            notif = NotificacionServicio.objects.filter(
                categoria__isnull=True,
                activo=True
            ).first()

        if notif:
            for u in notif.usuarios.all():
                if u.email:
                    to_list.append(u.email)
            cc_list = notif.get_emails_cc_list()
            
    except Exception as e:
        logger.error(f"Error obteniendo NotificacionServicio: {e}")

    if not to_list:
        logger.warning(f"Ticket #{ticket.pk}: sin destinatarios configurados, email no enviado.")
        return

    subject = f"[InciTrack] Nuevo ticket #{ticket.pk}: {ticket.titulo}"

    # Construir URL absoluta para el botón "Ver Ticket" (ahora es SPA React)
    ticket_path = f"/incitrack/tickets/{ticket.pk}"
    ticket_url = request.build_absolute_uri(ticket_path) if request else ticket_path

    context = {'ticket': ticket, 'ticket_url': ticket_url}
    html_content = render_to_string('tickets/email/nuevo_ticket.html', context)
    text_content = render_to_string('tickets/email/nuevo_ticket.txt', context)

    t = threading.Thread(
        target=_enviar_en_hilo,
        args=(subject, to_list, cc_list, html_content, text_content),
        daemon=True,
    )
    t.start()
    logger.info(f"Ticket #{ticket.pk}: hilo de email iniciado → {to_list}")
