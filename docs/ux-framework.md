# UX framework

## 1. Information architecture

```
Dashboard ─ Curricula ─ Review queue
Standards catalogue: Occupations (hierarchy) · Competencies · Units · Qualification frameworks · Templates
Data: Reference data · Institutions · Import & export · Reports
Administration: Users · Roles & permissions · Audit log · Design system · Settings
```

Navigation items are hidden when the user lacks the permission (the API still enforces it).
Records cross-link everywhere: curriculum → occupation / units / competencies; competency →
occupations and units using it; unit → curricula using it; impact dialogs list dependants.

**Hierarchy of a curriculum record**: identity (code · version · status · level) → workflow
(aside) → tabs: Overview, Structure, Competency coverage, Document sections, Files → versions.

## 2. Page templates (reference screens implemented)

| Template | Reference screen(s) | Anatomy |
|---|---|---|
| Dashboard | `/` | greeting, KPI tiles (actionable links), status distribution, recent activity |
| Database / table view | `/curricula`, `/units`, `/competencies` | header + primary action; toolbar (search, filters, toggles); table → cards; pagination |
| Hierarchy view | `/occupations` | tree (lazy, ARIA tree) ↔ table toggle |
| Record detail | `/curricula/:id`, `/units/:id` | breadcrumbs, title, meta badges, lock notice, tabs/sections, aside workflow |
| Framework management | `/frameworks/:id`, `/templates/:id` | ordered level/section builders, locked when published |
| Reference data | `/reference-data` | master (lists) / detail (items) |
| Form | create/edit dialogs | bilingual pairs side by side, grouped sections, sticky footer actions |
| Administration | `/admin/users`, `/admin/roles`, `/admin/audit` | lists with inline actions, permission matrix, diff viewer |
| Report | `/reports` | matrix + gap lists linking to records |
| Settings | `/settings` | profile, preferences, security |
| Document / print | `/curricula/:id/print` | print-optimised official layout (browser PDF) |

## 3. Key user journeys

1. **Develop a curriculum (developer)** — New curriculum (code, titles, occupation, level,
   template) → Structure: add approved units per term → Coverage: close gaps → Sections: write
   bilingual content per template → Submit (readiness checks shown first).
2. **Review & approve (reviewer / standards manager)** — Review queue → record → read
   history/comments → Return with comment or Approve (four-eyes) → Publish when dependencies
   are published.
3. **Revise a published curriculum** — Create new version (reason) → edit draft → review →
   publish; previous version archived automatically; versions panel shows lineage.
4. **Standardise competencies** — Create competency → link to occupation profile and units →
   impact check before changes → workflow.
5. **Bulk-load standards** — Import & export → choose type → download template → validate (dry
   run, row errors) → import (drafts) → review queue.
6. **Administer access** — Users → create, assign institution + roles; roles → permission
   matrix; audit log to verify.

## 4. UX recommendations applied (and to keep)

- **Readiness before action**: transitions open a dialog that lists blocking errors and
  warnings computed by the same server validators — users are never surprised by a 422.
- **Locked, not hidden**: published records show why they are locked and the path to change
  them (new version / return to draft).
- **Impact first**: shared records expose "Check impact" listing dependants and how many are
  published.
- **Coverage as feedback**: the curriculum shows % of the occupation's required competencies
  covered, with gaps linked to the competency.
- **Simplifications vs. typical curriculum tools**: one generic workflow for all record types;
  one bilingual form pattern; codes as the single human identifier; no free-text references.
- **Further recommendations** (backlog for validation): side-by-side diff between curriculum
  versions; bulk transitions in the review queue; saved filters; reviewer assignment; e-mail
  notifications via the Ministry SMTP relay (no paid service).

## 5. Usability validation plan

| Item | Plan |
|---|---|
| Participants | 5–8 per round: curriculum developers (institutions), reviewers, standards managers, 1–2 administrators; include ≥ 2 participants on phones and ≥ 1 screen-reader user where feasible |
| Method | moderated task-based sessions (60 min), think-aloud, in Arabic; SUS questionnaire; observation notes |
| Tasks | journeys 1–5 above; find a competency by Arabic keyword; recover from an edit conflict; import a CSV with errors |
| Metrics | task success, time on task, errors, SUS ≥ 70 target, accessibility blockers = 0 |
| Rounds | R1 on reference screens (this build, seeded demo data) → fix → R2 before production readiness |
| Output | findings log (severity 1–4), design-system changes, AGENTS.md updates; tracked to closure |

## 6. Review of AI-generated pages

Periodic UX/a11y review of a sample of new pages (governance.md §3): pattern conformance
(PageHeader/DataTable/Field…), tokens only, RTL check, 360 px check, keyboard pass, copy in both
languages, empty/error/loading states present. Deviations are logged with corrective guidance
and re-verified.
