import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { Paginated, UnitDto, UnitInput, UpdateOf, ValidationIssue } from '@cdms/contracts';
import { DB, Database, Tx } from '../../database/database.module';
import { competencies, learningOutcomes, unitCompetencies, units } from '../../database/schema';
import { AuditService } from '../audit/audit.service';
import { WorkflowService } from '../workflow/workflow.service';
import type { RequestUser } from '../../common/request-user';
import { assertEditable, lockForUpdate, touch } from '../../common/crud';
import {
  allOf,
  countAll,
  defined,
  diff,
  iso,
  orderBy,
  paginated,
  searchFilter,
} from '../../common/util';
import { businessRule, notFound } from '../../common/errors';
import { ImpactService, linkedCompetencyCols } from './impact.service';
import type { UnitListQuery } from './catalog.queries';

type Row = typeof units.$inferSelect;
const levelLabel = sql<
  string | null
>`(select f.code || ' L' || l.level from framework_levels l join frameworks f on f.id = l.framework_id where l.id = "units"."framework_level_id")`;

const dto = (r: Row, extra: Partial<UnitDto> = {}): UnitDto => ({
  id: r.id,
  code: r.code,
  titleEn: r.titleEn,
  titleAr: r.titleAr,
  descriptionEn: r.descriptionEn,
  descriptionAr: r.descriptionAr,
  frameworkLevelId: r.frameworkLevelId,
  creditHours: Number(r.creditHours),
  theoryHours: r.theoryHours,
  practicalHours: r.practicalHours,
  assessmentEn: r.assessmentEn,
  assessmentAr: r.assessmentAr,
  status: r.status,
  createdAt: iso(r.createdAt)!,
  updatedAt: iso(r.updatedAt)!,
  rowVersion: r.rowVersion,
  ...extra,
});

