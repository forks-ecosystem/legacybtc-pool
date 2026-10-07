#!/bin/sh
set -e

echo "Waiting for PostgreSQL..."
until psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1; do
  sleep 1
done
echo "PostgreSQL is ready"

echo "Starting application..."
exec "$@"
