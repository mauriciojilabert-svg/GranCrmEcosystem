# Instrucciones de Despliegue en Producción (172.20.21.10)

Sigue estos pasos en tu terminal PuTTY conectada a `172.20.21.10` para desplegar InciTrack.

## 1. Descargar el Código Limpio
Ve a la ruta raíz `/var/www/dash` (donde vive el orquestador) y clona el ecosistema limpio:

```bash
cd /var/www/dash
git clone https://github.com/mauriciojilabert-svg/GranCrmEcosystem.git grancrm
cd grancrm
```
*(Si te pide credenciales, ingresa las tuyas de GitHub o usa un token).*

## 2. Configurar Variables de Entorno (.env)
Copia la plantilla de producción que acabamos de armar hacia la carpeta interna de InciTrack:

```bash
cd /var/www/dash/grancrm/incitrack
cp ../deploy_prod/.env.prod.example .env
```
*(Puedes revisar que todo esté en orden ejecutando `cat .env`)*.

## 3. Registrar el Módulo en el Orquestador
Copia el archivo `dios` hacia la carpeta del Orquestador para que el frontend lo cargue en el menú lateral:

```bash
cp /var/www/dash/grancrm/deploy_prod/dios_incitrack.json /var/www/dash/orquestador/modulos/dios_incitrack.json
```

## 4. Modificar docker-compose.yml y Levantar
Asegúrate de que `/var/www/dash/grancrm/docker-compose.yml` esté listo para producción (que el contenedor `incitrack-modulo` esté mapeado a la red de producción).
Para iniciar el servicio:

```bash
cd /var/www/dash/grancrm
sudo docker compose build incitrack-modulo
sudo docker compose up -d incitrack-modulo
```

## 5. Ejecutar Migraciones (Poblamiento)
Como es una base de datos nueva/limpia, es obligatorio correr las migraciones y luego el poblamiento de categorías base.

```bash
# 1. Crear las tablas en ProdOrquestador
sudo docker compose exec incitrack-modulo python manage.py migrate

# 2. Llenar las categorías iniciales
sudo docker compose exec incitrack-modulo python manage.py poblar_categorias_qa
```

¡Listo! Ve a `https://dash.in-touchcrm.cl` y prueba InciTrack.
