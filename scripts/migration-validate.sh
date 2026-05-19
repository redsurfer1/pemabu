#!/bin/sh
set -e

# Validate all supabase migrations against a live Postgres instance.
# Designed to run in CI with a Postgres service container.
# Usage: DB_HOST=localhost DB_PORT=5432 DB_USER=postgres DB_PASSWORD=postgres DB_NAME=postgres ./scripts/migration-validate.sh

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
DB_NAME="${DB_NAME:-postgres}"

export PGPASSWORD="${DB_PASSWORD}"

MIGRATIONS_DIR="supabase/migrations"

if [ ! -d "${MIGRATIONS_DIR}" ]; then
  echo "ERROR: ${MIGRATIONS_DIR} not found. Run from project root." >&2
  exit 1
fi

echo "Migration validation starting (host=${DB_HOST} port=${DB_PORT})"

# Test connection
if ! psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 1" > /dev/null 2>&1; then
  echo "ERROR: Cannot connect to Postgres at ${DB_HOST}:${DB_PORT}" >&2
  exit 1
fi

echo "Connected to Postgres. Applying migrations sequentially..."

count=0
error_count=0

for f in $(ls "${MIGRATIONS_DIR}"/*.sql | sort); do
  name=$(basename "${f}")
  echo "  Applying ${name} ..."
  if psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -f "${f}" > /dev/null 2>&1; then
    count=$((count + 1))
    echo "    ✓"
  else
    echo "    ✗ FAILED" >&2
    error_count=$((error_count + 1))
    # Roll back by dropping public schema (safe for ephemeral CI)
    psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
      -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" > /dev/null 2>&1 || true
  fi
done

echo ""
echo "Applied ${count} migration(s) successfully."

if [ "${error_count}" -gt 0 ]; then
  echo "ERROR: ${error_count} migration(s) failed." >&2
  exit 1
fi

echo "All migrations valid ✓"
