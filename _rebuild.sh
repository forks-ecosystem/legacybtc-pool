#!/bin/bash
# LegacyBTC Pool — rebuild script (memory-friendly)
# Stops containers, removes the old app image, then rebuilds and starts.
set -euo pipefail

cd "$(dirname "$0")"

COMPOSE="docker compose"
COMPOSE_FILE="docker-compose.yml"
IMAGE_NAME="legacybtc-pool_app:latest"

echo "=== [1/3] Stopping and removing containers ==="
$COMPOSE -f "$COMPOSE_FILE" down || true
docker rm -f legacybtc-pool_app_1 legacybtc-pool_postgres_1 > /dev/null 2>&1 || true

echo "=== [2/3] Removing old image ==="
docker rmi -f "$IMAGE_NAME" > /dev/null 2>&1 || echo "Image $IMAGE_NAME not found or already removed"
docker image prune -f > /dev/null 2>&1 || true

echo "=== [3/3] Rebuilding and starting ==="
$COMPOSE -f "$COMPOSE_FILE" up -d --build
$COMPOSE -f "$COMPOSE_FILE" ps
