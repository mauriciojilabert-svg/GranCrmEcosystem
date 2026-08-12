"""
Inyecta el bloque de proxy para InciTrack en nginx.conf del gateway.
Busca 'location /crs/api/' como ancla e inserta justo antes.
Si ya existe, lo reemplaza con la versión correcta.
"""
import sys

NGINX_CONF = "/var/www/dash/gateway/nginx/nginx.conf"

INCITRACK_BLOCK = """    # --- InciTrack API proxy ---
    location /incitrack/api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

"""

try:
    with open(NGINX_CONF, 'r') as f:
        content = f.read()
except FileNotFoundError:
    print(f"ERROR: No se encontro {NGINX_CONF}")
    sys.exit(1)

# Primero limpiemos cualquier intento anterior mal formateado
# (sed puede haber dejado todo en una linea con \n literales)
import re
# Eliminar cualquier linea que tenga "InciTrack" y proxy_pass 8000 todo junto
content = re.sub(r'[^\n]*InciTrack API proxy[^\n]*\n?', '', content)
content = re.sub(r'\s*location /incitrack/api/\s*\{[^}]*\}\s*', '\n', content)
content = re.sub(r'\s*location /incitrack/\s*\{[^}]*\}\s*', '\n', content)
# Limpiar lineas vacias multiples
content = re.sub(r'\n{3,}', '\n\n', content)

# Ahora insertar el bloque limpio antes de location /crs/api/
anchor = "    location /crs/api/"
if anchor not in content:
    print("ERROR: No se encontro 'location /crs/api/' como ancla")
    print("Contenido actual:")
    print(content)
    sys.exit(1)

content = content.replace(anchor, INCITRACK_BLOCK + anchor)

with open(NGINX_CONF, 'w') as f:
    f.write(content)

print("OK: Bloque de InciTrack inyectado correctamente en nginx.conf")
print()
print("Verificacion - buscando 'incitrack' en el archivo:")
for i, line in enumerate(content.split('\n'), 1):
    if 'incitrack' in line.lower():
        print(f"  linea {i}: {line}")
