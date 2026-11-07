import { Inject, Injectable } from '@nestjs/common';
import { eq, inArray, sql } from 'drizzle-orm';
import type { CompetencyDto, CompetencyInput, Paginated, UpdateOf } from '@cdms/contracts';
import { DB, Database } from '../../database/database.module';
import { competencies, occupationCompetencies, unitCompetencies } from '../../database/schema';
import { AuditService } from '../audit/audit.service';
import { WorkflowService } from '../workflow/workflow.service';
import type { RequestUser } from '../../common/request-user';
import { assertEditable, lockForUpdate, touch } from '../../common/crud';
import { allOf, countAll, defined, diff, iso, orderBy, paginated, searchFilter } from '../../common/util';
import { notFound } from '../../common/errors';
import { ImpactService } from './impact.service';
import type { CompetencyListQuery } from './catalog.queries';

type Row = typeof competencies.$inferSelect;


const dto = (r: Row, extra: Partial<CompetencyDto> = {}): CompetencyDto => ({
  id: r.id, code: r.code, titleEn: r.titleEn, titleAr: r.titleAr, descriptionEn: r.descriptionEn, descriptionAr: r.descriptionAr,
  type: r.type, frameworkLevelId: r.frameworkLevelId, performanceCriteriaEn: r.performanceCriteriaEn, performanceCriteriaAr: r.performanceCriteriaAr,
  status: r.status, createdAt: iso(r.createdAt)!, updatedAt: iso(r.updatedAt)!, rowVersion: r.rowVersion, ...extra,
});

/** Competency standards: the shared building blocks linked from occupations and units. */
@Injectable()
export class CompetenciesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
    private readonly workflow: WorkflowService,
    private readonly impact: ImpactService,
  ) {
    this.workflow.registerValidator('competency', async ({ id, action, tx }) => {
      if (action === 'archive' || action === 'restore') {
        const r = await this.impact.competency(id, tx);
        if (action === 'archive' && r.publishedAffected) {
          return [{ severity: 'error', code: 'in_use', messageEn: `Linked to ${r.publishedAffected} published record(s). Withdraw them first.`, messageAr: `مرتبط بعدد ${r.publishedAffected} من السجلات المنشورة` }];
        }
      }
      if (action === 'submit') {
        const [c] = await tx.select().from(competencies).where(eq(competencies.id, id));
        const issues = [];
        if (!c.performanceCriteriaEn && !c.performanceCriteriaAr) issues.push({ severity: 'error' as const, code: 'performanceCriteria', messageEn: 'Performance criteria are required', messageAr: 'معايير الأداء مطلوبة' });
        if (!c.frameworkLevelId) issues.push({ severity: 'warning' as const, code: 'frameworkLevelId', messageEn: 'No qualification level assigned', messageAr: 'لم يحدد مستوى التأهيل' });
        return issues;
      }
      return [];
    });
  }

  /** Correlated subquery — outer column is qualified explicitly (drizzle renders bare names). */
  private levelLabelFor(_col: typeof competencies.frameworkLevelId) {
    return sql<string | null>`(select f.code || ' L' || l.level from framework_levels l join frameworks f on f.id = l.framework_id where l.id = "competencies"."framework_level_id")`;
  }

  async list(q: CompetencyListQuery): Promise<Paginated<CompetencyDto>> {
    const where = allOf(
      searchFilter(q.q, [competencies.code, competencies.titleEn, competencies.titleAr]),
      q.status ? eq(competencies.status, q.status) : undefined,
      q.type ? eq(competencies.type, q.type) : undefined,
      q.frameworkLevelId ? eq(competencies.frameworkLevelId, q.frameworkLevelId) : undefined,
      q.occupationId ? inArray(competencies.id, this.db.select({ id: occupationCompetencies.competencyId }).from(occupationCompetencies).where(eq(occupationCompetencies.occupationId, q.occupationId))) : undefined,
    );
    const label = this.levelLabelFor(competencies.frameworkLevelId);
    const [rows, [{ total }]] = await Promise.all([
      this.db.select({ c: competencies, label }).from(competencies).where(where)
        .orderBy(orderBy(q.sort, q.order, { code: competencies.code, titleEn: competencies.titleEn, type: competencies.type, status: competencies.status, updatedAt: competencies.updatedAt }, competencies.code))
        .limit(q.pageSize).offset((q.page - 1) * q.pageSize),
      this.db.select({ total: countAll }).from(competencies).where(where),
    ]);
    return paginated(rows.map((r) => dto(r.c, { frameworkLevelLabel: r.label })), total, q.page, q.pageSize);
  }

  async get(id: string): Promise<CompetencyDto> {
    const [r] = await this.db.select({ c: competencies, label: this.levelLabelFor(competencies.frameworkLevelId) }).from(competencies).where(eq(competencies.id, id));
    if (!r) throw notFound('Competency');
    const [units, occupations] = await Promise.all([this.impact.unitsUsingCompetency(id), this.impact.occupationsUsingCompetency(id)]);
    return dto(r.c, { frameworkLevelLabel: r.label, units, occupations });
  }

  create(input: CompetencyInput, user: RequestUser) {
    return this.db.transaction(async (tx) => {
      const [r] = await tx.insert(competencies).values({ ...input, createdById: user.id, updatedById: user.id }).returning();
      await this.workflow.recordCreation('competency', r.id, user, tx);
      await this.audit.record(user, { action: 'competency.create', entityType: 'competency', entityId: r.id, changes: diff(null, r) }, tx);
      return dto(r);
    });
  }

  update(id: string, input: UpdateOf<CompetencyInput>, user: RequestUser) {
    return this.db.transaction(async (tx) => {
      const { rowVersion, ...data } = input;
      const before = await lockForUpdate<Row>(tx, competencies, id, rowVersion, 'Competency');
      assertEditable(before.status);
      const [after] = await tx.update(competencies).set({ ...defined(data), ...touch(competencies, user.id) }).where(eq(competencies.id, id)).returning();
      await this.audit.record(user, { action: 'competency.update', entityType: 'competency', entityId: id, changes: diff(before, after) }, tx);
      return dto(after);
    });
  }

  /** Units linked to a competency — kept here so callers never query link tables directly. */
  async unitIds(competencyId: string) {
    const rows = await this.db.select({ id: unitCompetencies.unitId }).from(unitCompetencies).where(eq(unitCompetencies.competencyId, competencyId));
    return rows.map((r) => r.id);
  }
}
