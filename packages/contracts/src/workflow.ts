import { z } from 'zod';
import { WORKFLOW_ACTION_NAMES } from './enums';
import type { RecordStatus, WorkflowAction } from './enums';
import { rowVersion } from './common';

export const workflowTransitionSchema = z.object({
  action: z.enum(WORKFLOW_ACTION_NAMES as [WorkflowAction, ...WorkflowAction[]]),
  comment: z.string().trim().max(4000).optional(),
  rowVersion,
});
export type WorkflowTransitionInput = z.infer<typeof workflowTransitionSchema>;

export interface WorkflowEventDto {
  id: string;
  entityType: string;
  entityId: string;
  action: WorkflowAction | 'create' | 'new_version';
  fromStatus: RecordStatus | null;
  toStatus: RecordStatus;
  comment: string | null;
  actorId: string | null;
  actorName: string | null;
  occurredAt: string;
}

export interface ReviewQueueItem {
  entityType: string;
  entityId: string;
  code: string;
  titleEn: string;
  titleAr: string;
  status: RecordStatus;
  submittedAt: string | null;
  submittedBy: string | null;
}
