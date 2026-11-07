#!/usr/bin/env bash
# Runs the full quality gate locally — the same checks as CI, with no dependency on any paid
# CI service. Requires Node 22 and a PostgreSQL server reachable via TEST_DATABASE_URL
# (default postgres://cdms:cdms@localhost:5432/cdms_test; the role needs CREATEDB).
set -euo pipefail
cd "$(dirname "$0")/.."

step() { printf '\n\033[1m== %s\033[0m\n' "$*"; }

step "Install (locked)";          npm ci --no-audit --no-fund
step "Format";                    npm run format:check
step "Lint (incl. a11y + architecture rules)"; npm run lint
step "Type check";                npm run typecheck
step "Unit + integration tests";  npm test
step "Build";                     npm run build
step "Migrations up to date";     (cd apps/api && npx drizzle-kit check)
step "Dependency audit (runtime)"; npm audit --omit=dev --audit-level=high
if command -v docker > /dev/null && docker info > /dev/null 2>&1; then
  step "Container images";        docker compose build
  if command -v trivy > /dev/null; then
    step "Image scan (trivy)"
    trivy image --exit-code 1 --severity HIGH,CRITICAL --ignore-unfixed cdms/api:latest
    trivy image --exit-code 1 --severity HIGH,CRITICAL --ignore-unfixed cdms/web:latest
  fi
fi
printf '\n\033[32mAll checks passed.\033[0m\n'
