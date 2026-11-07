import type { ImportableEntity } from '@cdms/contracts';

/** Column layout for CSV import/export, per entity. The same headers are used both ways. */
export const COLUMNS: Record<ImportableEntity, string[]> = {
  occupation: ['code', 'titleEn', 'titleAr', 'level', 'parentCode', 'iscoCode', 'sectorCode', 'descriptionEn', 'descriptionAr', 'status'],
  competency: ['code', 'titleEn', 'titleAr', 'type', 'descriptionEn', 'descriptionAr', 'performanceCriteriaEn', 'performanceCriteriaAr', 'status'],
  unit: ['code', 'titleEn', 'titleAr', 'creditHours', 'theoryHours', 'practicalHours', 'descriptionEn', 'descriptionAr', 'competencyCodes', 'status'],
  reference_item: ['code', 'labelEn', 'labelAr', 'sortOrder', 'isActive'],
  institution: ['code', 'nameEn', 'nameAr', 'typeCode', 'governorateCode', 'address', 'isActive'],
};

/** Neutralises spreadsheet formula injection (OWASP CSV injection). */
export function csvSafe(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = Array.isArray(v) ? v.join('|') : String(v);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}
