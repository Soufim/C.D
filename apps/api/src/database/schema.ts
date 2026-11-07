/**
 * PostgreSQL schema (single source of truth for migrations).
 *
 * Conventions
 * - Primary keys: UUID (gen_random_uuid()). Business identifiers: `code` (unique, citext-like
 *   uniqueness enforced via lower(code) unique indexes).
 * - Bilingual columns use the suffixes `_en` / `_ar`.
 * - Every mutable table has created_at / updated_at / row_version (optimistic locking).
 * - Foreign keys default to ON DELETE RESTRICT so shared reference records cannot be removed
 *   while still linked. Link tables cascade from their owning side only.
 * - Never edit an existing migration: change this file and run `npm run db:generate`.
 */
import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  check,
  foreignKey,
  date,
  index,
  inet,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  COMPETENCY_TYPES,
  OCCUPATION_LEVELS,
  RECORD_STATUSES,
  TEMPLATE_KINDS,
} from '@cdms/contracts';
import type { TemplateSection } from '@cdms/contracts';

export const recordStatus = pgEnum('record_status', RECORD_STATUSES);
export const occupationLevel = pgEnum('occupation_level', OCCUPATION_LEVELS);
export const competencyType = pgEnum('competency_type', COMPETENCY_TYPES);
export const templateKind = pgEnum('template_kind', TEMPLATE_KINDS);
export const locale = pgEnum('locale', ['en', 'ar']);
export const auditOutcome = pgEnum('audit_outcome', ['success', 'failure']);

const id = () => uuid('id').primaryKey().defaultRandom();
const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  rowVersion: integer('row_version').notNull().default(0),
};
const actor = {
  createdById: uuid('created_by_id'),
  updatedById: uuid('updated_by_id'),
};

// ============================================================== Identity & access
export const institutions = pgTable(
  'institutions',
  {
    id: id(),
    code: varchar('code', { length: 50 }).notNull(),
    nameEn: varchar('name_en', { length: 300 }).notNull(),
    nameAr: varchar('name_ar', { length: 300 }).notNull(),
    typeCode: varchar('type_code', { length: 50 }),
    governorateCode: varchar('governorate_code', { length: 50 }),
    address: text('address'),
    isActive: boolean('is_active').notNull().default(true),
    ...actor,
    ...timestamps,
  },
  (t) => [uniqueIndex('institutions_code_uq').on(sql`lower(${t.code})`)],
);

export const users = pgTable(
  'users',
  {
    id: id(),
    email: varchar('email', { length: 254 }).notNull(),
    fullNameEn: varchar('full_name_en', { length: 200 }).notNull(),
    fullNameAr: varchar('full_name_ar', { length: 200 }).notNull(),
    passwordHash: text('password_hash'),
    /** Subject from an external identity provider (OIDC/SAML) when federated. */
    externalSubject: varchar('external_subject', { length: 255 }),
    institutionId: uuid('institution_id').references(() => institutions.id, {
      onDelete: 'restrict',
    }),
    locale: locale('locale').notNull().default('ar'),
    isActive: boolean('is_active').notNull().default(true),
    failedLoginCount: integer('failed_login_count').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    passwordChangedAt: timestamp('password_changed_at', { withTimezone: true }),
    ...actor,
    ...timestamps,
  },
  (t) => [
    uniqueIndex('users_email_uq').on(sql`lower(${t.email})`),
    uniqueIndex('users_external_subject_uq').on(t.externalSubject),
  ],
);

export const roles = pgTable(
  'roles',
  {
    id: id(),
    code: varchar('code', { length: 50 }).notNull(),
    nameEn: varchar('name_en', { length: 100 }).notNull(),
    nameAr: varchar('name_ar', { length: 100 }).notNull(),
    description: text('description'),
    isSystem: boolean('is_system').notNull().default(false),
    permissions: text('permissions')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    ...timestamps,
  },
  (t) => [uniqueIndex('roles_code_uq').on(sql`lower(${t.code})`)],
);

export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'restrict' }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] }), index('user_roles_role_idx').on(t.roleId)],
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** SHA-256 of the opaque token. The raw token is never stored. */
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    /** All tokens issued from one login share a family; reuse of a rotated token revokes it. */
    familyId: uuid('family_id').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    replacedById: uuid('replaced_by_id'),
    ip: inet('ip'),
    userAgent: varchar('user_agent', { length: 400 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('refresh_tokens_hash_uq').on(t.tokenHash),
    index('refresh_tokens_user_idx').on(t.userId),
    index('refresh_tokens_family_idx').on(t.familyId),
  ],
);

