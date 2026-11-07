# Design system

Living reference: **/design-system** page in the app (renders the production components).
Code: `apps/web/src/index.css` (tokens), `components/ui` (primitives), `components/patterns`
(product patterns).

## 1. Principles

1. **Clarity over decoration** — dense, calm screens for professional, repeated work.
2. **One way to do each thing** — reuse the pattern; never restyle a primitive locally.
3. **Bilingual parity** — Arabic is a first-class layout, not a translation layer.
4. **Accessible by construction** — components carry the ARIA/keyboard behaviour; pages only
   compose them.
5. **Show consequences** — status, locks, impact and readiness are always visible before an
   action, not after.

## 2. Tokens

| Group | Tokens | Usage |
|---|---|---|
| Surfaces | `background`, `card`, `popover`, `muted` | page, panels, menus, subtle fills |
| Text | `foreground`, `muted-foreground` | body, secondary text (≥ 4.5:1 on its surface) |
| Lines | `border`, `input`, `ring` | dividers, field borders, focus outline |
| Brand | `primary` (institutional teal), `secondary`, `accent` (warm) | primary actions/links; selected states; highlights |
| Feedback | `destructive`, `success`, `warning`, `info` + `*-soft` backgrounds | errors, published, approved/caution, in review |
| Shell | `sidebar`, `sidebar-foreground`, `sidebar-muted`, `sidebar-accent` | navigation rail |

Light and dark values are redefined under `.dark`; every pair keeps AA contrast. Use classes
like `bg-primary text-primary-foreground`, `bg-success-soft text-success`. **Never** raw palette
classes (`bg-blue-600`) or hex — lint blocks them.

**Typography** — Inter (Latin) and IBM Plex Sans Arabic, self-hosted via `@fontsource` (no
external font CDN). In RTL the Arabic face leads the stack. Scale: `text-xs` 12 (meta, badges),
`text-sm` 14 (default UI), `text-base` 16 (reading), `text-lg` 18 (section), `text-xl/2xl`
20/24 (page title, one `<h1>` per page). Codes use `font-mono` and are always LTR.

**Spacing** — 4 px grid (Tailwind scale). Page gutters 16 px (phone) / 24 px (≥ sm). Cards
pad 16/20 px. Gaps: 8 within controls, 16 between fields, 20 between sections.

**Radius / elevation** — `rounded-md` (8 px) controls, `rounded-lg` cards/dialogs,
`rounded-full` badges. Shadows: `shadow-sm` cards, `shadow-md` menus/hover, `shadow-lg` modals.

**Iconography** — lucide icons at 16 px in controls, 20 px in empty states, stroke 2. Icons
accompany text; icon-only buttons require `aria-label` (and preferably a `Tooltip`). Arrows and
chevrons that imply direction carry `rtl-flip`.

**Numbers & dates** — `useFormat()`: `Intl` with `ar-EG-u-nu-latn` (Arabic text with Latin
digits — codes, hours and identifiers mix with Latin text) or `en-GB`; relative times for
activity, medium dates elsewhere. Gregorian calendar in both languages.

## 3. Primitives (`components/ui`)

| Component | Variants / notes |
|---|---|
| `Button` | `default` (one primary per view), `secondary`, `outline`, `ghost`, `destructive`, `link`; sizes `sm`/`default`/`lg`/`icon`/`icon-sm`; `loading` |
| `Input`, `Textarea`, `NativeSelect` | Native select is preferred for short option lists (accessible, native picker on phones) |
| `Checkbox`, `Switch`, `Label` | Switch for immediate on/off settings; checkbox for selections in forms |
| `Badge` | tones: neutral, primary, success, warning, danger, info, outline |
| `Card` (+Header/Title/Content/Footer) | container for lists and panels |
| `Dialog` (+Header/Body/Footer), `SheetContent`, `AlertDialog` | dialog = bottom sheet on phones; alert dialog only for destructive confirmation |
| `DropdownMenu`, `Popover`, `Tooltip`, `Tabs` | Radix-based, keyboard and screen-reader complete |
| `Table` (`THead/TBody/TR/TH/TD`), `Skeleton`, `Separator` | |

## 4. Patterns (`components/patterns`) and when to use them

| Pattern | Use when | Avoid |
|---|---|---|
| `PageHeader` | top of every page: title, description, breadcrumbs, meta badges, actions | more than one primary action |
| `Section`, `KeyValue`, `DetailLayout` | record detail pages (main + 320 px aside) | nested cards |
| `DataTable` + `ListToolbar` + `SearchInput` + `FilterSelect` + `Pagination` | any list; server sorting/paging; becomes cards < 768 px | client-side paging of server data |
| `useListParams` | list state (URL) | `useState` for filters |
| `Field`, `FormGrid`, `BilingualField`, `useZodForm`, `applyServerErrors` | every form | unlabeled inputs, placeholder-as-label |
| `StatusBadge` | any workflow status | custom coloured text |
| `WorkflowPanel` / `WorkflowHistory` | every controlled record (aside) | ad-hoc status buttons |
| `LinkPicker` / `RecordSelect` / `LinkedRecords` / `ReferenceSelect` / `LevelSelect` | linking and choosing related records | free-text ids |
| `ImpactButton` | before editing/archiving shared records | |
| `Attachments` | supporting files on records | |
| `ConfirmDialog` | delete, unlink, irreversible actions | confirmation for reversible actions |
| `EmptyState`, `ErrorState`, `PageLoader`, `Notice` | every async view | blank screens, raw error text |

