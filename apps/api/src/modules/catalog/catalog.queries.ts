import { z } from 'zod';
import { COMPETENCY_TYPES, listQuerySchema, OCCUPATION_LEVELS } from '@cdms/contracts';

export const occupationListQuerySchema = listQuerySchema.extend({
  parentId: z.union([z.literal('root'), z.uuid()]).optional(),
  level: z.enum(OCCUPATION_LEVELS).optional(),
});
export type OccupationListQuery = z.infer<typeof occupationListQuerySchema>;

export const competencyListQuerySchema = listQuerySchema.extend({
  type: z.enum(COMPETENCY_TYPES).optional(),
  frameworkLevelId: z.uuid().optional(),
  occupationId: z.uuid().optional(),
});
export type CompetencyListQuery = z.infer<typeof competencyListQuerySchema>;

export const unitListQuerySchema = listQuerySchema.extend({
  frameworkLevelId: z.uuid().optional(),
  competencyId: z.uuid().optional(),
});
export type UnitListQuery = z.infer<typeof unitListQuerySchema>;
