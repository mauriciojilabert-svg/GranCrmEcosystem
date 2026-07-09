from django.apps import AppConfig


class TicketsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'tickets'
    verbose_name = 'InciTrack'

    def ready(self):
        from utils.dios_registration import register_with_dios, notify_schema_updated
        register_with_dios()
        notify_schema_updated()