// ============================================================== Reference data
export const referenceLists = pgTable(
  'reference_lists',
  {
    id: id(),
    code: varchar('code', { length: 50 }).notNull(),
    nameEn: varchar('name_en', { length: 300 }).notNull(),
    nameAr: varchar('name_ar', { length: 300 }).notNull(),
    description: text('description'),
    isSystem: boolean('is_system').notNull().default(false),
    ...actor,
    ...timestamps,
  },
  (t) => [uniqueIndex('reference_lists_code_uq').on(sql`lower(${t.code})`)],
);

export const referenceItems = pgTable(
  'reference_items',
  {
    id: id(),
    listId: uuid('list_id')
      .notNull()
      .references(() => referenceLists.id, { onDelete: 'restrict' }),
    code: varchar('code', { length: 50 }).notNull(),
    labelEn: varchar('label_en', { length: 300 }).notNull(),
    labelAr: varchar('label_ar', { length: 300 }).notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    ...actor,
    ...timestamps,
  },
  (t) => [uniqueIndex('reference_items_list_code_uq').on(t.listId, sql`lower(${t.code})`)],
);

// ============================================================== Qualification frameworks
export const frameworks = pgTable(
  'frameworks',
  {
    id: id(),
    code: varchar('code', { length: 50 }).notNull(),
    nameEn: varchar('name_en', { length: 300 }).notNull(),
    nameAr: varchar('name_ar', { length: 300 }).notNull(),
    description: text('description'),
    versionLabel: varchar('version_label', { length: 30 }).notNull().default('1.0'),
    status: recordStatus('status').notNull().default('draft'),
    ...actor,
    ...timestamps,
  },
  (t) => [uniqueIndex('frameworks_code_uq').on(sql`lower(${t.code})`)],
);

export const frameworkLevels = pgTable(
  'framework_levels',
  {
    id: id(),
    frameworkId: uuid('framework_id')
      .notNull()
      .references(() => frameworks.id, { onDelete: 'restrict' }),
    level: integer('level').notNull(),
    nameEn: varchar('name_en', { length: 300 }).notNull(),
    nameAr: varchar('name_ar', { length: 300 }).notNull(),
    knowledgeEn: text('knowledge_en'),
    knowledgeAr: text('knowledge_ar'),
    skillsEn: text('skills_en'),
    skillsAr: text('skills_ar'),
    autonomyEn: text('autonomy_en'),
    autonomyAr: text('autonomy_ar'),
    ...actor,
    ...timestamps,
  },
  (t) => [uniqueIndex('framework_levels_fw_level_uq').on(t.frameworkId, t.level)],
);

// ============================================================== Occupational classification
export const occupations = pgTable(
  'occupations',
  {
    id: id(),
    code: varchar('code', { length: 50 }).notNull(),
    titleEn: varchar('title_en', { length: 300 }).notNull(),
    titleAr: varchar('title_ar', { length: 300 }).notNull(),
    descriptionEn: text('description_en'),
    descriptionAr: text('description_ar'),
    level: occupationLevel('level').notNull(),
    parentId: uuid('parent_id'),
    iscoCode: varchar('isco_code', { length: 10 }),
    sectorCode: varchar('sector_code', { length: 50 }),
    status: recordStatus('status').notNull().default('draft'),
    ...actor,
    ...timestamps,
  },
  (t) => [
    uniqueIndex('occupations_code_uq').on(sql`lower(${t.code})`),
    index('occupations_parent_idx').on(t.parentId),
    index('occupations_title_trgm').using('gin', sql`${t.titleEn} gin_trgm_ops`),
    foreignKey({
      columns: [t.parentId],
      foreignColumns: [t.id],
      name: 'occupations_parent_fk',
    }).onDelete('restrict'),
    check('occupations_not_self_parent', sql`${t.parentId} IS NULL OR ${t.parentId} <> ${t.id}`),
  ],
);

