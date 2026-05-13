#!/bin/sh
set -e

# Wait for the vault Postgres container before starting the Watcher (avoids crash on compose up).
# Requires libpq client env vars (set in docker-compose for `worker`).

if [ -z "${PGHOST}" ]; then
  echo "[watcher-entrypoint] PGHOST is not set. Export PGHOST (e.g. db or 127.0.0.1) for pg_isready." >&2
  exit 1
fi

PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-pemabu}"
PGDATABASE="${PGDATABASE:-pemabu_vault}"

echo "[watcher-entrypoint] waiting for Postgres at ${PGHOST}:${PGPORT} (${PGDATABASE}) ..."

attempt=0
max=90
until pg_isready -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" -q; do
  attempt=$((attempt + 1))
  if [ "${attempt}" -ge "${max}" ]; then
    echo "[watcher-entrypoint] Postgres not ready after ${max}s" >&2
    exit 1
  fi
  sleep 1
done

echo "[watcher-entrypoint] Postgres is ready; starting Watcher."
exec npx tsx services/watcher/index.ts
