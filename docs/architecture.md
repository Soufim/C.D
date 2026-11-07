# Architecture

## 1. Context

```
 Browser (desktop / tablet / phone)
      │ HTTPS (TLS at Ministry reverse proxy or nginx)
      ▼
 ┌──────────────── Docker host (Ubuntu Server LTS) ─────────────────┐
 │  web: nginx (static SPA + CSP)  ──/api──►  api: NestJS (Node 22)  │
 │                                            │        │             │
 │                                    PostgreSQL 16   file volume    │
 │                                    (db-data)       (file-storage) │
 └───────────────────────────────────────────────────────────────────┘
        ▲ backups (pg_dump + tar) → separate institutional storage
        ▲ optional: Ministry IdP (OIDC/SAML) — see ADR-006
```

Single origin: the browser talks only to nginx, which serves the SPA and proxies `/api` to the
API container. No CORS in production, SameSite=Strict refresh cookies work, and only one port
is exposed.

## 2. Modular monolith

One deployable API process, internally split into modules with explicit boundaries:

| Layer | Modules | Notes |
|---|---|---|
| Platform (global) | `config`, `database`, `auth`, `audit`, `workflow`, `notifications`, `health` | Cross-cutting; every domain module may use their exported services |
| Standardisation | `frameworks`, `catalog` (occupations, competencies, units, impact), `templates`, `reference-data`, `institutions` | Shared reference information |
| Curriculum | `curricula` | Composes catalogue records; versioning, coverage, readiness |
| Platform features | `files`, `import-export`, `insights` (dashboard, search, reports), `admin` (users, roles) | |

Rules (enforced by review + lint): controllers are thin; services own rules and data access;
modules talk through exported services; shared contracts live in `packages/contracts`.

**Layering inside a module**

```
HTTP ──► Controller (route, permission policy, zod validation via @ZBody/@ZQuery)
          └► Service (business rules, transactions, audit, workflow validators)
               └► Drizzle (typed SQL) ──► PostgreSQL (constraints, FKs, triggers)
```

A separate repository layer was deliberately not added: Drizzle already is a thin typed data
access layer, and an extra abstraction would add code without isolating anything useful
(see ADR-002). Data-access helpers shared across modules live in `common/crud.ts` and
`common/util.ts`.

### Workflow engine
`WorkflowService` implements one state machine (`WORKFLOW_ACTIONS` in contracts) for all
controlled entities registered in `workflow.registry.ts`. Domain services register:
- **validators** — return `ValidationIssue[]` (errors block, warnings inform); also exposed
  read-only via `GET /workflow/:type/:id/check?action=` so the UI shows readiness first;
- **after-hooks** — run in the same transaction (e.g. publishing curriculum v2 archives v1).

It also enforces per-action permissions, optimistic locking, mandatory comments on return,
the four-eyes rule, writes `workflow_events`, audit entries and notifications atomically.

### Frontend architecture

```
main.tsx → QueryClientProvider → AuthProvider → RouterProvider (lazy routes)
  AppShell (sidebar, search, notifications, language/theme)
    features/<feature>/<Page>.tsx  ── uses ── components/patterns ── components/ui (Radix)
                                   └─ lib/resources | feature api.ts ── lib/api (fetch, refresh)
```

- Server state in TanStack Query; URL holds list state; no global client store.
- Access token in memory only; refresh token is an httpOnly SameSite=Strict cookie scoped to
  `/api/v1/auth`.
- Shared zod schemas validate forms client-side and requests server-side.

## 3. Quality attributes

| Attribute | Approach |
|---|---|
| Security | Fail-closed guard, permission-based RBAC + institution scoping in services, argon2id, token rotation with reuse detection, lockout, rate limiting, helmet/CSP, content-sniffed uploads, append-only audit (DB trigger) — docs/security.md |
| Integrity | FKs `ON DELETE RESTRICT`, unique case-insensitive codes, check constraints, hierarchy cycle trigger, transactions + optimistic locking, status-based edit locks, impact analysis |
| Maintainability | One language (TypeScript) end-to-end, shared contracts, small dependency set, AGENTS.md rules, lint guardrails |
| Portability | Plain PostgreSQL + SQL migrations in git, JSON/CSV exports, Docker images, no proprietary services |
| Performance | Indexed FKs, trigram indexes for search, server pagination, code-split routes; sized for hundreds of concurrent users on 2 vCPU / 4 GB |
| Accessibility & i18n | WCAG 2.2 AA component rules, RTL/LTR, bilingual data model |

## 4. ADRs

**ADR-001 Modular monolith over microservices.** Expected load (Ministry staff, institutions)
and team size do not justify distributed systems. One process + one database keeps operations
to `docker compose`, enables ACID transactions across curriculum + audit + workflow, and can
be split later along existing module boundaries if ever needed.

**ADR-002 Drizzle ORM (instead of Prisma/TypeORM).** Pure TypeScript, no native engine
binaries to download at install/runtime (works in air-gapped hosts), SQL-first migrations that
are reviewed as plain SQL in git, typed queries close to SQL. Trade-off: fewer abstractions —
accepted; rules in AGENTS.md cover the pitfalls (qualified columns in correlated sub-queries).

**ADR-003 Local JWT access tokens + rotating opaque refresh tokens.** Short-lived (15 min)
HS256 access token in memory; refresh token stored hashed, rotated on use, family revoked on
reuse. Permissions are re-loaded from the DB on every request so revocation is immediate.

**ADR-004 Shared zod contracts package.** One schema per payload used by API validation,
OpenAPI generation (`z.toJSONSchema`) and web forms; prevents drift between tiers.

**ADR-005 No external AI services in production.** The system has no runtime dependency on
AI APIs. AI assistance is limited to the development process under docs/governance.md.

**ADR-006 Identity federation is optional and additive.** `users.external_subject` is reserved
for an OIDC/SAML subject. If the Ministry IdP is approved, add an `oidc` strategy in the auth
module (e.g. `openid-client`, authorization-code + PKCE) that maps the subject to a local user;
roles stay managed in CDMS. Local accounts remain for break-glass administration.

**ADR-007 File storage on a mounted volume.** Files are stored under random keys on
`STORAGE_DIR` (an institutional NAS/volume), metadata + SHA-256 in PostgreSQL. No object store
is needed at this scale; an S3-compatible on-prem store (e.g. MinIO) can be added behind
`FilesService` if volumes grow.

**ADR-008 No cache, queue or search engine (yet).** PostgreSQL indexes (incl. `pg_trgm`) cover
search; all operations are short synchronous transactions; imports are bounded (5 000 rows).
Introduce Redis/BullMQ or OpenSearch only with measured need (docs/governance.md §5).

**ADR-009 ASP.NET Core alternative.** The architecture (modular monolith, REST + OpenAPI,
PostgreSQL, Docker) is stack-neutral. If Ministry capacity favours .NET, the API can be
re-implemented module-by-module against the same OpenAPI contract and database schema; the
frontend is unaffected. This repository uses Node/NestJS per the preferred stack.
