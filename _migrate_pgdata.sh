#!/bin/bash
# Migrate legacybtc-pool postgres data out of the build context to /srv/legacybtc-pool/postgres
set -euo pipefail

SRC="/home/coin/legacybtc-pool/postgresql-data"
DST="/srv/legacybtc-pool/postgres"

echo "=== Stopping postgres container ==="
docker stop legacybtc-pool_postgres_1 || true

echo "=== Creating $DST ==="
mkdir -p "$DST"

echo "=== Moving data (ownership 70:root preserved) ==="
cp -a "$SRC"/. "$DST"/
chown -R 70:70 "$DST"
chmod 700 "$DST"

echo "=== Verifying ==="
du -sh "$DST"
ls "$DST" | head

echo "=== Backing up old dir ==="
mv "$SRC" "${SRC}.old"
