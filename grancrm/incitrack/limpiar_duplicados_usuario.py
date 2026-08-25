import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "incitrack.settings")
django.setup()

from tickets.models import Usuario, Ticket

def run():
    print("Buscando usuarios duplicados en la base de datos...")
    quintins = list(Usuario.objects.filter(nombre__icontains="Quintin"))
    print(f"Encontrados {len(quintins)} usuarios con nombre 'Quintin':")
    for q in quintins:
        count = Ticket.objects.filter(asignado_a=q).count()
        print(f" - ID: {q.id} | Nombre: {q.nombre} | Email: {q.email} | Rol: {q.rol} | Activo: {q.activo} | Tickets Asignados: {count}")
    
    if len(quintins) > 1:
        # El usuario principal será el que tenga más tickets o el primero activo
        principal = max(quintins, key=lambda u: Ticket.objects.filter(asignado_a=u).count())
        duplicados = [u for u in quintins if u.id != principal.id]
        
        print(f"\nUsuario principal seleccionado: ID {principal.id} ({principal.email})")
        for dup in duplicados:
            print(f"Reasignando tickets del usuario ID {dup.id} al usuario ID {principal.id}...")
            Ticket.objects.filter(asignado_a=dup).update(asignado_a=principal)
            Ticket.objects.filter(creado_por=dup).update(creado_por=principal)
            # Desactivar el duplicado
            dup.activo = False
            dup.save()
            print(f"Usuario ID {dup.id} desactivado correctamente.")
            
    print("\n✅ Proceso de limpieza finalizado con éxito.")

if __name__ == '__main__':
    run()
