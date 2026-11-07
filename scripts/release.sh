#!/usr/bin/env bash
# Controlled release on the production host:  ./scripts/release.sh v0.2.0
#  1. checks out the tag   2. builds images   3. takes a backup   4. migrates + starts
#  5. health-checks         6. on failure prints the rollback command
# Rollback (application only, when migrations were backward compatible):
#   ./scripts/release.sh <previous-tag>
# Rollback with data: ./scripts/restore.sh <backup-dir-printed-below>  (docs/operations.md)
set -euo pipefail
cd "$(dirname "$0")/.."
TAG="${1:?usage: release.sh <git-tag>}"
[ -f .env ] || { echo ".env missing (see deploy/.env.example)"; exit 1; }

git fetch --tags --quiet
git -c advice.detachedHead=false checkout --quiet "${TAG}"
export CDMS_VERSION="${TAG#v}"

echo "== Building ${CDMS_VERSION}"
docker compose build --pull

if docker compose ps --status running --services | grep -q '^db$'; then
  echo "== Pre-release backup"
  ./scripts/backup.sh
fi

echo "== Migrating and starting"
docker compose up -d --remove-orphans

echo "== Health check"
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${HTTP_PORT:-8080}/api/v1/health/ready" > /dev/null 2>&1; then
    echo "Release ${TAG} is healthy."
    exit 0
  fi
  sleep 2
done

echo "!! Release ${TAG} failed its health check."
docker compose logs --tail=100 migrate api
echo "Roll back with: ./scripts/release.sh <previous-tag>  (or restore the pre-release backup)"
exit 1
