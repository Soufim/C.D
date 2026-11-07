#!/usr/bin/env bash
# CDMS restore from a backup directory created by scripts/backup.sh.
#   ./scripts/restore.sh /var/backups/cdms/20261107T013000Z
# DESTRUCTIVE: replaces the current database and uploaded files. Take a fresh backup first.
# Test this procedure regularly on a staging host (docs/operations.md → DR drills).
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] && set -a && . ./.env && set +a

SRC="${1:?usage: restore.sh <backup-dir>}"
COMPOSE="docker compose"
DB_USER="${POSTGRES_USER:-cdms}"
DB_NAME="${POSTGRES_DB:-cdms}"

echo "Verifying checksums in ${SRC}…"
( cd "${SRC}" && sha256sum --check --quiet SHA256SUMS )
cat "${SRC}/manifest.txt"

if [ "${CONFIRM:-}" != "yes" ]; then
  read -r -p "This will REPLACE database '${DB_NAME}' and all uploaded files. Type 'restore' to continue: " ans
  [ "${ans}" = "restore" ] || { echo "Aborted."; exit 1; }
fi

echo "Stopping application containers…"
${COMPOSE} stop web api

echo "Restoring database…"
${COMPOSE} exec -T db psql -U "${DB_USER}" -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS \"${DB_NAME}\" WITH (FORCE)" \
  -c "CREATE DATABASE \"${DB_NAME}\" OWNER \"${DB_USER}\""
${COMPOSE} exec -T db pg_restore -U "${DB_USER}" -d "${DB_NAME}" --no-owner --exit-on-error < "${SRC}/db.dump"

echo "Restoring files…"
${COMPOSE} run --rm --no-deps -T --entrypoint sh api -c 'find /data/storage -mindepth 1 -delete; tar -C /data -xzf -' < "${SRC}/storage.tar.gz"

echo "Starting application (pending migrations, if any, are applied by the migrate service)…"
${COMPOSE} up -d
echo "Restore complete. Verify: curl -fsS http://127.0.0.1:${HTTP_PORT:-8080}/api/v1/health/ready"
