#!/bin/sh
# Docker HEALTHCHECK: verify DB still reachable from worker network.
set -e
PGHOST="${PGHOST:-db}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-pemabu}"
PGDATABASE="${PGDATABASE:-pemabu_vault}"
pg_isready -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" -q
