import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { ListQuery, Paginated, ReferenceItemDto, ReferenceListDto } from '@cdms/contracts';
import { referenceItemSchema, referenceListSchema } from '@cdms/contracts';
import type { z } from 'zod';
import { DB, Database } from '../../database/database.module';
import { referenceItems, referenceLists } from '../../database/schema';
import { AuditService } from '../audit/audit.service';
import type { RequestUser } from '../../common/request-user';
import { lockForUpdate, touch } from '../../common/crud';
import { allOf, countAll, defined, diff, iso, paginated, searchFilter } from '../../common/util';
import { businessRule, notFound } from '../../common/errors';

type ListRow = typeof referenceLists.$inferSelect;
type ItemRow = typeof referenceItems.$inferSelect;
type ListInput = z.infer<typeof referenceListSchema>;
type ItemInput = z.infer<typeof referenceItemSchema>;

const listDto = (r: ListRow, itemCount?: number): ReferenceListDto => ({
  id: r.id,
  code: r.code,
  nameEn: r.nameEn,
  nameAr: r.nameAr,
  description: r.description,
  isSystem: r.isSystem,
  itemCount,
  createdAt: iso(r.createdAt)!,
  updatedAt: iso(r.updatedAt)!,
  rowVersion: r.rowVersion,
});
const itemDto = (r: ItemRow): ReferenceItemDto => ({
  id: r.id,
  listId: r.listId,
  code: r.code,
  labelEn: r.labelEn,
  labelAr: r.labelAr,
  sortOrder: r.sortOrder,
  isActive: r.isActive,
  createdAt: iso(r.createdAt)!,
  updatedAt: iso(r.updatedAt)!,
  rowVersion: r.rowVersion,
});

/**
 * Controlled vocabularies (sectors, governorates, programme types, ...). Items are referenced
 * by code from other records, therefore codes are immutable and items are deactivated, never deleted.
 */
@Injectable()
export class ReferenceDataService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async lists(q: ListQuery): Promise<Paginated<ReferenceListDto>> {
    const where = allOf(
      searchFilter(q.q, [referenceLists.code, referenceLists.nameEn, referenceLists.nameAr]),
    );
    const count = sql<number>`(select count(*)::int from reference_items ri where ri.list_id = "reference_lists"."id")`;
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({ l: referenceLists, count })
        .from(referenceLists)
        .where(where)
        .orderBy(asc(referenceLists.code))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      this.db.select({ total: countAll }).from(referenceLists).where(where),
    ]);
    return paginated(
      rows.map((r) => listDto(r.l, r.count)),
      total,
      q.page,
      q.pageSize,
    );
  }

  async getList(idOrCode: string) {
    const isUuid = /^[0-9a-f-]{36}$/i.test(idOrCode);
    const [r] = await this.db
      .select()
      .from(referenceLists)
      .where(
        isUuid
          ? eq(referenceLists.id, idOrCode)
          : sql`lower(${referenceLists.code}) = lower(${idOrCode})`,
      );
    if (!r) throw notFound('Reference list');
    return listDto(r);
  }

  async items(idOrCode: string, activeOnly = false): Promise<ReferenceItemDto[]> {
    const list = await this.getList(idOrCode);
    const rows = await this.db
      .select()
      .from(referenceItems)
      .where(
        and(
          eq(referenceItems.listId, list.id),
          activeOnly ? eq(referenceItems.isActive, true) : undefined,
        ),
      )
      .orderBy(asc(referenceItems.sortOrder), asc(referenceItems.labelEn));
    return rows.map(itemDto);
  }

  createList(input: ListInput, user: RequestUser) {
    return this.db.transaction(async (tx) => {
      const [r] = await tx
        .insert(referenceLists)
        .values({ ...input, createdById: user.id, updatedById: user.id })
        .returning();
      await this.audit.record(
        user,
        {
          action: 'reference_list.create',
          entityType: 'reference_list',
          entityId: r.id,
          changes: diff(null, r),
        },
        tx,
      );
      return listDto(r);
    });
  }

  updateList(id: string, input: Partial<ListInput> & { rowVersion: number }, user: RequestUser) {
    return this.db.transaction(async (tx) => {
      const { rowVersion, code, ...data } = input;
      const before = await lockForUpdate<ListRow>(
        tx,
        referenceLists,
        id,
        rowVersion,
        'Reference list',
      );
      if (code && code !== before.code)
        throw businessRule('Reference list codes cannot be changed');
      const [after] = await tx
        .update(referenceLists)
        .set({ ...defined(data), ...touch(referenceLists, user.id) })
        .where(eq(referenceLists.id, id))
        .returning();
      await this.audit.record(
        user,
        {
          action: 'reference_list.update',
          entityType: 'reference_list',
          entityId: id,
          changes: diff(before, after),
        },
        tx,
      );
      return listDto(after);
    });
  }

  createItem(listId: string, input: ItemInput, user: RequestUser) {
    return this.db.transaction(async (tx) => {
      await lockForUpdate<ListRow>(tx, referenceLists, listId, undefined, 'Reference list');
      const [r] = await tx
        .insert(referenceItems)
        .values({ ...input, listId, createdById: user.id, updatedById: user.id })
        .returning();
      await this.audit.record(
        user,
        {
          action: 'reference_item.create',
          entityType: 'reference_item',
          entityId: r.id,
          changes: diff(null, r),
          metadata: { listId },
        },
        tx,
      );
      return itemDto(r);
    });
  }

  updateItem(id: string, input: Partial<ItemInput> & { rowVersion: number }, user: RequestUser) {
    return this.db.transaction(async (tx) => {
      const { rowVersion, code, ...data } = input;
      const before = await lockForUpdate<ItemRow>(
        tx,
        referenceItems,
        id,
        rowVersion,
        'Reference item',
      );
      if (code && code !== before.code)
        throw businessRule(
          'Reference item codes cannot be changed because other records refer to them. Deactivate the item and create a new one.',
        );
      const [after] = await tx
        .update(referenceItems)
        .set({ ...defined(data), ...touch(referenceItems, user.id) })
        .where(eq(referenceItems.id, id))
        .returning();
      await this.audit.record(
        user,
        {
          action: 'reference_item.update',
          entityType: 'reference_item',
          entityId: id,
          changes: diff(before, after),
        },
        tx,
      );
      return itemDto(after);
    });
  }
}
