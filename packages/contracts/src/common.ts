import { z } from 'zod';
import { RECORD_STATUSES } from './enums';

export const uuid = z.uuid();

/** Codes are stable, human-readable business identifiers (e.g. "CMP-ELEC-001"). */
export const code = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, 'Use letters, digits, dot, dash or underscore');

export const textEn = z.string().trim().min(1).max(300);
export const textAr = z.string().trim().min(1).max(300);
export const optionalText = z.string().trim().max(10_000).optional().nullable();

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  q: z.string().trim().max(200).optional(),
  sort: z.string().trim().max(50).optional(),
  order: z.enum(['asc', 'desc']).default('asc'),
  status: z.enum(RECORD_STATUSES).optional(),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Fields every persisted record exposes. `rowVersion` is used for optimistic locking. */
export interface BaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
}

/** Optimistic-locking token that must accompany every update. */
export const rowVersion = z.number().int().min(0);

/** Standard error body produced by the API (RFC 9457 problem details). */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: { path: string; message: string }[];
  traceId?: string;
}

export interface LinkedRef {
  id: string;
  code: string;
  titleEn: string;
  titleAr: string;
  status?: string;
}

/** Shape of every PATCH body: a partial record plus the optimistic-lock token. */
export type UpdateOf<T> = Partial<T> & { rowVersion: number };
