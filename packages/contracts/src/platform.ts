import { z } from 'zod';
import { IMPORTABLE_ENTITIES } from './enums';
import type { RecordStatus } from './enums';

// ---------------------------------------------------------------- Files
export const ALLOWED_UPLOAD_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'text/csv': ['.csv'],
  'text/plain': ['.txt'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
} as const;
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export interface FileDto {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  entityType: string | null;
  entityId: string | null;
  uploadedById: string | null;
  uploadedByName?: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------- Import / export
export const importRequestSchema = z.object({
  entity: z.enum(IMPORTABLE_ENTITIES),
  format: z.enum(['csv', 'json']),
  /** Required when entity = reference_item. */
  listCode: z.string().max(50).optional(),
  dryRun: z.coerce.boolean().default(true),
  /** upsert updates draft records with the same code; create skips existing codes. */
  mode: z.enum(['create', 'upsert']).default('create'),
});
export type ImportRequest = z.infer<typeof importRequestSchema>;

export interface ImportResult {
  dryRun: boolean;
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; field?: string; message: string }[];
}

// ---------------------------------------------------------------- Dashboard & search
export interface DashboardStats {
  counts: Record<'curricula' | 'units' | 'competencies' | 'occupations' | 'templates' | 'institutions', number>;
  curriculaByStatus: Record<RecordStatus, number>;
  pendingReviews: number;
  myDrafts: number;
  recentActivity: {
    id: string;
    action: string;
    entityType: string | null;
    entityId: string | null;
    actorName: string | null;
    occurredAt: string;
  }[];
}

export interface SearchHit {
  entityType: 'curriculum' | 'unit' | 'competency' | 'occupation' | 'template';
  id: string;
  code: string;
  titleEn: string;
  titleAr: string;
  status: RecordStatus;
}

// ---------------------------------------------------------------- Notifications
export interface NotificationDto {
  id: string;
  titleEn: string;
  titleAr: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}