// ============================================================== Competencies
export const competencies = pgTable(
  'competencies',
  {
    id: id(),
    code: varchar('code', { length: 50 }).notNull(),
    titleEn: varchar('title_en', { length: 300 }).notNull(),
    titleAr: varchar('title_ar', { length: 300 }).notNull(),
    descriptionEn: text('description_en'),
    descriptionAr: text('description_ar'),
    type: competencyType('type').notNull(),
    frameworkLevelId: uuid('framework_level_id').references(() => frameworkLevels.id, {
      onDelete: 'restrict',
    }),
    performanceCriteriaEn: text('performance_criteria_en'),
    performanceCriteriaAr: text('performance_criteria_ar'),
    status: recordStatus('status').notNull().default('draft'),
    ...actor,
    ...timestamps,
  },
  (t) => [
    uniqueIndex('competencies_code_uq').on(sql`lower(${t.code})`),
    index('competencies_title_trgm').using('gin', sql`${t.titleEn} gin_trgm_ops`),
  ],
);

export const occupationCompetencies = pgTable(
  'occupation_competencies',
  {
    occupationId: uuid('occupation_id')
      .notNull()
      .references(() => occupations.id, { onDelete: 'cascade' }),
    competencyId: uuid('competency_id')
      .notNull()
      .references(() => competencies.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.occupationId, t.competencyId] }),
    index('occ_comp_comp_idx').on(t.competencyId),
  ],
);

// ============================================================== Curriculum units (modules)
export const units = pgTable(
  'units',
  {
    id: id(),
    code: varchar('code', { length: 50 }).notNull(),
    titleEn: varchar('title_en', { length: 300 }).notNull(),
    titleAr: varchar('title_ar', { length: 300 }).notNull(),
    descriptionEn: text('description_en'),
    descriptionAr: text('description_ar'),
    frameworkLevelId: uuid('framework_level_id').references(() => frameworkLevels.id, {
      onDelete: 'restrict',
    }),
    creditHours: numeric('credit_hours', { precision: 5, scale: 1, mode: 'number' })
      .notNull()
      .default(0),
    theoryHours: integer('theory_hours').notNull().default(0),
    practicalHours: integer('practical_hours').notNull().default(0),
    assessmentEn: text('assessment_en'),
    assessmentAr: text('assessment_ar'),
    status: recordStatus('status').notNull().default('draft'),
    ...actor,
    ...timestamps,
  },
  (t) => [
    uniqueIndex('units_code_uq').on(sql`lower(${t.code})`),
    index('units_title_trgm').using('gin', sql`${t.titleEn} gin_trgm_ops`),
    check('units_hours_nonneg', sql`${t.theoryHours} >= 0 AND ${t.practicalHours} >= 0`),
  ],
);

export const learningOutcomes = pgTable(
  'learning_outcomes',
  {
    id: id(),
    unitId: uuid('unit_id')
      .notNull()
      .references(() => units.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 30 }).notNull(),
    textEn: text('text_en').notNull(),
    textAr: text('text_ar').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [uniqueIndex('learning_outcomes_unit_code_uq').on(t.unitId, t.code)],
);

export const unitCompetencies = pgTable(
  'unit_competencies',
  {
    unitId: uuid('unit_id')
      .notNull()
      .references(() => units.id, { onDelete: 'cascade' }),
    competencyId: uuid('competency_id')
      .notNull()
      .references(() => competencies.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.unitId, t.competencyId] }),
    index('unit_comp_comp_idx').on(t.competencyId),
  ],
);

// ============================================================== Templates
export const templates = pgTable(
  'templates',
  {
    id: id(),
    code: varchar('code', { length: 50 }).notNull(),
    nameEn: varchar('name_en', { length: 300 }).notNull(),
    nameAr: varchar('name_ar', { length: 300 }).notNull(),
    descriptionEn: text('description_en'),
    descriptionAr: text('description_ar'),
    kind: templateKind('kind').notNull(),
    sections: jsonb('sections').$type<TemplateSection[]>().notNull().default([]),
    status: recordStatus('status').notNull().default('draft'),
    ...actor,
    ...timestamps,
  },
  (t) => [uniqueIndex('templates_code_uq').on(sql`lower(${t.code})`)],
);

