import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { LinkedRef, OccupationDto, OccupationInput, Paginated, UpdateOf } from '@cdms/contracts';
import { DB, Database } from '../../database/database.module';
import { competencies, occupationCompetencies, occupations } from '../../database/schema';
import { AuditService } from '../audit/audit.service';
import { WorkflowService } from '../workflow/workflow.service';
import type { RequestUser } from '../../common/request-user';
import { assertEditable, lockForUpdate, touch } from '../../common/crud';
import { allOf, countAll, defined, diff, iso, orderBy, paginated, searchFilter } from '../../common/util';
import { businessRule, notFound } from '../../common/errors';
import { ImpactService, linkedCompetencyCols } from './impact.service';
import type { OccupationListQuery } from './catalog.queries';

type Row = typeof occupations.$inferSelect;
const OCC_ORDER = ['major_group', 'sub_major_group', 'minor_group', 'unit_group', 'occupation'];

export const occupationDto = (r: Row, extra: Partial<OccupationDto> = {}): OccupationDto => ({
  id: r.id, code: r.code, titleEn: r.titleEn, titleAr: r.titleAr, descriptionEn: r.descriptionEn, descriptionAr: r.descriptionAr,
  level: r.level, parentId: r.parentId, iscoCode: r.iscoCode, sectorCode: r.sectorCode, status: r.status,
  createdAt: iso(r.createdAt)!, updatedAt: iso(r.updatedAt)!, rowVersion: r.rowVersion, ...extra,
});

