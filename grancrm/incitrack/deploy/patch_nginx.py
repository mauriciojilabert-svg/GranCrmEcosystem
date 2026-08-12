import sys

NGINX_CONF = "/var/www/dash/gateway/nginx/nginx.conf"

try:
    with open(NGINX_CONF, 'r') as f:
        content = f.read()
except FileNotFoundError:
    print(f"Error: No se encontró el archivo {NGINX_CONF}")
    sys.exit(1)

if "location /incitrack/api/" in content:
    print("El proxy para InciTrack ya existe en nginx.conf")
    sys.exit(0)

BLOCK = """
    # --- InciTrack API proxy ---
    location /incitrack/api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # --- InciTrack SPA shell ---
    location /incitrack/ {
        root /var/www/dash/staticfiles/shell;
        try_files $uri /index.html;
    }
"""

if "location /crs/api/" in content:
    content = content.replace("location /crs/api/", BLOCK + "\n    location /crs/api/")
    with open(NGINX_CONF, 'w') as f:
        f.write(content)
    print("¡Bloque de InciTrack agregado exitosamente a nginx.conf!")
else:
    print("Error: No se encontró 'location /crs/api/' en nginx.conf. No se pudo inyectar.")
    sys.exit(1)
