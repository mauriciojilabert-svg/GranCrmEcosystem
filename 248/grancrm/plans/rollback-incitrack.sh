#!/usr/bin/env bash
# Rollback del deploy de InciTrack al estado previo (el de antes de correr deploy-incitrack.sh).
# EJECUTAR COMO `admincrm`:  sudo -u admincrm bash /home/admincrm/grancrm/plans/rollback-incitrack.sh
set -euo pipefail
REPO=/home/admincrm/grancrm
GW=/home/admincrm/gateway
MF=/home/admincrm/staticfiles/mf/incitrack
TS=$(cat "$REPO/plans/.incitrack-deploy-stamp")
echo "== Rollback del deploy $TS =="

echo "[1] Gateway -> backup"
cp "$GW/nginx.conf.bak-$TS" "$GW/nginx.conf"
docker exec gateway-nginx-1 nginx -t && docker exec gateway-nginx-1 nginx -s reload

echo "[2] Bundle MF -> jun-12 original"
rm -rf "$MF"
[ -d "${MF}.bak-$TS" ] && mv "${MF}.bak-$TS" "$MF"

echo "[3] Backend -> imagen previa"
docker image tag "incitrack-rollback:$TS" grancrm-incitrack-modulo:latest
docker compose up -d --force-recreate incitrack-modulo

echo "[4] Código incitrack/ -> f7531cb (no toca el WIP de orquestador/mcp/dashboard)"
cd "$REPO"
git checkout f7531cb -- incitrack

echo "Rollback completo. (Nota: el django_migrations de --fake-initial es inocuo; si querés, borrá la fila de la migración 0001 de incitrack.)"
