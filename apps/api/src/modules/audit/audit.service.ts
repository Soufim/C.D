import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, lte, SQL } from 'drizzle-orm';
import type { AuditEntryDto, AuditQuery, Paginated } from '@cdms/contracts';
import { DB, Database, DbOrTx } from '../../database/database.module';
import { auditLogs, users } from '../../database/schema';
import type { RequestUser } from '../../common/request-user';
import { countAll, iso, paginated } from '../../common/util';

export interface AuditEntry {
  action: string;
  entityType?: string;
  entityId?: string | null;
  outcome?: 'success' | 'failure';
  changes?: Record<string, { from: unknown; to: unknown }>;
  metadata?: Record<string, unknown>;
}

/**
 * Append-only audit trail. Call `record` INSIDE the same transaction as the change it
 * describes so the change and its audit entry commit (or roll back) together.
 */
@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async record(
    actor: Pick<RequestUser, 'id' | 'email' | 'ip' | 'userAgent' | 'requestId'> | null,
    entry: AuditEntry,
    tx: DbOrTx = this.db,
  ): Promise<void> {
    if (entry.changes && Object.keys(entry.changes).length === 0 && !entry.metadata) {
      entry.changes = undefined;
    }
    await tx.insert(auditLogs).values({
      actorId: actor?.id ?? null,
      actorEmail: actor?.email ?? null,
      action: entry.action,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      outcome: entry.outcome ?? 'success',
      ip: actor?.ip ?? null,
      userAgent: actor?.userAgent?.slice(0, 400) ?? null,
      requestId: actor?.requestId ?? null,
      changes: entry.changes ?? null,
      metadata: entry.metadata ?? null,
    });
  }

  async list(q: AuditQuery): Promise<Paginated<AuditEntryDto>> {
    const conds: SQL[] = [];
    if (q.entityType) conds.push(eq(auditLogs.entityType, q.entityType));
    if (q.entityId) conds.push(eq(auditLogs.entityId, q.entityId));
    if (q.actorId) conds.push(eq(auditLogs.actorId, q.actorId));
    if (q.action) conds.push(eq(auditLogs.action, q.action));
    if (q.from) conds.push(gte(auditLogs.occurredAt, new Date(q.from)));
    if (q.to) conds.push(lte(auditLogs.occurredAt, new Date(q.to)));
    const where = conds.length ? and(...conds) : undefined;
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({ log: auditLogs, actorName: users.fullNameEn })
        .from(auditLogs)
        .leftJoin(users, eq(users.id, auditLogs.actorId))
        .where(where)
        .orderBy(desc(auditLogs.occurredAt), desc(auditLogs.id))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      this.db.select({ total: countAll }).from(auditLogs).where(where),
    ]);
    return paginated(
      rows.map(({ log, actorName }) => ({
        id: log.id.toString(),
        occurredAt: iso(log.occurredAt)!,
        actorId: log.actorId,
        actorName: actorName ?? log.actorEmail,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        outcome: log.outcome,
        ip: log.ip,
        changes: log.changes,
        metadata: log.metadata,
      })),
      total,
      q.page,
      q.pageSize,
    );
  }
}
