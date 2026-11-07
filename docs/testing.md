# Testing

| Level | Tool | Location | Runs |
|---|---|---|---|
| Static | TypeScript strict, ESLint (+ jsx-a11y, architecture rules), Prettier | repo root | every change (`verify.sh`, CI) |
| Unit — contracts | Vitest | `packages/contracts/src/*.test.ts` | `npm test` |
| Unit — API helpers | Vitest | `apps/api/src/**/*.test.ts` | `npm test` |
| Integration — API (HTTP + real PostgreSQL) | Vitest + Supertest | `apps/api/test/*.test.ts` | `npm test` (creates `cdms_test`) |
| Unit — web components / i18n | Vitest + Testing Library + jsdom | `apps/web/src/test` | `npm test` |
| End-to-end (desktop + phone) | Playwright (local Chromium) | `apps/web/e2e` | `npm run e2e` with API + web running |
| Migration | drizzle-kit check | `apps/api` | `verify.sh`, CI |
| Dependencies / images | npm audit, Trivy | | `verify.sh`, CI |

## Running

```bash
TEST_DATABASE_URL=postgres://cdms:cdms@localhost:5432/cdms_test npm test
```

```bash
npm run e2e   # needs: API on :3000 seeded with SEED_DEMO_PASSWORD=Demo-Passw0rd-2026, web on :5173
```

The integration suite refuses to reset any database whose name does not end in `_test`.

## What the integration suite covers

Authentication (protected routes, tampered tokens, generic errors, lockout, refresh rotation
and reuse revocation, cookie flags) · authorisation (permission denials, privilege-escalation
guard, institution scoping with 404) · validation (malformed ids, problem details) · integrity
(optimistic locking, partial updates keep omitted fields, edit locks, case-insensitive
duplicates, hierarchy cycles, referenced-record protection, publish readiness) · workflow
(mandatory return comment, four-eyes, history) · versioning · audit (diffs, DB-level
append-only) · files (content sniffing, download headers) · import (dry run, all-or-nothing)
· export (CSV formula neutralisation).

## Required scenarios for new work (checklist)

- Permission denied for each role that must not act; out-of-scope access → 404
- Invalid relationships (archived/missing targets), duplicates, stale `rowVersion`
- Locked-status edits; publish with unpublished dependencies
- Failed / partial imports; malformed CSV/JSON; oversized files
- Both languages in the UI; 360 px layout; keyboard-only flow
- Browser matrix before release: latest Chrome, Edge, Firefox, Safari (macOS/iOS), Chrome
  Android — run the E2E suite (Chromium) plus a manual pass of the reference screens

## User acceptance testing

UAT scripts are derived from the journeys in ux-framework.md §3, executed by Ministry users on
the staging environment with production-like (anonymised or synthetic) data, signed off per
phase gate.