/** Curriculum units / modules: reusable across curricula, each with learning outcomes and competencies. */
@Injectable()
export class UnitsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
    private readonly workflow: WorkflowService,
    private readonly impact: ImpactService,
  ) {
    this.workflow.registerValidator('unit', ({ id, action, tx }) => this.validate(id, action, tx));
  }

  private async validate(id: string, action: string, tx: Tx): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    if (action === 'submit' || action === 'approve' || action === 'publish') {
      const [{ n }] = await tx
        .select({ n: countAll })
        .from(learningOutcomes)
        .where(eq(learningOutcomes.unitId, id));
      if (!n)
        issues.push({
          severity: 'error',
          code: 'learningOutcomes',
          messageEn: 'At least one learning outcome is required',
          messageAr: 'مطلوب ناتج تعلم واحد على الأقل',
        });
      const comps = await tx
        .select({ status: competencies.status, code: competencies.code })
        .from(unitCompetencies)
        .innerJoin(competencies, eq(competencies.id, unitCompetencies.competencyId))
        .where(eq(unitCompetencies.unitId, id));
      if (!comps.length)
        issues.push({
          severity: 'warning',
          code: 'competencies',
          messageEn: 'No competencies linked',
          messageAr: 'لا توجد جدارات مرتبطة',
        });
      const [u] = await tx.select().from(units).where(eq(units.id, id));
      if (u && u.theoryHours + u.practicalHours === 0)
        issues.push({
          severity: 'error',
          code: 'hours',
          messageEn: 'Nominal hours must be greater than zero',
          messageAr: 'يجب أن تكون الساعات أكبر من صفر',
        });
      if (action === 'publish') {
        const notReady = comps.filter((c) => c.status !== 'published');
        if (notReady.length)
          issues.push({
            severity: 'error',
            code: 'competencies',
            messageEn: `Linked competencies must be published first: ${notReady.map((c) => c.code).join(', ')}`,
            messageAr: `يجب نشر الجدارات المرتبطة أولاً: ${notReady.map((c) => c.code).join('، ')}`,
          });
      }
    }
    if (action === 'archive') {
      const r = await this.impact.unit(id, tx);
      if (r.publishedAffected)
        issues.push({
          severity: 'error',
          code: 'in_use',
          messageEn: `Used by ${r.publishedAffected} published curricul(a/um)`,
          messageAr: `مستخدمة في ${r.publishedAffected} منهج منشور`,
        });
    }
    return issues;
  }

  async list(q: UnitListQuery): Promise<Paginated<UnitDto>> {
    const where = allOf(
      searchFilter(q.q, [units.code, units.titleEn, units.titleAr]),
      q.status ? eq(units.status, q.status) : undefined,
      q.frameworkLevelId ? eq(units.frameworkLevelId, q.frameworkLevelId) : undefined,
      q.competencyId
        ? inArray(
            units.id,
            this.db
              .select({ id: unitCompetencies.unitId })
              .from(unitCompetencies)
              .where(eq(unitCompetencies.competencyId, q.competencyId)),
          )
        : undefined,
    );
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({ u: units, levelLabel })
        .from(units)
        .where(where)
        .orderBy(
          orderBy(
            q.sort,
            q.order,
            {
              code: units.code,
              titleEn: units.titleEn,
              status: units.status,
              creditHours: units.creditHours,
              updatedAt: units.updatedAt,
            },
            units.code,
          ),
        )
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      this.db.select({ total: countAll }).from(units).where(where),
    ]);
    return paginated(
      rows.map((r) => dto(r.u, { frameworkLevelLabel: r.levelLabel })),
      total,
      q.page,
      q.pageSize,
    );
  }

  async get(id: string): Promise<UnitDto> {
    const [r] = await this.db.select({ u: units, levelLabel }).from(units).where(eq(units.id, id));
    if (!r) throw notFound('Unit');
    const [los, comps, curricula] = await Promise.all([
      this.db
        .select()
        .from(learningOutcomes)
        .where(eq(learningOutcomes.unitId, id))
        .orderBy(asc(learningOutcomes.sortOrder)),
      this.db
        .select(linkedCompetencyCols)
        .from(unitCompetencies)
        .innerJoin(competencies, eq(competencies.id, unitCompetencies.competencyId))
        .where(eq(unitCompetencies.unitId, id))
        .orderBy(competencies.code),
      this.impact.curriculaUsingUnits([id]),
    ]);
    return dto(r.u, {
      frameworkLevelLabel: r.levelLabel,
      learningOutcomes: los.map((l) => ({
        id: l.id,
        code: l.code,
        textEn: l.textEn,
        textAr: l.textAr,
        sortOrder: l.sortOrder,
      })),
      competencies: comps,
      curricula,
    });
  }

  private async replaceOutcomes(tx: Tx, unitId: string, los: UnitInput['learningOutcomes']) {
    const codes = los.map((l) => l.code.toLowerCase());
    if (new Set(codes).size !== codes.length)
      throw businessRule('Learning outcome codes must be unique within a unit', [
        { path: 'learningOutcomes', message: 'Duplicate code' },
      ]);
    await tx.delete(learningOutcomes).where(eq(learningOutcomes.unitId, unitId));
    if (los.length) {
      await tx.insert(learningOutcomes).values(
        los.map((l, i) => ({
          unitId,
          code: l.code,
          textEn: l.textEn,
          textAr: l.textAr,
          sortOrder: i,
        })),
      );
    }
  }

  create(input: UnitInput, user: RequestUser) {
    return this.db.transaction(async (tx) => {
      const { learningOutcomes: los, ...data } = input;
      const [r] = await tx
        .insert(units)
        .values({ ...data, createdById: user.id, updatedById: user.id })
        .returning();
      await this.replaceOutcomes(tx, r.id, los);
      await this.workflow.recordCreation('unit', r.id, user, tx);
      await this.audit.record(
        user,
        {
          action: 'unit.create',
          entityType: 'unit',
          entityId: r.id,
          changes: diff(null, r),
          metadata: { learningOutcomes: los.length },
        },
        tx,
      );
      return dto(r);
    });
  }

  update(id: string, input: UpdateOf<UnitInput>, user: RequestUser) {
    return this.db.transaction(async (tx) => {
      const { rowVersion, learningOutcomes: los, ...data } = input;
      const before = await lockForUpdate<Row>(tx, units, id, rowVersion, 'Unit');
      assertEditable(before.status);
      const [after] = await tx
        .update(units)
        .set({ ...defined(data), ...touch(units, user.id) })
        .where(eq(units.id, id))
        .returning();
      let loChange: Record<string, { from: unknown; to: unknown }> = {};
      if (los) {
        const old = await tx
          .select({
            code: learningOutcomes.code,
            textEn: learningOutcomes.textEn,
            textAr: learningOutcomes.textAr,
          })
          .from(learningOutcomes)
          .where(eq(learningOutcomes.unitId, id))
          .orderBy(asc(learningOutcomes.sortOrder));
        await this.replaceOutcomes(tx, id, los);
        loChange = diff(
          { learningOutcomes: old },
          { learningOutcomes: los.map(({ code, textEn, textAr }) => ({ code, textEn, textAr })) },
        );
      }
      await this.audit.record(
        user,
        {
          action: 'unit.update',
          entityType: 'unit',
          entityId: id,
          changes: { ...diff(before, after), ...loChange },
        },
        tx,
      );
      return dto(after);
    });
  }

  linkCompetencies(id: string, competencyIds: string[], user: RequestUser) {
    return this.db.transaction(async (tx) => {
      const u = await lockForUpdate<Row>(tx, units, id, undefined, 'Unit');
      assertEditable(u.status);
      const found = await tx
        .select({ id: competencies.id, status: competencies.status })
        .from(competencies)
        .where(inArray(competencies.id, competencyIds));
      if (found.length !== new Set(competencyIds).size)
        throw businessRule('One or more competencies do not exist');
      if (found.some((c) => c.status === 'archived'))
        throw businessRule('Archived competencies cannot be linked');
      await tx
        .insert(unitCompetencies)
        .values(competencyIds.map((competencyId) => ({ unitId: id, competencyId })))
        .onConflictDoNothing();
      await tx.update(units).set(touch(units, user.id)).where(eq(units.id, id));
      await this.audit.record(
        user,
        {
          action: 'unit.link_competencies',
          entityType: 'unit',
          entityId: id,
          metadata: { competencyIds },
        },
        tx,
      );
    });
  }

  unlinkCompetency(id: string, competencyId: string, user: RequestUser) {
    return this.db.transaction(async (tx) => {
      const u = await lockForUpdate<Row>(tx, units, id, undefined, 'Unit');
      assertEditable(u.status);
      await tx
        .delete(unitCompetencies)
        .where(
          and(eq(unitCompetencies.unitId, id), eq(unitCompetencies.competencyId, competencyId)),
        );
      await tx.update(units).set(touch(units, user.id)).where(eq(units.id, id));
      await this.audit.record(
        user,
        {
          action: 'unit.unlink_competency',
          entityType: 'unit',
          entityId: id,
          metadata: { competencyId },
        },
        tx,
      );
    });
  }
}
