# AGENTS.md — Implementation guide for developers and AI coding agents

This file is the **persistent instruction set** for anyone (human or AI agent) changing the
Curriculum Development & Management System (CDMS). Read it fully before writing code. When a
rule here conflicts with a habit or a generated suggestion, this file wins. Proposals to change
a rule go through the architecture review in `docs/governance.md`.

> AI-generated code is **unverified until reviewed and tested** (docs/governance.md §2).
> Security-sensitive changes (auth, permissions, migrations, file handling, deployment) always
> require a named human reviewer.

---

## 1. Repository map

```
packages/contracts   Shared zod schemas, DTO types, permissions, statuses (single source of truth)
apps/api             NestJS modular monolith (PostgreSQL via Drizzle ORM)
  src/config         Validated environment (env.ts) — the only place that reads process.env
  src/database       schema.ts (tables), migrate.ts, seed.ts; SQL migrations in ../drizzle/
  src/common         Cross-cutting helpers: zod pipes, auth decorators, errors, crud, util
  src/modules/<m>    One folder per module: <m>.module.ts, <m>.controller.ts, <m>.service.ts
  test/              HTTP integration tests against a real PostgreSQL test database
apps/web             React 19 + TypeScript + Vite + Tailwind v4
  src/components/ui        Primitives (Button, Input, Dialog, Tabs…) — shadcn/ui style on Radix
  src/components/patterns  Reusable product patterns (DataTable, Field, WorkflowPanel, LinkPicker…)
  src/features/<f>         One folder per feature: pages, dialogs, api.ts
  src/lib                  api client, auth, i18n, formatting, resource hooks
  src/locales              en.json / ar.json (must have identical keys — enforced by a test)
deploy/, scripts/    nginx, compose files, backup / restore / release / verify scripts
docs/                Architecture, design system, security, operations, governance, handover
```

## 2. Golden rules (both tiers)

1. **Reuse before you write.** Search `components/patterns`, `components/ui`, `lib/`, `common/`
   and the module's service before creating anything. Duplicated helpers are rejected in review.
2. **Contracts first.** Every request body / query is a zod schema in `packages/contracts`.
   The API validates with it (`@ZBody`, `@ZQuery`) and the web form uses the same schema
   (`useZodForm`). Never hand-write validation twice.
3. **No new dependencies, frameworks or services** without an approved ADR
   (`docs/architecture.md#adrs`). This includes UI kits, state libraries, ORMs, queues, caches,
   search engines and any external/paid API (AI APIs included).
4. **Bilingual by default.** Every user-visible string goes through i18n (`t('…')`) with keys
   added to **both** `en.json` and `ar.json`. Every human-entered descriptive field is stored
   as `<field>En` + `<field>Ar`.
5. **Small, complete changes.** A change includes schema/migration, API, UI, translations,
   tests and docs together. Half-implemented features (TODO stubs, dead buttons) are not merged.

## 3. Backend rules (apps/api)

### Module structure
- A module = `*.module.ts` + `*.controller.ts` (HTTP only) + `*.service.ts` (business rules
  and data access). Controllers contain **no logic** beyond calling one service method.
- Modules may use another module only through its **exported service**, never by importing its
  tables to bypass its rules. Shared platform services are global: `AuditService`,
  `WorkflowService`, `NotificationsService`, `PasswordService`.
- New entity under review workflow → add it to `WORKFLOW_ENTITY_TYPES` (contracts) and to
  `workflow.registry.ts`, and register validators in the service constructor.

### Security (non-negotiable)
- Every route declares exactly one policy: `@RequirePermissions(...)`, `@Authenticated()` or
  `@Public()`. Routes without a policy are **denied** by the global `AuthGuard` (fail closed).
- Check **permissions**, never role names. Add new permissions to `contracts/permissions.ts`
  and to the default role bundles; the seed grants them to `system_admin`.
- Row-level rules (e.g. institution scoping in `CurriculaService.assertAccess`) live in the
  service, never only in the UI. Out-of-scope reads return 404 (do not reveal existence).
- Never log or return secrets, password hashes, tokens or full request bodies.
- Raw SQL only through Drizzle's `sql` template (parameterised). In correlated sub-queries
  **qualify outer columns explicitly** (`"units"."framework_level_id"`): Drizzle renders bare
  column names inside `sql` in single-table selects (this caused a real bug — see git history).
- Sort keys from clients must go through `orderBy(sort, order, allowList, fallback)`.
- Read configuration only via the injected `ENV` (`config/env.ts`). Lint enforces this.

### Data writes
- Every write runs in `db.transaction` and records an audit entry **in the same transaction**:
  `await this.audit.record(user, { action, entityType, entityId, changes: diff(before, after) }, tx)`.
- Updates load the row with `lockForUpdate(tx, table, id, rowVersion, label)` (row lock +
  optimistic-lock check) and bump the version with `touch(table, userId)`.
- Controlled records are editable only in `draft` → call `assertEditable(row.status)`.
- PATCH schemas are built with `patchSchema(shape)` — **never** `.partial()` (zod keeps
  defaults and would silently overwrite omitted fields).
- Referenced records are protected by `ON DELETE RESTRICT`; prefer archiving/deactivating to
  deleting. Reference-data codes are immutable.
- Errors: throw helpers from `common/errors.ts` (`notFound`, `forbidden`, `staleRecord`,
  `notEditable`, `businessRule`). The global filter returns RFC 9457 `application/problem+json`.

### Database & migrations
- Change `src/database/schema.ts`, then `npm run db:generate -w @cdms/api` and commit the SQL.
- **Never edit a migration that has been merged.** Write a new one.
- Migrations must be backward compatible with the previous release when possible
  (expand → migrate data → contract in a later release). See docs/operations.md §5.
