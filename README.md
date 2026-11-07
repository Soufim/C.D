# CDMS — Curriculum Development & Management System

A bilingual (Arabic / English) web application for **developing, standardising and linking
curricula** with the occupational classifications, competency standards, curriculum units,
qualification-framework levels, templates and reference data they depend on — with a governed
review workflow, impact analysis, versioning and a complete audit trail.

Built for sovereign, low-cost operation: open-source stack, runs on Ministry-controlled Linux
servers with Docker Compose, **no paid cloud services, AI APIs or per-user licences**.

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui-style components on Radix, TanStack Query, react-hook-form, i18next |
| Backend | Node.js 22, NestJS 11 (modular monolith), Drizzle ORM, zod |
| Data | PostgreSQL 16 (+ local file storage on an institutional volume) |
| Ops | Docker Compose, nginx, pino JSON logs, scripted backup/restore/release, GitHub Actions or `scripts/verify.sh` |

## What it does

- **Curricula** — create programmes from approved units, organised by term (mandatory /
  elective), aligned to a target occupation, qualification level and document template.
  Live **competency-coverage analysis**, readiness checks, **versioning** (new version from a
  published one; publishing supersedes the previous version), print-to-PDF document and JSON
  export.
- **Standards catalogue** — ISCO-08-aligned **occupational hierarchy** with competency
  profiles; **competency standards** with performance criteria; reusable **units** with
  learning outcomes; **qualification frameworks** (e.g. ENQF levels 1–8) and level descriptors;
  structured **templates** with required bilingual sections.
- **Governance** — draft → in review → approved → published → archived for every controlled
  record; comments required when returning; **four-eyes rule** (submitter cannot approve);
  **impact analysis** before changing shared records; published records are locked; deletes of
  referenced records are blocked by the database.
- **Data management** — controlled reference lists, institutions, CSV/JSON **import with dry
  run** (all-or-nothing, row-level errors), CSV/JSON exports and a full catalogue export.
- **Administration** — users, configurable roles/permissions, institution-scoped access,
  append-only **audit log** with field-level diffs, in-app notifications, review queue,
  standardisation gap report.
- **UX** — full RTL/LTR switching, light/dark themes, responsive down to 360 px (tables become
  cards, dialogs become bottom sheets), WCAG 2.2 AA-oriented components, global search (Ctrl K).

## Quick start (development)

Prerequisites: Node 22.12+, PostgreSQL 16 (or `docker compose -f deploy/compose.dev.yml up -d`).

```bash
npm ci
```

```bash
cp apps/api/.env.example apps/api/.env   # set SEED_ADMIN_PASSWORD / SEED_DEMO_PASSWORD for dev
```

```bash
npm run build -w @cdms/contracts && npm run build -w @cdms/api && npm run db:migrate && npm run db:seed
```

```bash
npm run dev:api     # http://localhost:3000  (OpenAPI docs at /api/docs in non-production)
```

```bash
npm run dev:web     # http://localhost:5173
```

Demo accounts (seeded when `SEED_DEMO_DATA=1`): `admin@`, `manager@`, `developer@`,
`reviewer@`, `viewer@cdms.local` — passwords are printed by the seed or set via env.

## Quality gate

```bash
./scripts/verify.sh
```

Runs formatting, lint (incl. accessibility and architecture rules), type checks, unit +
integration tests (real PostgreSQL), build, migration consistency and a runtime dependency
audit. E2E smoke tests (desktop + phone): `npm run e2e` with API and web running.

## Production

```bash
cp deploy/.env.example .env    # fill in secrets — never commit
```

```bash
./scripts/release.sh v0.1.0    # build → backup → migrate → start → health check
```

See [docs/operations.md](docs/operations.md) for environments, TLS, backups, disaster
recovery, monitoring, rollback, incident response and patching.

## Documentation

| Document | Purpose |
|---|---|
| [AGENTS.md](AGENTS.md) | Implementation rules for developers and AI coding agents |
| [docs/architecture.md](docs/architecture.md) | Architecture, module boundaries, ADRs |
| [docs/data-model.md](docs/data-model.md) | Database schema, integrity rules |
| [docs/api.md](docs/api.md) | API conventions, errors, versioning |
| [docs/design-system.md](docs/design-system.md) | Tokens, components, patterns, RTL, accessibility |
| [docs/ux-framework.md](docs/ux-framework.md) | Information architecture, page templates, journeys, usability validation |
| [docs/security.md](docs/security.md) | Threat model, OWASP ASVS mapping, privacy, pen-test & remediation |
| [docs/testing.md](docs/testing.md) | Test strategy and how to run each level |
| [docs/operations.md](docs/operations.md) | Deployment, backups, DR, monitoring, incidents, patching |
| [docs/governance.md](docs/governance.md) | AI-assisted development QA, reviews, phase gates, dependency policy |
| [docs/handover.md](docs/handover.md) | Asset register, ownership transfer, knowledge transfer, 5-year cost |

## Licence

All third-party components are permissive open source (MIT / Apache-2.0 / ISC / BSD / OFL
for fonts; PostgreSQL licence). See docs/handover.md §2 for the inventory.
