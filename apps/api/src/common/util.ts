import { and, asc, desc, ilike, or, SQL, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type { Paginated } from '@cdms/contracts';

/** Escapes LIKE wildcards in user-supplied search terms. */
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export function searchFilter(q: string | undefined, columns: AnyPgColumn[]): SQL | undefined {
  if (!q) return undefined;
  const p = likePattern(q);
  return or(...columns.map((c) => ilike(c, p)));
}

export function allOf(...conds: (SQL | undefined)[]): SQL | undefined {
  const list = conds.filter((c): c is SQL => !!c);
  return list.length ? and(...list) : undefined;
}

/** Maps a client-supplied sort key to an allow-listed column (prevents SQL injection via sort). */
export function orderBy(
  sort: string | undefined,
  order: 'asc' | 'desc',
  allowed: Record<string, AnyPgColumn>,
  fallback: AnyPgColumn,
) {
  const col = (sort && allowed[sort]) || fallback;
  return order === 'desc' ? desc(col) : asc(col);
}

export const countAll = sql<number>`count(*)::int`;

export function paginated<T>(items: T[], total: number, page: number, pageSize: number): Paginated<T> {
  return { items, total, page, pageSize };
}

/** Produces a field-level diff for the audit log. Sensitive fields are masked. */
const SENSITIVE = new Set(['passwordHash', 'password', 'tokenHash']);
export function diff(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const k of keys) {
    if (['updatedAt', 'createdAt', 'rowVersion', 'updatedById'].includes(k)) continue;
    const a = before?.[k];
    const b = after?.[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      out[k] = SENSITIVE.has(k) ? { from: '***', to: '***' } : { from: a ?? null, to: b ?? null };
    }
  }
  return out;
}

/** Converts Date fields to ISO strings for DTOs. */
export function iso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  return d instanceof Date ? d.toISOString() : d;
}

/** Removes keys whose value is undefined (so partial updates don't null out columns). */
export function defined<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}
