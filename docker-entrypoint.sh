#!/bin/sh
set -e

echo "Waiting for PostgreSQL..."
until PGPASSWORD=btcpass123 psql -h 127.0.0.1 -p 5433 -U btcpool -d btc_pool -c "SELECT 1" > /dev/null 2>&1; do
  sleep 1
done
echo "PostgreSQL is ready"

echo "Starting application..."
exec "$@"
