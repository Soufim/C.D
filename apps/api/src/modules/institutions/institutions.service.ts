import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { InstitutionDto, InstitutionInput, ListQuery, Paginated } from '@cdms/contracts';
import { DB, Database } from '../../database/database.module';
import { institutions } from '../../database/schema';
import { AuditService } from '../audit/audit.service';
import type { RequestUser } from '../../common/request-user';
import { lockForUpdate, touch } from '../../common/crud';
import {
  countAll,
  defined,
  diff,
  iso,
  orderBy,
  paginated,
  searchFilter,
  allOf,
} from '../../common/util';
import { notFound } from '../../common/errors';

type Row = typeof institutions.$inferSelect;
export const toInstitutionDto = (r: Row): InstitutionDto => ({
  id: r.id,
  code: r.code,
  nameEn: r.nameEn,
  nameAr: r.nameAr,
  typeCode: r.typeCode,
  governorateCode: r.governorateCode,
  address: r.address,
  isActive: r.isActive,
  createdAt: iso(r.createdAt)!,
  updatedAt: iso(r.updatedAt)!,
  rowVersion: r.rowVersion,
});

@Injectable()
export class InstitutionsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async list(q: ListQuery): Promise<Paginated<InstitutionDto>> {
    const where = allOf(
      searchFilter(q.q, [institutions.code, institutions.nameEn, institutions.nameAr]),
    );
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(institutions)
        .where(where)
        .orderBy(
          orderBy(
            q.sort,
            q.order,
            {
              code: institutions.code,
              nameEn: institutions.nameEn,
              updatedAt: institutions.updatedAt,
            },
            institutions.code,
          ),
        )
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      this.db.select({ total: countAll }).from(institutions).where(where),
    ]);
    return paginated(rows.map(toInstitutionDto), total, q.page, q.pageSize);
  }

  async get(id: string) {
    const [r] = await this.db.select().from(institutions).where(eq(institutions.id, id));
    if (!r) throw notFound('Institution');
    return toInstitutionDto(r);
  }

  create(input: InstitutionInput, user: RequestUser) {
    return this.db.transaction(async (tx) => {
      const [r] = await tx
        .insert(institutions)
        .values({ ...input, createdById: user.id, updatedById: user.id })
        .returning();
      await this.audit.record(
        user,
        {
          action: 'institution.create',
          entityType: 'institution',
          entityId: r.id,
          changes: diff(null, r),
        },
        tx,
      );
      return toInstitutionDto(r);
    });
  }

  update(id: string, input: Partial<InstitutionInput> & { rowVersion: number }, user: RequestUser) {
    return this.db.transaction(async (tx) => {
      const { rowVersion, ...data } = input;
      const before = await lockForUpdate<Row>(tx, institutions, id, rowVersion, 'Institution');
      const [after] = await tx
        .update(institutions)
        .set({ ...defined(data), ...touch(institutions, user.id) })
        .where(eq(institutions.id, id))
        .returning();
      await this.audit.record(
        user,
        {
          action: 'institution.update',
          entityType: 'institution',
          entityId: id,
          changes: diff(before, after),
        },
        tx,
      );
      return toInstitutionDto(after);
    });
  }
}