- Custom SQL (triggers, extensions): `npx drizzle-kit generate --custom --name=<name>`.

## 4. Frontend rules (apps/web)

### Components & layout
- Pages are composed from patterns: `PageHeader` → (`Card` + `ListToolbar` + `DataTable`) for
  lists; `PageHeader` + `DetailLayout` (main + aside with `WorkflowPanel`) for records.
  Copy the closest existing page (e.g. `features/units/*`) rather than inventing a layout.
- Import Radix only inside `components/ui`. Feature code uses the wrapped components.
- Forms: `useZodForm(schema, …)` + `Field` / `BilingualField` / `FormGrid`; server errors via
  `applyServerErrors`. Create/edit forms open in `Dialog` (bottom sheet on phones).
- Destructive actions: `ConfirmDialog`. Never `window.confirm`.
- Status: `StatusBadge` only. Empty / error / loading: `EmptyState`, `ErrorState`, `PageLoader`,
  `Skeleton`.
- Linking records: `LinkPicker` (multi), `RecordSelect` (single), `LinkedRecords` (display),
  `ImpactButton` before changing shared records.

### Data fetching & state
- Server state: TanStack Query only. Use `createResource` (`lib/resources.ts`) for standard
  resources, or a feature `api.ts` with a `xxxKeys` object for custom endpoints.
- Writes: `useApiMutation({ fn, invalidate, success })` — never call `useMutation` directly.
- HTTP: `api` from `lib/api.ts` only (lint forbids `fetch`). Tokens never go to localStorage.
- List state (page, q, sort, filters) lives in the URL via `useListParams`.
- No global client-state library. Local `useState`; derive instead of syncing (no
  `setState` inside `useEffect` — remount with `key` when server data changes).

### Styling, RTL and accessibility
- Semantic tokens only (`bg-primary`, `text-muted-foreground`, `border-border`, `bg-success-soft`).
  Raw palette classes, hex colours and inline colours are lint errors.
- Logical properties only: `ms-/me-/ps-/pe-/start-/end-/text-start`. Directional icons get
  `className="rtl-flip"`.
- English inputs `dir="ltr"`, Arabic inputs `dir="rtl"` (BilingualField does this). Codes,
  emails and numbers in LTR.
- Every interactive element is keyboard reachable with a visible focus ring; icon-only buttons
  have `aria-label`; images/icons that convey meaning have text alternatives; colour is never
  the only signal. Target WCAG 2.2 AA (docs/design-system.md §7).
- Mobile: every page must work at 360 px wide without horizontal scrolling. Tables become
  cards (`DataTable` does this); dialogs become bottom sheets.

## 5. Examples

**Correct — new list page**
```tsx
const { params, set, toggleSort } = useListParams({ sort: 'code' });
const q = competencies.useList(params);
return (<>
  <PageHeader title={t('competencies.title')} actions={can(P.CATALOG_WRITE) && <Button …/>} />
  <Card><ListToolbar><SearchInput value={params.q} onChange={(v) => set({ q: v })} /></ListToolbar>
    <DataTable caption={…} columns={columns} data={q.data} loading={q.isLoading} error={q.error}
      rowKey={(c) => c.id} rowHref={(c) => `/competencies/${c.id}`} sort={…} page={…} /></Card>
</>);
```

**Prohibited**
```tsx
// ✗ raw fetch, token in storage, raw colours, physical margin, hard-coded English
const res = await fetch('/api/v1/units', { headers: { Authorization: localStorage.token } });
<div className="bg-blue-600 ml-4">Units</div>
// ✗ permission check only in the UI
{user.roles.includes('admin') && <DeleteButton />}   // backend must enforce; check permissions
```

**Correct — service write**
```ts
update(id: string, input: UpdateOf<UnitInput>, user: RequestUser) {
  return this.db.transaction(async (tx) => {
    const { rowVersion, ...data } = input;
    const before = await lockForUpdate<Row>(tx, units, id, rowVersion, 'Unit');
    assertEditable(before.status);
    const [after] = await tx.update(units).set({ ...defined(data), ...touch(units, user.id) })
      .where(eq(units.id, id)).returning();
    await this.audit.record(user, { action: 'unit.update', entityType: 'unit', entityId: id,
      changes: diff(before, after) }, tx);
    return dto(after);
  });
}
```

## 6. Naming

| Thing | Convention | Example |
|---|---|---|
| Files (web components) | PascalCase.tsx for pages/dialogs, kebab-case.tsx for shared | `UnitDetailPage.tsx`, `data-table.tsx` |
| Files (api) | kebab-case + role suffix | `reference-data.service.ts` |
| DB tables / columns | snake_case plural tables | `curriculum_units.is_mandatory` |
| TS fields | camelCase; bilingual suffix En/Ar | `titleEn`, `titleAr` |
| Permissions | `<domain>.<verb>` | `catalog.approve` |
| Audit actions | `<entity>.<verb>` | `curriculum.set_units` |
| i18n keys | `<feature>.<key>` | `curricula.addUnits` |
| Business codes | UPPER-KEBAB, unique case-insensitive | `UNT-ELEC-120` |

## 7. Definition of done

- [ ] `./scripts/verify.sh` passes (format, lint, types, unit + integration tests, build,
      migration check, runtime dependency audit)
- [ ] New/changed endpoints covered by an integration test, including a permission-denied case
- [ ] UI checked in **Arabic and English**, light and dark, at 360 px and desktop width
- [ ] Keyboard-only walkthrough of the changed screen
- [ ] Translations added to both locale files
- [ ] Docs updated (API/data model/operations) when behaviour changes
- [ ] For AI-generated changes: reviewer has read every line (docs/governance.md §2)
