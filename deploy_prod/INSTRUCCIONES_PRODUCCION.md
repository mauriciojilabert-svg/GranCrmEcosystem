# Instrucciones de Despliegue en Producción (172.20.21.10)

Sigue estos pasos en tu terminal PuTTY conectada a `172.20.21.10` para desplegar InciTrack.

## 1. Descargar el Código Limpio
Asegúrate de estar en la carpeta donde tienes GranCRM y bájate la última versión de la rama principal (la cual ya no tiene la basura del dashboard).

```bash
cd /home/admincrm/grancrm
git pull origin main
```

## 2. Configurar Variables de Entorno (.env)
Si aún no existe el archivo `.env` para InciTrack, usa la plantilla que armamos:

```bash
cd grancrm/incitrack
cp ../../deploy_prod/.env.prod.example .env
```
*(Si ya existe, verifica que los datos en `grancrm/incitrack/.env` coincidan con lo que tenemos en `deploy_prod/.env.prod.example`)*.

## 3. Registrar el Módulo en el Orquestador
Copia el manifiesto al Orquestador para que aparezcan los botones de InciTrack en el menú lateral:

```bash
cp ../../deploy_prod/dios_incitrack.json /home/admincrm/grancrm/modulos/dios_incitrack.json
```

## 4. Modificar docker-compose.yml de Producción
Si el archivo `docker-compose.yml` en la raíz (`/home/admincrm/grancrm/docker-compose.yml`) aún no tiene el contenedor de InciTrack, debes asegurarte de que el servicio esté listado (y que la red de Docker permita la comunicación con Nginx).
Para iniciar/reiniciar todo:

```bash
cd /home/admincrm/grancrm
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
