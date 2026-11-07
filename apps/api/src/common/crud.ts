import { eq, sql } from 'drizzle-orm';
import type { AnyPgTable, PgColumn } from 'drizzle-orm/pg-core';
import { EDITABLE_STATUSES } from '@cdms/contracts';
import type { RecordStatus } from '@cdms/contracts';
import type { DbOrTx } from '../database/database.module';
import { notEditable, notFound, staleRecord } from './errors';

type Lockable = AnyPgTable & { id: PgColumn; rowVersion: PgColumn };

/**
 * Loads a row with SELECT ... FOR UPDATE inside a transaction and checks the client's
 * optimistic-lock token. Use for every update/delete of a versioned record.
 */
export async function lockForUpdate<T extends Record<string, unknown>>(
  tx: DbOrTx,
  table: Lockable,
  id: string,
  expectedRowVersion: number | undefined,
  label: string,
): Promise<T> {
  const [row] = (await tx.select().from(table as AnyPgTable).where(eq(table.id, id)).for('update')) as T[];
  if (!row) throw notFound(label);
  if (expectedRowVersion !== undefined && row.rowVersion !== expectedRowVersion) throw staleRecord();
  return row;
}

/** Content of controlled records may only change while in draft. */
export function assertEditable(status: RecordStatus) {
  if (!EDITABLE_STATUSES.includes(status)) throw notEditable(status);
}

/** Standard bookkeeping columns for an update. */
export function touch(table: Lockable, userId: string) {
  return { updatedAt: new Date(), updatedById: userId, rowVersion: sql`${table.rowVersion} + 1` } as Record<string, unknown>;
}
