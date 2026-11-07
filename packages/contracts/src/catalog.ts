import { z } from 'zod';
import { code, optionalText, rowVersion, textAr, textEn, uuid } from './common';
import type { BaseRecord, LinkedRef } from './common';
import { COMPETENCY_TYPES, OCCUPATION_LEVELS, TEMPLATE_KINDS } from './enums';
import type { RecordStatus } from './enums';

const withVersion = <T extends z.ZodRawShape>(shape: T) =>
  z.object(shape).partial().extend({ rowVersion });

// ---------------------------------------------------------------- Institutions
export const institutionSchema = z.object({
  code,
  nameEn: textEn,
  nameAr: textAr,
  typeCode: z.string().max(50).optional().nullable(),
  governorateCode: z.string().max(50).optional().nullable(),
  address: optionalText,
  isActive: z.boolean().default(true),
});
export type InstitutionInput = z.infer<typeof institutionSchema>;
export const updateInstitutionSchema = withVersion(institutionSchema.shape);
export interface InstitutionDto extends BaseRecord {
  code: string;
  nameEn: string;
  nameAr: string;
  typeCode: string | null;
  governorateCode: string | null;
  address: string | null;
  isActive: boolean;
}

// ---------------------------------------------------------------- Reference data
export const referenceListSchema = z.object({
  code,
  nameEn: textEn,
  nameAr: textAr,
  description: optionalText,
});
export type ReferenceListInput = z.infer<typeof referenceListSchema>;
export const updateReferenceListSchema = withVersion(referenceListSchema.shape);
export const referenceItemSchema = z.object({
  code,
  labelEn: textEn,
  labelAr: textAr,
  sortOrder: z.number().int().min(0).max(100_000).default(0),
  isActive: z.boolean().default(true),
});
export type ReferenceItemInput = z.infer<typeof referenceItemSchema>;
export const updateReferenceItemSchema = withVersion(referenceItemSchema.shape);
export interface ReferenceListDto extends BaseRecord {
  code: string;
  nameEn: string;
  nameAr: string;
  description: string | null;
  isSystem: boolean;
  itemCount?: number;
}
export interface ReferenceItemDto extends BaseRecord {
  listId: string;
  code: string;
  labelEn: string;
  labelAr: string;
  sortOrder: number;
  isActive: boolean;
}

// ---------------------------------------------------------------- Frameworks
export const frameworkSchema = z.object({
  code,
  nameEn: textEn,
  nameAr: textAr,
  description: optionalText,
  versionLabel: z.string().trim().max(30).default('1.0'),
});
export type FrameworkInput = z.infer<typeof frameworkSchema>;
export const updateFrameworkSchema = withVersion(frameworkSchema.shape);
export const frameworkLevelSchema = z.object({
  level: z.number().int().min(0).max(20),
  nameEn: textEn,
  nameAr: textAr,
  knowledgeEn: optionalText,
  knowledgeAr: optionalText,
  skillsEn: optionalText,
  skillsAr: optionalText,
  autonomyEn: optionalText,
  autonomyAr: optionalText,
});
export type FrameworkLevelInput = z.infer<typeof frameworkLevelSchema>;
export const updateFrameworkLevelSchema = withVersion(frameworkLevelSchema.shape);
export interface FrameworkLevelDto extends BaseRecord {
  frameworkId: string;
  level: number;
  nameEn: string;
  nameAr: string;
  knowledgeEn: string | null;
  knowledgeAr: string | null;
  skillsEn: string | null;
  skillsAr: string | null;
  autonomyEn: string | null;
  autonomyAr: string | null;
}
export interface FrameworkDto extends BaseRecord {
  code: string;
  nameEn: string;
  nameAr: string;
  description: string | null;
  versionLabel: string;
  status: RecordStatus;
  levels?: FrameworkLevelDto[];
}

// ---------------------------------------------------------------- Occupations
export const occupationSchema = z.object({
  code,
  titleEn: textEn,
  titleAr: textAr,
  descriptionEn: optionalText,
  descriptionAr: optionalText,
  level: z.enum(OCCUPATION_LEVELS),
  parentId: uuid.nullable().optional(),
  iscoCode: z.string().trim().max(10).optional().nullable(),
  sectorCode: z.string().max(50).optional().nullable(),
});
export type OccupationInput = z.infer<typeof occupationSchema>;
export const updateOccupationSchema = withVersion(occupationSchema.shape);
export interface OccupationDto extends BaseRecord {
  code: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  level: (typeof OCCUPATION_LEVELS)[number];
  parentId: string | null;
  iscoCode: string | null;
  sectorCode: string | null;
  status: RecordStatus;
  childCount?: number;
  competencies?: LinkedRef[];
  parent?: LinkedRef | null;
}