// ============================================================== Curricula
export const curricula = pgTable(
  'curricula',
  {
    id: id(),
    /** Code is shared by all versions of the same curriculum. Unique together with version. */
    code: varchar('code', { length: 50 }).notNull(),
    version: integer('version').notNull().default(1),
    previousVersionId: uuid('previous_version_id'),
    titleEn: varchar('title_en', { length: 300 }).notNull(),
    titleAr: varchar('title_ar', { length: 300 }).notNull(),
    summaryEn: text('summary_en'),
    summaryAr: text('summary_ar'),
    occupationId: uuid('occupation_id').references(() => occupations.id, { onDelete: 'restrict' }),
    frameworkLevelId: uuid('framework_level_id').references(() => frameworkLevels.id, {
      onDelete: 'restrict',
    }),
    institutionId: uuid('institution_id').references(() => institutions.id, {
      onDelete: 'restrict',
    }),
    templateId: uuid('template_id').references(() => templates.id, { onDelete: 'restrict' }),
    programTypeCode: varchar('program_type_code', { length: 50 }),
    durationMonths: integer('duration_months').notNull().default(0),
    effectiveFrom: date('effective_from'),
    sections: jsonb('sections')
      .$type<Record<string, { en: string; ar: string }>>()
      .notNull()
      .default({}),
    status: recordStatus('status').notNull().default('draft'),
    ...actor,
    ...timestamps,
  },
  (t) => [
    foreignKey({
      columns: [t.previousVersionId],
      foreignColumns: [t.id],
      name: 'curricula_previous_version_fk',
    }).onDelete('restrict'),
    uniqueIndex('curricula_code_version_uq').on(sql`lower(${t.code})`, t.version),
    index('curricula_status_idx').on(t.status),
    index('curricula_institution_idx').on(t.institutionId),
    index('curricula_occupation_idx').on(t.occupationId),
    index('curricula_title_trgm').using('gin', sql`${t.titleEn} gin_trgm_ops`),
  ],
);

export const curriculumUnits = pgTable(
  'curriculum_units',
  {
    curriculumId: uuid('curriculum_id')
      .notNull()
      .references(() => curricula.id, { onDelete: 'cascade' }),
    unitId: uuid('unit_id')
      .notNull()
      .references(() => units.id, { onDelete: 'restrict' }),
    term: integer('term').notNull().default(1),
    sortOrder: integer('sort_order').notNull().default(0),
    isMandatory: boolean('is_mandatory').notNull().default(true),
  },
  (t) => [
    primaryKey({ columns: [t.curriculumId, t.unitId] }),
    index('curriculum_units_unit_idx').on(t.unitId),
  ],
);

// ============================================================== Workflow history
export const workflowEvents = pgTable(
  'workflow_events',
  {
    id: id(),
    entityType: varchar('entity_type', { length: 30 }).notNull(),
    entityId: uuid('entity_id').notNull(),
    action: varchar('action', { length: 30 }).notNull(),
    fromStatus: recordStatus('from_status'),
    toStatus: recordStatus('to_status').notNull(),
    comment: text('comment'),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('workflow_events_entity_idx').on(t.entityType, t.entityId, t.occurredAt)],
);

// ============================================================== Files
export const files = pgTable(
  'files',
  {
    id: id(),
    originalName: varchar('original_name', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 120 }).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    sha256: varchar('sha256', { length: 64 }).notNull(),
    /** Opaque storage key (random UUID based). Never derived from user input. */
    storageKey: varchar('storage_key', { length: 200 }).notNull(),
    entityType: varchar('entity_type', { length: 30 }),
    entityId: uuid('entity_id'),
    uploadedById: uuid('uploaded_by_id').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('files_storage_key_uq').on(t.storageKey),
    index('files_entity_idx').on(t.entityType, t.entityId),
  ],
);

// ============================================================== Notifications
export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    titleEn: varchar('title_en', { length: 300 }).notNull(),
    titleAr: varchar('title_ar', { length: 300 }).notNull(),
    link: varchar('link', { length: 500 }),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.createdAt)],
);

// ============================================================== Audit trail (append-only)
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    actorId: uuid('actor_id'),
    actorEmail: varchar('actor_email', { length: 254 }),
    action: varchar('action', { length: 100 }).notNull(),
    entityType: varchar('entity_type', { length: 30 }),
    entityId: uuid('entity_id'),
    outcome: auditOutcome('outcome').notNull().default('success'),
    ip: inet('ip'),
    userAgent: varchar('user_agent', { length: 400 }),
    requestId: varchar('request_id', { length: 64 }),
    changes: jsonb('changes').$type<Record<string, { from: unknown; to: unknown }>>(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  },
  (t) => [
    index('audit_logs_entity_idx').on(t.entityType, t.entityId),
    index('audit_logs_actor_idx').on(t.actorId),
    index('audit_logs_occurred_idx').on(t.occurredAt),
  ],
);