/** Occupational classification (ISCO-08 aligned hierarchy) and occupation → competency profiles. */
@Injectable()
export class OccupationsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
    private readonly workflow: WorkflowService,
    private readonly impact: ImpactService,
  ) {
    this.workflow.registerValidator('occupation', async ({ id, action, tx }) => {
      if (action === 'archive') {
        const r = await this.impact.occupation(id, tx);
        if (r.publishedAffected) return [{ severity: 'error', code: 'in_use', messageEn: `Used by ${r.publishedAffected} published record(s)`, messageAr: `مستخدم في ${r.publishedAffected} سجل منشور` }];
      }
      if (action === 'publish') {
        const [row] = await tx.select({ parentId: occupations.parentId }).from(occupations).where(eq(occupations.id, id));
        if (row?.parentId) {
          const [p] = await tx.select({ status: occupations.status }).from(occupations).where(eq(occupations.id, row.parentId));
          if (p && p.status !== 'published') return [{ severity: 'error', code: 'parent', messageEn: 'Publish the parent group first', messageAr: 'انشر المجموعة الأم أولاً' }];
        }
      }
      return [];
    });
  }

  async list(q: OccupationListQuery): Promise<Paginated<OccupationDto>> {
    const childCount = sql<number>`(select count(*)::int from occupations c where c.parent_id = "occupations"."id")`;
    const where = allOf(
      searchFilter(q.q, [occupations.code, occupations.titleEn, occupations.titleAr, occupations.iscoCode]),
      q.status ? eq(occupations.status, q.status) : undefined,
      q.level ? eq(occupations.level, q.level) : undefined,
      q.parentId === 'root' ? isNull(occupations.parentId) : q.parentId ? eq(occupations.parentId, q.parentId) : undefined,
    );
    const [rows, [{ total }]] = await Promise.all([
      this.db.select({ o: occupations, childCount }).from(occupations).where(where)
        .orderBy(orderBy(q.sort, q.order, { code: occupations.code, titleEn: occupations.titleEn, updatedAt: occupations.updatedAt, status: occupations.status }, occupations.code))
        .limit(q.pageSize).offset((q.page - 1) * q.pageSize),
      this.db.select({ total: countAll }).from(occupations).where(where),
    ]);
    return paginated(rows.map((r) => occupationDto(r.o, { childCount: r.childCount })), total, q.page, q.pageSize);
  }

  async get(id: string): Promise<OccupationDto> {
    const parent = alias(occupations, 'parent');
    const [r] = await this.db.select({ o: occupations, p: { id: parent.id, code: parent.code, titleEn: parent.titleEn, titleAr: parent.titleAr, status: parent.status } })
      .from(occupations).leftJoin(parent, eq(parent.id, occupations.parentId)).where(eq(occupations.id, id));
    if (!r) throw notFound('Occupation');
    const comps = await this.db.select(linkedCompetencyCols).from(occupationCompetencies)
      .innerJoin(competencies, eq(competencies.id, occupationCompetencies.competencyId))
      .where(eq(occupationCompetencies.occupationId, id)).orderBy(competencies.code);
    return occupationDto(r.o, { parent: r.p?.id ? (r.p as LinkedRef) : null, competencies: comps });
  }

  /** Breadcrumb from root to the occupation. */
  async ancestors(id: string): Promise<LinkedRef[]> {
    const res = await this.db.execute<{ id: string; code: string; title_en: string; title_ar: string; status: string; depth: number }>(sql`
      WITH RECURSIVE a AS (
        SELECT id, code, title_en, title_ar, status, parent_id, 0 AS depth FROM occupations WHERE id = ${id}
        UNION ALL
        SELECT o.id, o.code, o.title_en, o.title_ar, o.status, o.parent_id, a.depth + 1 FROM occupations o JOIN a ON o.id = a.parent_id
      ) SELECT * FROM a ORDER BY depth DESC`);
    return res.rows.map((r) => ({ id: r.id, code: r.code, titleEn: r.title_en, titleAr: r.title_ar, status: r.status }));
  }

  private async validateParent(tx: Parameters<Parameters<Database['transaction']>[0]>[0], level: Row['level'], parentId: string | null | undefined) {
    if (!parentId) {
      if (level !== 'major_group') throw businessRule('Only major groups can be top-level', [{ path: 'parentId', message: 'Parent is required' }]);
      return;
    }
    const [p] = await tx.select({ level: occupations.level }).from(occupations).where(eq(occupations.id, parentId));
    if (!p) throw businessRule('Parent not found', [{ path: 'parentId', message: 'Not found' }]);
    if (OCC_ORDER.indexOf(p.level) >= OCC_ORDER.indexOf(level)) {
      throw businessRule('Parent must be a higher classification level', [{ path: 'parentId', message: 'Invalid parent level' }]);
    }
  }

  create(input: OccupationInput, user: RequestUser) {
    return this.db.transaction(async (tx) => {
      await this.validateParent(tx, input.level, input.parentId);
      const [r] = await tx.insert(occupations).values({ ...input, createdById: user.id, updatedById: user.id }).returning();
      await this.workflow.recordCreation('occupation', r.id, user, tx);
      await this.audit.record(user, { action: 'occupation.create', entityType: 'occupation', entityId: r.id, changes: diff(null, r) }, tx);
      return occupationDto(r);
    });
  }

  update(id: string, input: UpdateOf<OccupationInput>, user: RequestUser) {
    return this.db.transaction(async (tx) => {
      const { rowVersion, ...data } = input;
      const before = await lockForUpdate<Row>(tx, occupations, id, rowVersion, 'Occupation');
      assertEditable(before.status);
      if (data.level !== undefined || data.parentId !== undefined) {
        await this.validateParent(tx, data.level ?? before.level, data.parentId === undefined ? before.parentId : data.parentId);
      }
      const [after] = await tx.update(occupations).set({ ...defined(data), ...touch(occupations, user.id) }).where(eq(occupations.id, id)).returning();
      await this.audit.record(user, { action: 'occupation.update', entityType: 'occupation', entityId: id, changes: diff(before, after) }, tx);
      return occupationDto(after);
    });
  }

  linkCompetencies(id: string, competencyIds: string[], user: RequestUser) {
    return this.db.transaction(async (tx) => {
      const occ = await lockForUpdate<Row>(tx, occupations, id, undefined, 'Occupation');
      assertEditable(occ.status);
      if (occ.level !== 'occupation') throw businessRule('Competencies can only be linked to occupations, not groups');
      const found = await tx.select({ id: competencies.id, status: competencies.status }).from(competencies).where(inArray(competencies.id, competencyIds));
      if (found.length !== new Set(competencyIds).size) throw businessRule('One or more competencies do not exist');
      if (found.some((c) => c.status === 'archived')) throw businessRule('Archived competencies cannot be linked');
      await tx.insert(occupationCompetencies).values(competencyIds.map((competencyId) => ({ occupationId: id, competencyId }))).onConflictDoNothing();
      await tx.update(occupations).set(touch(occupations, user.id)).where(eq(occupations.id, id));
      await this.audit.record(user, { action: 'occupation.link_competencies', entityType: 'occupation', entityId: id, metadata: { competencyIds } }, tx);
    });
  }

  unlinkCompetency(id: string, competencyId: string, user: RequestUser) {
    return this.db.transaction(async (tx) => {
      const occ = await lockForUpdate<Row>(tx, occupations, id, undefined, 'Occupation');
      assertEditable(occ.status);
      await tx.delete(occupationCompetencies).where(and(eq(occupationCompetencies.occupationId, id), eq(occupationCompetencies.competencyId, competencyId)));
      await tx.update(occupations).set(touch(occupations, user.id)).where(eq(occupations.id, id));
      await this.audit.record(user, { action: 'occupation.unlink_competency', entityType: 'occupation', entityId: id, metadata: { competencyId } }, tx);
    });
  }
}
