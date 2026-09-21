#!/bin/bash
# LegacyBTC Pool — rebuild script (memory-friendly)
# Stops containers, removes the old app image, then rebuilds and starts
# in stages: build app -> postgres (healthy) -> DB address -> app.
set -euo pipefail

cd "$(dirname "$0")"

COMPOSE="docker compose"
COMPOSE_FILE="docker-compose.yml"
IMAGE_NAME="legacybtc-pool_app:latest"
DB_CONTAINER="legacybtc-pool-postgres"
DB_IP_FILE="/tmp/btc_db_ip.txt"

echo "=== [1/4] Stopping and removing containers ==="
$COMPOSE -f "$COMPOSE_FILE" down || true
docker rm -f legacybtc-pool_app_1 legacybtc-pool_postgres_1 > /dev/null 2>&1 || true

echo "=== [2/4] Removing old image ==="
docker rmi -f "$IMAGE_NAME" > /dev/null 2>&1 || echo "Image $IMAGE_NAME not found or already removed"
docker image prune -f > /dev/null 2>&1 || true

echo "=== [3/4] Building app image ==="
$COMPOSE -f "$COMPOSE_FILE" build app

echo "=== [4/4] Starting postgres, then app ==="
$COMPOSE -f "$COMPOSE_FILE" up -d postgres

echo "--> Waiting for postgres to be healthy..."
STATUS=""
i=0
while [ "$STATUS" != "healthy" ] && [ "$i" -lt 60 ]; do
  STATUS=$(docker inspect -f '{{.State.Health.Status}}' "$DB_CONTAINER" 2>/dev/null || echo "missing")
  if [ "$STATUS" != "healthy" ]; then
    echo "    [$((i + 1))/60] $STATUS"
    sleep 1
  fi
  i=$((i + 1))
done

if [ "$STATUS" != "healthy" ]; then
  echo "!!! Postgres is not healthy — aborting"
  exit 1
fi

echo "--> Locating DB address..."
DB_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$DB_CONTAINER" 2>/dev/null || true)
if [[ ! "$DB_IP" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
  DB_IP=$(sed -nE 's#^DATABASE_URL=[a-z]+://[^@]*@([^:/]+).*#\1#p' ./config/pool.env | head -1)
fi
if [ -z "$DB_IP" ]; then
  DB_IP="127.0.0.1"
fi
echo "$DB_IP" > "$DB_IP_FILE"
echo "    $DB_IP -> $DB_IP_FILE"

$COMPOSE -f "$COMPOSE_FILE" up -d app

$COMPOSE -f "$COMPOSE_FILE" ps
echo ""
echo "==> DB IP: $(cat "$DB_IP_FILE")"
echo "==> Done. legacybtc-pool rebuilt and running."
