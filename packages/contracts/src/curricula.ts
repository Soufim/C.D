import { z } from 'zod';
import { code, optionalText, patchSchema, rowVersion, textAr, textEn, uuid } from './common';
import type { BaseRecord, LinkedRef } from './common';
import type { RecordStatus } from './enums';

export const curriculumSchema = z.object({
  code,
  titleEn: textEn,
  titleAr: textAr,
  summaryEn: optionalText,
  summaryAr: optionalText,
  occupationId: uuid.nullable().optional(),
  frameworkLevelId: uuid.nullable().optional(),
  institutionId: uuid.nullable().optional(),
  templateId: uuid.nullable().optional(),
  programTypeCode: z.string().max(50).optional().nullable(),
  durationMonths: z.number().int().min(0).max(120).default(0),
  effectiveFrom: z.iso.date().optional().nullable(),
  /** Template section content keyed by section key, per language. */
  sections: z
    .record(
      z.string().max(50),
      z.object({ en: z.string().max(50_000).default(''), ar: z.string().max(50_000).default('') }),
    )
    .default({}),
});
export type CurriculumInput = z.infer<typeof curriculumSchema>;
export const updateCurriculumSchema = patchSchema(curriculumSchema.shape);

export const curriculumUnitSchema = z.object({
  unitId: uuid,
  term: z.number().int().min(1).max(20).default(1),
  isMandatory: z.boolean().default(true),
});
export const setCurriculumUnitsSchema = z.object({
  rowVersion,
  units: z.array(curriculumUnitSchema).max(200),
});
export type SetCurriculumUnitsInput = z.infer<typeof setCurriculumUnitsSchema>;

export interface CurriculumUnitDto {
  unitId: string;
  code: string;
  titleEn: string;
  titleAr: string;
  status: RecordStatus;
  term: number;
  sortOrder: number;
  isMandatory: boolean;
  creditHours: number;
  theoryHours: number;
  practicalHours: number;
}

export interface CurriculumDto extends BaseRecord {
  code: string;
  titleEn: string;
  titleAr: string;
  summaryEn: string | null;
  summaryAr: string | null;
  occupationId: string | null;
  occupation?: LinkedRef | null;
  frameworkLevelId: string | null;
  frameworkLevelLabel?: string | null;
  institutionId: string | null;
  institutionNameEn?: string | null;
  institutionNameAr?: string | null;
  templateId: string | null;
  programTypeCode: string | null;
  durationMonths: number;
  effectiveFrom: string | null;
  sections: Record<string, { en: string; ar: string }>;
  status: RecordStatus;
  version: number;
  previousVersionId: string | null;
  createdById: string | null;
  units?: CurriculumUnitDto[];
  totals?: { units: number; creditHours: number; theoryHours: number; practicalHours: number };
}

/** Competency coverage: which competencies required by the occupation are covered by units. */
export interface CoverageReport {
  required: (LinkedRef & { coveredBy: LinkedRef[] })[];
  additional: LinkedRef[];
  coveragePercent: number;
}

export interface ValidationIssue {
  severity: 'error' | 'warning';
  code: string;
  messageEn: string;
  messageAr: string;
}