// ---------------------------------------------------------------- Competencies
export const competencySchema = z.object({
  code,
  titleEn: textEn,
  titleAr: textAr,
  descriptionEn: optionalText,
  descriptionAr: optionalText,
  type: z.enum(COMPETENCY_TYPES),
  frameworkLevelId: uuid.nullable().optional(),
  performanceCriteriaEn: optionalText,
  performanceCriteriaAr: optionalText,
});
export type CompetencyInput = z.infer<typeof competencySchema>;
export const updateCompetencySchema = withVersion(competencySchema.shape);
export interface CompetencyDto extends BaseRecord {
  code: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  type: (typeof COMPETENCY_TYPES)[number];
  frameworkLevelId: string | null;
  frameworkLevelLabel?: string | null;
  performanceCriteriaEn: string | null;
  performanceCriteriaAr: string | null;
  status: RecordStatus;
  occupations?: LinkedRef[];
  units?: LinkedRef[];
}

// ---------------------------------------------------------------- Units
export const learningOutcomeSchema = z.object({
  id: uuid.optional(),
  code: z.string().trim().min(1).max(30),
  textEn: z.string().trim().min(1).max(2000),
  textAr: z.string().trim().min(1).max(2000),
});
export const unitSchema = z.object({
  code,
  titleEn: textEn,
  titleAr: textAr,
  descriptionEn: optionalText,
  descriptionAr: optionalText,
  frameworkLevelId: uuid.nullable().optional(),
  creditHours: z.number().min(0).max(100).default(0),
  theoryHours: z.number().int().min(0).max(2000).default(0),
  practicalHours: z.number().int().min(0).max(2000).default(0),
  assessmentEn: optionalText,
  assessmentAr: optionalText,
  learningOutcomes: z.array(learningOutcomeSchema).max(100).default([]),
});
export type UnitInput = z.infer<typeof unitSchema>;
export const updateUnitSchema = withVersion(unitSchema.shape);
export interface UnitDto extends BaseRecord {
  code: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  frameworkLevelId: string | null;
  frameworkLevelLabel?: string | null;
  creditHours: number;
  theoryHours: number;
  practicalHours: number;
  assessmentEn: string | null;
  assessmentAr: string | null;
  status: RecordStatus;
  learningOutcomes?: { id: string; code: string; textEn: string; textAr: string; sortOrder: number }[];
  competencies?: LinkedRef[];
  curricula?: LinkedRef[];
}

// ---------------------------------------------------------------- Templates
export const templateSectionSchema = z.object({
  key: z.string().trim().min(1).max(50).regex(/^[a-z0-9_]+$/),
  titleEn: z.string().trim().min(1).max(200),
  titleAr: z.string().trim().min(1).max(200),
  guidanceEn: z.string().trim().max(4000).optional().nullable(),
  guidanceAr: z.string().trim().max(4000).optional().nullable(),
  required: z.boolean().default(false),
});
export type TemplateSection = z.infer<typeof templateSectionSchema>;
export const templateSchema = z.object({
  code,
  nameEn: textEn,
  nameAr: textAr,
  descriptionEn: optionalText,
  descriptionAr: optionalText,
  kind: z.enum(TEMPLATE_KINDS),
  sections: z
    .array(templateSectionSchema)
    .max(60)
    .default([])
    .refine((s) => new Set(s.map((x) => x.key)).size === s.length, 'Section keys must be unique'),
});
export type TemplateInput = z.infer<typeof templateSchema>;
export const updateTemplateSchema = withVersion(templateSchema.shape);
export interface TemplateDto extends BaseRecord {
  code: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  kind: (typeof TEMPLATE_KINDS)[number];
  sections: TemplateSection[];
  status: RecordStatus;
  usageCount?: number;
}

// ---------------------------------------------------------------- Links
export const linkSchema = z.object({ targetId: uuid });
export const linkManySchema = z.object({ targetIds: z.array(uuid).min(1).max(200) });

export interface ImpactReport {
  entityType: string;
  entityId: string;
  /** Records that would be affected by changing or withdrawing this record. */
  affected: { entityType: string; items: LinkedRef[] }[];
  totalAffected: number;
  publishedAffected: number;
}
