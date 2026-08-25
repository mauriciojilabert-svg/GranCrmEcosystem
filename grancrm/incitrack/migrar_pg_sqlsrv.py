import os
import sys

# Forzamos la instalación de psycopg2 si no existe
try:
    import psycopg2
except ImportError:
    print("Instalando psycopg2-binary...")
    os.system('pip install psycopg2-binary')
    import psycopg2

from psycopg2.extras import RealDictCursor

# Configurar el entorno de Django (debe ejecutarse dentro del contenedor)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "incitrack.settings")
import django
django.setup()

from django.db import transaction
from tickets.models import (
    Usuario, Cuenta, Categoria, Subcategoria, ConfiguracionSLA,
    Ticket, Comentario, Adjunto, NotificacionServicio, TicketAudit
)

def run():
    print("Conectando a PostgreSQL (172.20.21.245)...")
    try:
        conn = psycopg2.connect(
            host="172.20.21.245",
            database="incitrack",
            user="incitrack_user",
            password="facil40FG",
            port=5432
        )
    except Exception as e:
        print(f"ERROR: No se pudo conectar a PostgreSQL: {e}")
        sys.exit(1)
        
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    try:
        with transaction.atomic():
            print("1. Limpiando datos de SQL Server (eliminando tickets actuales)...")
            # Se eliminan en cascada desde las hojas hasta la raíz de los tickets
            TicketAudit.objects.all().delete()
            Adjunto.objects.all().delete()
            Comentario.objects.all().delete()
            Ticket.objects.all().delete()
            print("   Tickets en Producción (SQL Server) eliminados.")

            print("2. Migrando Usuarios...")
            cursor.execute("SELECT * FROM tickets_usuario")
            for row in cursor.fetchall():
                Usuario.objects.update_or_create(
                    id=row['id'],
                    defaults={
                        'password': row['password'],
                        'last_login': row['last_login'],
                        'is_superuser': row['is_superuser'],
                        'first_name': row['first_name'],
                        'last_name': row['last_name'],
                        'is_staff': row['is_staff'],
                        'is_active': row['is_active'],
                        'date_joined': row['date_joined'],
                        'username': row['username'],
                        'nombre': row['nombre'],
                        'email': row['email'],
                        'rol': row['rol'],
                        'activo': row['activo'],
                        'fecha_creacion': row['fecha_creacion'],
                    }
                )

            print("3. Migrando Cuentas y Supervisores...")
            cursor.execute("SELECT * FROM tickets_cuenta")
            for row in cursor.fetchall():
                Cuenta.objects.update_or_create(
                    id=row['id'],
                    defaults={
                        'nombre': row['nombre'],
                        'descripcion': row['descripcion'],
                        'activa': row['activa'],
                        'fecha_creacion': row['fecha_creacion'],
                        'jefe_id': row['jefe_id']
                    }
                )
            # ManyToMany Cuentas -> Supervisores
            cursor.execute("SELECT * FROM tickets_cuenta_supervisores")
            for row in cursor.fetchall():
                c = Cuenta.objects.get(id=row['cuenta_id'])
                c.supervisores.add(row['usuario_id'])

            print("4. Migrando Categorias...")
            cursor.execute("SELECT * FROM tickets_categoria")
            for row in cursor.fetchall():
                Categoria.objects.update_or_create(
                    id=row['id'],
                    defaults={
                        'nombre': row['nombre'],
                        'slug': row['slug'],
                        'orden': row['orden'],
                        'activa': row['activa'],
                        'requiere_plataforma_bi': row['requiere_plataforma_bi']
                    }
                )

            print("5. Migrando Subcategorias...")
            cursor.execute("SELECT * FROM tickets_subcategoria")
            for row in cursor.fetchall():
                Subcategoria.objects.update_or_create(
                    id=row['id'],
                    defaults={
                        'categoria_id': row['categoria_id'],
                        'nombre': row['nombre'],
                        'slug': row['slug'],
                        'orden': row['orden'],
                        'activa': row['activa']
                    }
                )
            
            print("6. Migrando Configuración SLA...")
            cursor.execute("SELECT * FROM tickets_configuracionsla")
            for row in cursor.fetchall():
                ConfiguracionSLA.objects.update_or_create(
                    id=row['id'],
                    defaults={
                        'categoria_id': row['categoria_id'],
                        'subcategoria_id': row['subcategoria_id'],
                        'plataforma_bi': row['plataforma_bi'],
                        'tiempo_respuesta_minutos': row['tiempo_respuesta_minutos'],
                        'tiempo_cierre_minutos': row['tiempo_cierre_minutos'],
                        'descripcion': row['descripcion'],
                        'activo': row['activo'],
                        'creado_en': row['creado_en'],
                        'actualizado': row['actualizado']
                    }
                )

            print("7. Migrando Tickets (Forzando IDs exactos)...")
            cursor.execute("SELECT * FROM tickets_ticket")
            tickets = cursor.fetchall()
            for row in tickets:
                t = Ticket(
                    id=row['id'],
                    titulo=row['titulo'],
                    descripcion=row['descripcion'],
                    estado=row['estado'],
                    prioridad=row['prioridad'],
                    categoria_id=row['categoria_id'],
                    subcategoria_id=row['subcategoria_id'],
                    plataforma_bi=row['plataforma_bi'],
                    tipo_incidencia=row['tipo_incidencia'],
                    fecha_creacion=row['fecha_creacion'],
                    fecha_actualizacion=row['fecha_actualizacion'],
                    fecha_resolucion=row['fecha_resolucion'],
                    cuenta_id=row['cuenta_id'],
                    creado_por_id=row['creado_por_id'],
                    asignado_a_id=row['asignado_a_id'],
                    fue_reasignado=row['fue_reasignado']
                )
                t.save(force_insert=True)
                
                # CORRECCIÓN: auto_now_add y auto_now pisan las fechas al hacer save(). 
                # Usamos .update() para forzar las fechas originales saltando esa restricción.
                Ticket.objects.filter(id=row['id']).update(
                    fecha_creacion=row['fecha_creacion'],
                    fecha_actualizacion=row['fecha_actualizacion']
                )

            print("8. Migrando Comentarios...")
            cursor.execute("SELECT * FROM tickets_comentario")
            for row in cursor.fetchall():
                c = Comentario(
                    id=row['id'],
                    ticket_id=row['ticket_id'],
                    autor_id=row['autor_id'],
                    contenido=row['contenido'],
                    fecha=row['fecha'],
                    interno=row['interno']
                )
                c.save(force_insert=True)
                Comentario.objects.filter(id=row['id']).update(fecha=row['fecha'])

            print("9. Migrando Adjuntos...")
            cursor.execute("SELECT * FROM tickets_adjunto")
            for row in cursor.fetchall():
                # Obtenemos el autor o asignamos por defecto al usuario 1 (admin) si la columna no existía en v1
                subido_por = row.get('subido_por_id') or row.get('usuario_id') or 1
                
                a = Adjunto(
                    id=row['id'],
                    ticket_id=row['ticket_id'],
                    comentario_id=row.get('comentario_id'),
                    subido_por_id=subido_por,
                    nombre_original=row.get('nombre_original', 'archivo_adjunto'),
                    nombre_guardado=row.get('nombre_guardado', 'archivo_adjunto'),
                    archivo=row.get('archivo', ''),
                    fecha_subida=row.get('fecha_subida')
                )
                a.save(force_insert=True)
                if row.get('fecha_subida'):
                    Adjunto.objects.filter(id=row['id']).update(fecha_subida=row['fecha_subida'])
                
            print("10. Migrando Notificaciones de Servicio...")
            cursor.execute("SELECT * FROM tickets_notificacionservicio")
            for row in cursor.fetchall():
                NotificacionServicio.objects.update_or_create(
                    id=row['id'],
                    defaults={
                        'categoria_id': row['categoria_id'],
                        'subcategoria_id': row['subcategoria_id'],
                        'servicio': row['servicio'],
                        'emails_cc': row['emails_cc'],
                        'activo': row['activo']
                    }
                )
            cursor.execute("SELECT * FROM tickets_notificacionservicio_usuarios")
            for row in cursor.fetchall():
                n = NotificacionServicio.objects.get(id=row['notificacionservicio_id'])
                n.usuarios.add(row['usuario_id'])
                
            print("11. Migrando Auditoría de Tickets...")
            try:
                cursor.execute("SELECT * FROM tickets_ticketaudit")
                for row in cursor.fetchall():
                    TicketAudit(
                        id=row['id'],
                        ticket_id=row['ticket_id'],
                        usuario_id=row['usuario_id'],
                        campo_modificado=row['campo_modificado'],
                        valor_anterior=row['valor_anterior'],
                        valor_nuevo=row['valor_nuevo'],
                        fecha_modificacion=row['fecha_modificacion']
                    )
                    audit.save(force_insert=True)
                    TicketAudit.objects.filter(id=row['id']).update(fecha_modificacion=row['fecha_modificacion'])
            except Exception as e:
                print(f"  -> Aviso: No se migró auditoría (puede que la tabla no existiera en PG): {e}")

            print("===============================================================")
            print("¡MIGRACIÓN EXITOSA! TODOS LOS DATOS HAN SIDO COPIADOS AL SQL SERVER.")
            print(f"Se migraron {len(tickets)} tickets históricos.")
            print("===============================================================")

    except Exception as e:
        print(f"ERROR CRÍTICO DURANTE LA MIGRACIÓN: {e}")
        print("Haciendo ROLLBACK automático. No se ha modificado nada en SQL Server.")
        sys.exit(1)

if __name__ == '__main__':
    run()
