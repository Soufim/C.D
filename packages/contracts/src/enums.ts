/**
 * Lifecycle status shared by all controlled records (curricula, units,
 * competencies, templates, occupations, frameworks).
 *
 * draft -> in_review -> approved -> published -> archived
 *            |  ^
 *            v  |  (returned for changes)
 *          draft
 */
export const RECORD_STATUSES = ['draft', 'in_review', 'approved', 'published', 'archived'] as const;
export type RecordStatus = (typeof RECORD_STATUSES)[number];

/** Workflow actions and the transitions they perform. */
export const WORKFLOW_ACTIONS = {
  submit: { from: ['draft'], to: 'in_review' },
  return: { from: ['in_review'], to: 'draft' },
  approve: { from: ['in_review'], to: 'approved' },
  publish: { from: ['approved'], to: 'published' },
  archive: { from: ['published', 'approved', 'draft'], to: 'archived' },
  restore: { from: ['archived'], to: 'draft' },
} as const satisfies Record<string, { from: readonly RecordStatus[]; to: RecordStatus }>;
export type WorkflowAction = keyof typeof WORKFLOW_ACTIONS;
export const WORKFLOW_ACTION_NAMES = Object.keys(WORKFLOW_ACTIONS) as WorkflowAction[];

/** Statuses in which a record's content may be edited in place. */
export const EDITABLE_STATUSES: readonly RecordStatus[] = ['draft'];

export function availableActions(status: RecordStatus): WorkflowAction[] {
  return WORKFLOW_ACTION_NAMES.filter((a) =>
    (WORKFLOW_ACTIONS[a].from as readonly RecordStatus[]).includes(status),
  );
}

/** Entity types that participate in workflow, audit, files and linking. */
export const ENTITY_TYPES = [
  'curriculum',
  'unit',
  'competency',
  'occupation',
  'framework',
  'template',
  'institution',
  'reference_list',
  'reference_item',
  'user',
  'role',
  'file',
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const WORKFLOW_ENTITY_TYPES = [
  'curriculum',
  'unit',
  'competency',
  'occupation',
  'framework',
  'template',
] as const;
export type WorkflowEntityType = (typeof WORKFLOW_ENTITY_TYPES)[number];

export const OCCUPATION_LEVELS = [
  'major_group',
  'sub_major_group',
  'minor_group',
  'unit_group',
  'occupation',
] as const;
export type OccupationLevel = (typeof OCCUPATION_LEVELS)[number];

export const COMPETENCY_TYPES = [
  'core',
  'technical',
  'generic',
  'digital',
  'entrepreneurial',
] as const;
export type CompetencyType = (typeof COMPETENCY_TYPES)[number];

export const TEMPLATE_KINDS = ['curriculum', 'unit', 'document'] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

export const LOCALES = ['en', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];

export const IMPORTABLE_ENTITIES = [
  'occupation',
  'competency',
  'unit',
  'reference_item',
  'institution',
] as const;
export type ImportableEntity = (typeof IMPORTABLE_ENTITIES)[number];
