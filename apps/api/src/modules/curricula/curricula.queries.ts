import { z } from 'zod';
import { listQuerySchema } from '@cdms/contracts';

export const curriculumListQuerySchema = listQuerySchema.extend({
  occupationId: z.uuid().optional(),
  institutionId: z.uuid().optional(),
  mine: z.coerce.boolean().optional(),
  allVersions: z.coerce.boolean().optional(),
});
export type CurriculumListQuery = z.infer<typeof curriculumListQuerySchema>;
