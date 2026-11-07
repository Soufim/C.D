import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  PERMISSIONS,
  WORKFLOW_ACTIONS,
  WORKFLOW_ENTITY_TYPES,
} from '@cdms/contracts';
import type {
  RecordStatus,
  ReviewQueueItem,
  ValidationIssue,
  WorkflowEntityType,
  WorkflowEventDto,
  WorkflowTransitionInput,
} from '@cdms/contracts';
import { DB, Database, Tx } from '../../database/database.module';
import { users, workflowEvents } from '../../database/schema';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { RequestUser } from '../../common/request-user';
import { businessRule, forbidden, notFound, staleRecord } from '../../common/errors';
import { iso } from '../../common/util';
import { WORKFLOW_REGISTRY } from './workflow.registry';

export interface TransitionContext {
  entityType: WorkflowEntityType;
  id: string;
  action: WorkflowTransitionInput['action'];
  from: RecordStatus;
  to: RecordStatus;
  user: RequestUser;
  tx: Tx;
}
/** Domain modules register validators that can block a transition with explicit issues. */
export type TransitionValidator = (ctx: TransitionContext) => Promise<ValidationIssue[]>;
/** Runs inside the transition transaction after the status change (e.g. supersede previous version). */
export type TransitionHook = (ctx: TransitionContext) => Promise<void>;

@Injectable()
export class WorkflowService {
  private readonly validators = new Map<WorkflowEntityType, TransitionValidator[]>();
  private readonly hooks = new Map<WorkflowEntityType, TransitionHook[]>();

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  registerValidator(entityType: WorkflowEntityType, v: TransitionValidator) {
    this.validators.set(entityType, [...(this.validators.get(entityType) ?? []), v]);
  }

  registerAfterHook(entityType: WorkflowEntityType, h: TransitionHook) {
    this.hooks.set(entityType, [...(this.hooks.get(entityType) ?? []), h]);
  }

  async transition(entityType: WorkflowEntityType, id: string, input: WorkflowTransitionInput, user: RequestUser) {
    const cfg = WORKFLOW_REGISTRY[entityType];
    const rule = WORKFLOW_ACTIONS[input.action];
    if (!user.permissions.has(cfg.permissions[input.action])) throw forbidden();

    return this.db.transaction(async (tx) => {
      const t = cfg.table;
      const [row] = (await tx
        .select({ id: t.id, code: t.code, status: t.status, rowVersion: t.rowVersion, createdById: t.createdById, titleEn: cfg.titleEn, titleAr: cfg.titleAr })
        .from(t)
        .where(eq(t.id, id))
        .for('update')) as { id: string; code: string; status: RecordStatus; rowVersion: number; createdById: string | null; titleEn: string; titleAr: string }[];
      if (!row) throw notFound(cfg.labelEn);
      if (row.rowVersion !== input.rowVersion) throw staleRecord();
      if (!(rule.from as readonly RecordStatus[]).includes(row.status)) {
        throw businessRule(`Cannot ${input.action} a record in status "${row.status}"`);
      }
      if ((input.action === 'return') && !input.comment?.trim()) {
        throw businessRule('A comment is required when returning a record', [{ path: 'comment', message: 'Required' }]);
      }

      // Four-eyes principle: the person who submitted cannot approve the same submission.
      if (input.action === 'approve') {
        const [lastSubmit] = await tx
          .select({ actorId: workflowEvents.actorId })
          .from(workflowEvents)
          .where(and(eq(workflowEvents.entityType, entityType), eq(workflowEvents.entityId, id), eq(workflowEvents.action, 'submit')))
          .orderBy(desc(workflowEvents.occurredAt))
          .limit(1);
        if (lastSubmit?.actorId === user.id) {
          throw businessRule('You cannot approve a record you submitted (segregation of duties).');
        }
      }

      const ctx: TransitionContext = { entityType, id, action: input.action, from: row.status, to: rule.to, user, tx };
      const issues = (await Promise.all((this.validators.get(entityType) ?? []).map((v) => v(ctx)))).flat();
      const errors = issues.filter((i) => i.severity === 'error');
      if (errors.length) {
        throw businessRule('The record does not meet the requirements for this action', errors.map((e) => ({ path: e.code, message: e.messageEn })));
      }

      await tx
        .update(t)
        .set({ status: rule.to, rowVersion: sql`${t.rowVersion} + 1`, updatedAt: new Date(), updatedById: user.id } as never)
        .where(eq(t.id, id));
      for (const h of this.hooks.get(entityType) ?? []) await h(ctx);
      await tx.insert(workflowEvents).values({
        entityType, entityId: id, action: input.action, fromStatus: row.status, toStatus: rule.to,
        comment: input.comment ?? null, actorId: user.id,
      });
      await this.audit.record(user, {
        action: `${entityType}.${input.action}`, entityType, entityId: id,
        changes: { status: { from: row.status, to: rule.to } },
        metadata: input.comment ? { comment: input.comment } : undefined,
      }, tx);

      const link = `${cfg.route}/${id}`;
      const label = `${row.code} — `;
      if (input.action === 'submit') {
        await this.notifications.notifyPermission(cfg.permissions.approve === PERMISSIONS.CURRICULUM_APPROVE ? PERMISSIONS.CURRICULUM_REVIEW : cfg.permissions.return,
          { titleEn: `${cfg.labelEn} submitted for review: ${label}${row.titleEn}`, titleAr: `${cfg.labelAr} مقدم للمراجعة: ${label}${row.titleAr}`, link }, user.id, tx);
      } else if (row.createdById && row.createdById !== user.id) {
        const verbsEn: Record<string, string> = { return: 'returned for changes', approve: 'approved', publish: 'published', archive: 'archived', restore: 'restored' };
        const verbsAr: Record<string, string> = { return: 'أعيد للتعديل', approve: 'تم اعتماده', publish: 'تم نشره', archive: 'تمت أرشفته', restore: 'تمت استعادته' };
        await this.notifications.notifyUsers([row.createdById], {
          titleEn: `${cfg.labelEn} ${verbsEn[input.action]}: ${label}${row.titleEn}`,
          titleAr: `${cfg.labelAr} ${verbsAr[input.action]}: ${label}${row.titleAr}`,
          link,
        }, tx);
      }
      return { id, status: rule.to, rowVersion: row.rowVersion + 1, warnings: issues.filter((i) => i.severity === 'warning') };
    });
  }

