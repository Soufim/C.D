# Technical governance

## 1. Development standards (summary)

The rules in [AGENTS.md](../AGENTS.md) are binding. They prevent: duplicated functionality
(reuse first), excessive abstraction (thin controllers, no speculative layers), architectural
drift (module boundaries, ADR process), and unapproved technology (dependency policy below).

## 2. AI-assisted development QA

1. **AI output is unverified** until a human has read every changed line and the quality gate
   passes. The author who prompts is accountable for the code.
2. **Mandatory named human review** (two-person rule) for: authentication/authorisation,
   permission changes, row-level scoping, database migrations, data-integrity rules, file
   handling, import/export, security headers, deployment and CI changes.
3. Reviewers check specifically for AI failure modes: invented APIs/packages, duplicated
   helpers, missing permission decorators, validation only on the client, missing audit or
   transaction, `.partial()` on schemas with defaults, unqualified columns in correlated SQL,
   hard-coded strings (no i18n), physical CSS properties, half-finished UI (dead buttons).
4. **Data protection**: never paste production data, secrets, personal data or `.env` content
   into external AI tools. Use synthetic seed data. Prefer tools approved by Ministry IT.
5. AI agents work from AGENTS.md as persistent instructions; recurring review findings are
   turned into new rules or lint checks there.

### Pull-request checklist
- [ ] Scope is one coherent change; description explains why
- [ ] `./scripts/verify.sh` green; new tests cover success + denial + invalid cases
- [ ] No new dependency / service (or ADR linked)
- [ ] Migrations reviewed as SQL; backward compatible or rollback documented
- [ ] Both languages, 360 px, keyboard checked (UI changes)
- [ ] Docs updated

## 3. Periodic reviews

| Review | When | Output |
|---|---|---|
| Code & architecture review | each phase gate and every ~4 weeks | findings (critical weakness, debt, duplication, drift) with owner & due date |
| UX / accessibility review of AI-generated pages | monthly sample (≥ 3 pages) | deviations vs design system, corrective guidance, re-verification |
| Security review (ASVS walkthrough) | each phase gate | updated checklist, findings register |
| Dependency & licence review | monthly | inventory diff, licences, vulnerabilities |

## 4. Phase-gate assessment template

| Field | Content |
|---|---|
| Gate | e.g. G2 "Core curriculum workflows complete" |
| Scope reviewed | modules, commits, environments |
| Evidence | CI run, test report, ASVS checklist, UX review notes, performance check |
| Outstanding issues | ID · description · severity (Critical/High/Medium/Low) · owner · due |
| Corrective measures | required actions and acceptance conditions |
| Decision | **Ready** / **Ready subject to corrective actions** (list) / **Not ready** (blocking risks) |
| Sign-off | technical assurance lead, Ministry representative, date |

Suggested gates: G0 inception & architecture validation · G1 design system + reference
screens · G2 core workflows · G3 security & pen-test remediation · G4 production readiness ·
G5 handover acceptance.

## 5. Dependency & technology policy

- Allowed: permissive OSS licences (MIT, Apache-2.0, BSD, ISC, PostgreSQL, OFL for fonts).
  Copyleft (GPL/AGPL) libraries in the shipped app require legal review.
- A new runtime dependency needs: a clear need not met by existing code, active maintenance,
  no known High/Critical vulnerabilities, acceptable size, and reviewer approval. Record it in
  the asset register (handover.md).
- New infrastructure (queue, cache, search engine, object store, separate service) needs an
  ADR with measured evidence (load, latency, data volume) and the operating cost.
- Lockfile committed; `npm ci` only in CI/images; Dependabot/Renovate proposals go through CI.

## 6. Performance & scalability

Baseline design: server-side pagination (≤ 200), indexed queries, trigram search, route-level
code splitting (largest JS chunk ≈ 128 kB gzip), 30 s statement timeout, connection pool 10.
Before go-live run a load test (k6, open source) of the reference journeys at 2× expected peak;
targets: p95 API < 500 ms for reads, < 1 s for writes, 0 errors; record DB slow queries
(`log_min_duration_statement = 500ms`). Scale vertically first; add an API replica only with
evidence.
