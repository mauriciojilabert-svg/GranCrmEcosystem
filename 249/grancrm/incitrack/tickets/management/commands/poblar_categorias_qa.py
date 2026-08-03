from django.core.management.base import BaseCommand
from tickets.models import Categoria, Subcategoria
from django.utils.text import slugify

class Command(BaseCommand):
    help = 'Puebla las categorías y subcategorías iniciales para QA basándose en el entorno DEV.'

    def handle(self, *args, **options):
        # 1. Telefonía
        cat_telefonia, created = Categoria.objects.get_or_create(
            slug='telefonia',
            defaults={
                'nombre': 'Telefonía',
                'orden': 1,
                'requiere_plataforma_bi': False,
                'activa': True
            }
        )
        if created:
            self.stdout.write(self.style.SUCCESS('Categoría Telefonía creada.'))

        subcats_telefonia_gestion = [
            ('gestion-ajuste-horarios', 'Ajuste de Horarios Inbound'),
            ('gestion-colas', 'Configuracion de Colas de Servicio'),
            ('gestion-ivr', 'Gestion de IVR y Grabaciones'),
            ('gestion-feriados', 'Programacion de Feriados'),
        ]

        subcats_telefonia_incidente = [
            ('incidente-anexo', 'Anexo'),
            ('incidente-audio', 'Audio'),
            ('incidente-audio-entrecortado', 'Audio entrecortado / Sin tono / Llamada cruzada / xlite'),
            ('incidente-caida-softcall', 'Caida de Softcall / Registro'),
            ('incidente-caida', 'Caida Softcall'),
            ('incidente-conexion', 'Errores de Conexion'),
            ('incidente-ingresa-xlite', 'Ingresa llamada por Xlite'),
            ('incidente-problemas-anexos', 'Problemas de Anexos / Stations'),
            ('incidente-sin-conexion', 'Sin conexion'),
            ('incidente-sin-tono', 'Sin tono'),
            ('incidente-station', 'Station'),
        ]

        # 2. Plataformas BI
        cat_bi, created = Categoria.objects.get_or_create(
            slug='plataformas-bi',
            defaults={
                'nombre': 'Plataformas BI',
                'orden': 2,
                'requiere_plataforma_bi': True,
                'activa': True
            }
        )
        if created:
            self.stdout.write(self.style.SUCCESS('Categoría Plataformas BI creada.'))

        subcats_bi = [
            ('actualizacion-fallida', 'Actualizacion fallida'),
            ('inconsistencia-de-informacion', 'Inconsistencia de informacion'),
            ('modificar-campana', 'Modificar campana'),
            ('nueva-reporteria', 'Nueva reporteria'),
            ('nuevo-analisis', 'Nuevo analisis en reporteria existente'),
        ]

        def create_subcats(cat, subcats_list):
            for i, (slug, nombre) in enumerate(subcats_list):
                subcat, created = Subcategoria.objects.get_or_create(
                    categoria=cat,
                    slug=slug,
                    defaults={
                        'nombre': nombre,
                        'orden': i + 1,
                        'activa': True
                    }
                )
                if created:
                    self.stdout.write(self.style.SUCCESS(f'Subcategoría {nombre} creada.'))

        create_subcats(cat_telefonia, subcats_telefonia_gestion)
        create_subcats(cat_telefonia, subcats_telefonia_incidente)
        create_subcats(cat_bi, subcats_bi)

        self.stdout.write(self.style.SUCCESS('¡Base de datos de QA poblada exitosamente!'))