  /** Runs validators without changing anything (used by the UI to show readiness). */
  async check(entityType: WorkflowEntityType, id: string, action: WorkflowTransitionInput['action'], user: RequestUser): Promise<ValidationIssue[]> {
    const cfg = WORKFLOW_REGISTRY[entityType];
    return this.db.transaction(async (tx) => {
      const [row] = (await tx.select({ status: cfg.table.status }).from(cfg.table).where(eq(cfg.table.id, id))) as { status: RecordStatus }[];
      if (!row) throw notFound(cfg.labelEn);
      const ctx: TransitionContext = { entityType, id, action, from: row.status, to: WORKFLOW_ACTIONS[action].to, user, tx };
      return (await Promise.all((this.validators.get(entityType) ?? []).map((v) => v(ctx)))).flat();
    });
  }

  async recordCreation(entityType: WorkflowEntityType, id: string, user: RequestUser, tx: Tx, action: 'create' | 'new_version' = 'create', comment?: string) {
    await tx.insert(workflowEvents).values({ entityType, entityId: id, action, fromStatus: null, toStatus: 'draft', actorId: user.id, comment: comment ?? null });
  }

  async history(entityType: WorkflowEntityType, id: string): Promise<WorkflowEventDto[]> {
    const rows = await this.db
      .select({ e: workflowEvents, actorName: users.fullNameEn })
      .from(workflowEvents)
      .leftJoin(users, eq(users.id, workflowEvents.actorId))
      .where(and(eq(workflowEvents.entityType, entityType), eq(workflowEvents.entityId, id)))
      .orderBy(desc(workflowEvents.occurredAt));
    return rows.map(({ e, actorName }) => ({
      id: e.id, entityType: e.entityType, entityId: e.entityId, action: e.action as WorkflowEventDto['action'],
      fromStatus: e.fromStatus, toStatus: e.toStatus, comment: e.comment, actorId: e.actorId, actorName, occurredAt: iso(e.occurredAt)!,
    }));
  }

  /** Items awaiting review that this user is allowed to act on. */
  async reviewQueue(user: RequestUser): Promise<ReviewQueueItem[]> {
    const out: ReviewQueueItem[] = [];
    for (const entityType of WORKFLOW_ENTITY_TYPES) {
      const cfg = WORKFLOW_REGISTRY[entityType];
      if (!user.permissions.has(cfg.permissions.return) && !user.permissions.has(cfg.permissions.approve)) continue;
      const rows = (await this.db
        .select({ id: cfg.table.id, code: cfg.table.code, titleEn: cfg.titleEn, titleAr: cfg.titleAr, status: cfg.table.status, updatedAt: cfg.table.updatedAt })
        .from(cfg.table)
        .where(eq(cfg.table.status, 'in_review'))
        .limit(200)) as { id: string; code: string; titleEn: string; titleAr: string; status: RecordStatus; updatedAt: Date }[];
      if (!rows.length) continue;
      const submits = await this.db
        .select({ entityId: workflowEvents.entityId, occurredAt: workflowEvents.occurredAt, actorName: users.fullNameEn })
        .from(workflowEvents)
        .leftJoin(users, eq(users.id, workflowEvents.actorId))
        .where(and(eq(workflowEvents.entityType, entityType), eq(workflowEvents.action, 'submit'), inArray(workflowEvents.entityId, rows.map((r) => r.id))))
        .orderBy(desc(workflowEvents.occurredAt));
      for (const r of rows) {
        const s = submits.find((x) => x.entityId === r.id);
        out.push({ entityType, entityId: r.id, code: r.code, titleEn: r.titleEn, titleAr: r.titleAr, status: r.status, submittedAt: iso(s?.occurredAt), submittedBy: s?.actorName ?? null });
      }
    }
    return out.sort((a, b) => (a.submittedAt ?? '').localeCompare(b.submittedAt ?? ''));
  }
}
