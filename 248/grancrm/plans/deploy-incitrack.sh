#!/usr/bin/env bash
# Deploy InciTrack como microfrontend nativo (spa_remote).
# ── EJECUTAR COMO USUARIO `admincrm` ──  (incitrack/ es admincrm:admincrm 755; pancho no puede escribir ahí)
#   sudo -u admincrm bash /home/admincrm/grancrm/plans/deploy-incitrack.sh
# Rollback: sudo -u admincrm bash /home/admincrm/grancrm/plans/rollback-incitrack.sh
#
# Estado de partida verificado (2026-06-19):
#  - rama feature/incitrack-integration-base @ f7531cb ; código revisado en exec/incitrack-004
#  - DIOS YA tiene InciTrack como spa_remote (no se toca)
#  - gateway aún rutea /incitrack/ a Django (iframe-era) -> hay que aplicar el split
#  - bundle vivo en /staticfiles/mf/incitrack es del 2026-06-12 (se respalda y se reemplaza)
#  - el monorepo tiene WIP sin commitear de otros (orquestador/mcp/dashboard): NO usar reset --hard.
set -euo pipefail
REPO=/home/admincrm/grancrm
GW=/home/admincrm/gateway
MF=/home/admincrm/staticfiles/mf/incitrack
TS=$(date +%Y%m%d-%H%M%S)
echo "$TS" > "$REPO/plans/.incitrack-deploy-stamp"

echo "== [0] Backups (rollback) =="
cp "$GW/nginx.conf" "$GW/nginx.conf.bak-$TS"
[ -d "$MF" ] && cp -r "$MF" "${MF}.bak-$TS"
docker image tag "$(docker inspect -f '{{.Image}}' grancrm-incitrack)" "incitrack-rollback:$TS"
echo "   nginx -> nginx.conf.bak-$TS | bundle -> mf/incitrack.bak-$TS | imagen -> incitrack-rollback:$TS"

echo "== [1] Traer SOLO incitrack/ desde exec/incitrack-004 (no toca el WIP de orquestador/mcp/dashboard) =="
cd "$REPO"
git checkout exec/incitrack-004 -- incitrack
echo "   incitrack/ actualizado (api.py, frontend/, dios.json spa_remote, fix 401, etc.)"

echo "== [2] Rebuild + restart del backend (la imagen hornea api.py/utils/grancrm_auth/deps nuevas) =="
docker compose build incitrack-modulo
docker compose up -d incitrack-modulo
sleep 4
docker exec grancrm-incitrack python manage.py migrate --fake-initial   # la BD ya existe; marca 0001 sin recrear
docker exec grancrm-incitrack python manage.py check
curl -fs -o /dev/null -w '   api/v1/docs: %{http_code}\n' http://127.0.0.1:8000/incitrack/api/v1/docs

echo "== [3] Build del bundle MF al path que sirve el gateway =="
cd "$REPO/incitrack/frontend"
corepack pnpm install
VITE_MF_OUT_DIR="$MF" corepack pnpm build
test -f "$MF/remoteEntry.js" && echo "   remoteEntry.js OK"

echo "== [4] Gateway: aplicar el split (MANUAL, es lo más seguro) =="
echo "   Editá $GW/nginx.conf y reemplazá el bloque único:"
echo "       location /incitrack/ { proxy_pass http://127.0.0.1:8000; ... }"
echo "   por los 4 bloques de: $REPO/incitrack/deploy/nginx-incitrack.conf"
echo "   (api/admin/media -> :8000 ; catch-all /incitrack/ -> shell SPA). Luego:"
echo "       docker exec gateway-nginx-1 nginx -t && docker exec gateway-nginx-1 nginx -s reload"
echo
echo "== [5] Verificación post-gateway (corré a mano tras el paso 4) =="
echo "       curl -fsk -o /dev/null -w 'gw /incitrack/: %{http_code}\\n' https://127.0.0.1/incitrack/   # esperar 200 text/html (shell)"
echo "       y en el navegador: login -> InciTrack en Módulos -> monta como remoto (sin <iframe>) -> API 200."
echo
echo "Backend desplegado. Falta SOLO el paso [4] (gateway, manual). Rollback total: plans/rollback-incitrack.sh"
