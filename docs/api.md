# API conventions

- Base path: `/api/v1` (URI versioning; breaking changes → `/api/v2` alongside v1 for one release).
- Format: JSON (UTF-8). Uploads: `multipart/form-data` field `file`.
- Contract: OpenAPI 3 generated from the code at `/api/docs` (UI) and `/api/docs/openapi.json`
  (non-production builds). Request schemas come from `packages/contracts` (zod → JSON Schema).
- Auth: `Authorization: Bearer <access token>` (15 min). Refresh via `POST /auth/refresh` with
  the httpOnly cookie. Integrations should use dedicated service accounts with minimal roles.

## Resources

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET/PATCH /auth/me`, `POST /auth/change-password` |
| Curricula | `GET/POST /curricula`, `GET/PATCH/DELETE /curricula/:id`, `PUT /curricula/:id/units`, `GET /curricula/:id/{coverage,validation,versions,export}`, `POST /curricula/:id/new-version` |
| Catalogue | `/occupations`, `/competencies`, `/units` (list/get/create/patch, `/:id/impact`, `POST/DELETE /:id/competencies[/:cid]`), `/occupations/:id/ancestors` |
| Frameworks | `/frameworks`, `/frameworks/levels`, `/frameworks/:id/levels`, `/frameworks/levels/:id` |
| Templates | `/templates`, `/templates/:id/impact` |
| Workflow | `POST /workflow/:type/:id/transition`, `GET /workflow/:type/:id/{check,history}`, `GET /workflow/review-queue` |
| Reference data | `/reference-data/lists`, `/reference-data/lists/:idOrCode/items`, `/reference-data/items/:id` |
| Institutions | `/institutions` |
| Files | `POST /files/:type/:id`, `GET /files?entityType&entityId`, `GET /files/:id/content`, `DELETE /files/:id` |
| Import/export | `POST /import`, `GET /import/template/:entity`, `GET /export/:entity?format=csv|json`, `GET /export/full` |
| Insights | `GET /dashboard`, `GET /search?q=`, `GET /reports/standardisation` |
| Admin | `/admin/users`, `/admin/users/:id/reset-password`, `/admin/roles`, `/admin/permissions`, `GET /audit` |
| Health | `GET /health/live`, `GET /health/ready` (public, no details) |

## Lists

`?page=1&pageSize=20&q=&sort=<allow-listed key>&order=asc|desc&status=` plus entity filters.
Response: `{ items, total, page, pageSize }`. `pageSize` ≤ 200.

## Writes and concurrency

Every PATCH and workflow transition must send the record's current `rowVersion`. A stale value
returns **409** `urn:cdms:edit-conflict`; the client reloads and re-applies. Omitted PATCH
fields are left unchanged. Records not in `draft` return **409** `urn:cdms:locked`.

## Errors (RFC 9457)

```json
{ "type": "about:blank", "title": "Validation failed", "status": 422,
  "errors": [{ "path": "titleEn", "message": "Required" }],
  "instance": "/api/v1/units", "traceId": "4f1c…" }
```

| Status | Meaning |
|---|---|
| 400 | Malformed id / parameter |
| 401 | Missing/expired token, bad credentials, locked account |
| 403 | Authenticated but lacking permission |
| 404 | Not found **or outside the caller's scope** |
| 409 | Edit conflict, locked record, duplicate code, record in use |
| 422 | Validation or business-rule failure (`errors[]` lists fields / readiness issues) |
| 429 | Rate limit (login 10/min, global 300/min per client) |
| 500 | Unexpected; no internals exposed — quote `traceId` (also in `X-Request-Id`) |

## Integration guidance

- Prefer `GET /export/full` (catalogue snapshot) or entity exports for bulk exchange, and the
  curriculum `export` document (`cdms.curriculum/v1`) for single programmes.
- Business codes are stable identifiers suitable for cross-system references; UUIDs are
  internal.
- Formats: `cdms.catalog/v1` and `cdms.curriculum/v1` are versioned; additive changes only
  within a version.