## 5. Interaction patterns

| Action | Pattern |
|---|---|
| Create | Primary button in `PageHeader` → dialog form → on success toast + navigate to the new record |
| Edit | `Edit` (outline) in header → same dialog pre-filled; locked records show a `Notice` explaining why and how to change them |
| Delete | Only drafts; menu item → `ConfirmDialog` (destructive) |
| Search / filter / sort | Toolbar; debounced search (300 ms); URL-synced; column headers toggle sort with `aria-sort` |
| Review / approve | Aside `WorkflowPanel` → dialog shows readiness errors (blocking) and warnings; comment required to return |
| Link records | Section action → `LinkPicker` multi-select with search; unlink with confirm |
| Upload | Drag-and-drop or button; allowed types listed; server re-validates |
| Import | Choose type → template → validate (dry run) → import (enabled only after a clean dry run) |
| Export | CSV/JSON per entity; full catalogue JSON; curriculum print/PDF + JSON |
| Navigate related records | Codes and titles are links; breadcrumbs follow hierarchies |
| Conflicts | 409 edit conflict → toast with reload guidance; nothing is silently overwritten |
| Feedback | Toasts (`sonner`) for completed actions; inline errors for fields; `role=alert` for blocking errors |

## 6. Responsive standards

| Breakpoint | Layout |
|---|---|
| < 640 (phone) | single column, header actions wrap below title, dialogs are bottom sheets, tables → cards, sidebar → drawer |
| 640–1023 (tablet) | two-column forms, tables visible ≥ 768, drawer navigation |
| ≥ 1024 (desktop) | persistent sidebar, detail pages main + aside |

No horizontal page scroll at 360 px (verified by E2E on a Pixel 7 profile). Touch targets
≥ 24 × 24 px (most controls 32–44 px). **Desktop-optimised workflows** (documented
limitation): the curriculum structure builder and template section builder work on phones but
are designed for desktop/tablet; long bilingual section writing is best done on desktop.

## 7. Accessibility (WCAG 2.2 AA)

| Criterion | Implementation |
|---|---|
| 1.1.1 Non-text content | icons decorative (`aria-hidden`) or labelled; status icons paired with text |
| 1.3.1 Info & relationships | semantic landmarks (`header`, `nav`, `main`, `aside`), tables with captions and `scope`, `Field` wires label/hint/error ids |
| 1.4.3 / 1.4.11 Contrast | token pairs ≥ 4.5:1 text, ≥ 3:1 UI; checked in light and dark |
| 1.4.4 / 1.4.10 Resize & reflow | rem-based sizes; reflow to 320 CSS px |
| 2.1.1 Keyboard | all actions via Radix/native controls; tree and table rows reachable via links |
| 2.4.1 Bypass blocks | "Skip to main content" link |
| 2.4.3 / 2.4.7 / 2.4.11 Focus | logical order; visible 2 px ring (`:focus-visible`); dialogs trap and restore focus |
| 2.5.8 Target size | controls ≥ 24 px |
| 3.1.1 / 3.1.2 Language | `<html lang dir>` switches; bilingual fields carry `lang` and `dir` |
| 3.3.1 / 3.3.2 / 3.3.3 Errors & labels | visible labels, required markers, server errors mapped to fields, readiness explanations |
| 3.3.7 Redundant entry / 3.3.8 Accessible auth | password managers supported (`autocomplete`), no cognitive tests |
| 4.1.2 / 4.1.3 Name, role, value; status messages | Radix ARIA; `aria-live` for results, toasts announced |
| Motion | `prefers-reduced-motion` disables transitions |

Automated: `eslint-plugin-jsx-a11y` (lint gate), unit test for field wiring. Manual each
release: keyboard-only and NVDA/VoiceOver passes of the reference screens in both languages.

## 8. Arabic / English

- `applyLocale()` sets `lang`/`dir` on `<html>`; saved per browser and per user profile.
- Layout uses logical properties only; directional icons flip; codes/emails/numbers stay LTR.
- Text expansion: labels wrap (no fixed widths on buttons/labels); Arabic strings are typically
  ~20–30 % shorter, English longer — test both.
- Terminology: bilingual reference data and records always store both languages; UI shows the
  current language with fallback to the other (`useBilingual().pick`). Curriculum terms
  (جدارة = competency, ناتج تعلم = learning outcome, وحدة = unit, منهج = curriculum, مستوى
  التأهيل = qualification level) are fixed in the locale files — change them there only.
- Both locale files must have identical keys (unit test).

## 9. Do / don't

| Do | Don't |
|---|---|
| Compose patterns; copy the nearest existing page | Build one-off tables/forms/modals |
| Put the single primary action top-end of the header | Several primary buttons |
| Explain locks and blocked actions in plain language | Disable buttons without explanation |
| Use `StatusBadge` + text | Communicate state by colour alone |
| Keep forms short; split into sections | 20-field single-column walls on desktop |
