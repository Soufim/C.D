#!/usr/bin/env bash
# CDMS backup: PostgreSQL logical dump (custom format) + uploaded files + checksum manifest.
# Schedule with cron/systemd timer on the Docker host, e.g. daily at 01:30:
#   30 1 * * *  cd /opt/cdms && ./scripts/backup.sh >> /var/log/cdms-backup.log 2>&1
# Copy BACKUP_DIR to separate storage (another server / institutional NAS) — see docs/operations.md.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] && set -a && . ./.env && set +a

BACKUP_DIR="${BACKUP_DIR:-/var/backups/cdms}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TARGET="${BACKUP_DIR}/${STAMP}"
COMPOSE="docker compose"

umask 077
mkdir -p "${TARGET}"

echo "[$(date -u +%FT%TZ)] backup start → ${TARGET}"

# 1. Database (consistent snapshot; custom format allows selective restore).
${COMPOSE} exec -T db pg_dump -U "${POSTGRES_USER:-cdms}" -d "${POSTGRES_DB:-cdms}" \
  --format=custom --compress=6 --no-owner --no-privileges > "${TARGET}/db.dump"

# 2. Uploaded files (read from the api container's volume).
${COMPOSE} exec -T api tar -C /data -czf - storage > "${TARGET}/storage.tar.gz"

# 3. Release metadata (which version produced this backup).
{
  echo "created_utc=${STAMP}"
  echo "cdms_version=${CDMS_VERSION:-unknown}"
  echo "git_commit=$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
  ${COMPOSE} exec -T db psql -U "${POSTGRES_USER:-cdms}" -d "${POSTGRES_DB:-cdms}" -Atc \
    "select 'last_migration=' || max(created_at) from drizzle.__drizzle_migrations" || true
} > "${TARGET}/manifest.txt"

# 4. Integrity checksums (verified by restore.sh).
( cd "${TARGET}" && sha256sum db.dump storage.tar.gz manifest.txt > SHA256SUMS )

# 5. Sanity check: the dump must be readable.
${COMPOSE} exec -T db pg_restore --list < "${TARGET}/db.dump" > /dev/null

# 6. Retention.
find "${BACKUP_DIR}" -mindepth 1 -maxdepth 1 -type d -mtime "+${RETENTION_DAYS}" -print -exec rm -r {} +

echo "[$(date -u +%FT%TZ)] backup ok ($(du -sh "${TARGET}" | cut -f1))"
