import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, ne, or, sql, SQL } from 'drizzle-orm';
import { PERMISSIONS } from '@cdms/contracts';
import type {
  CoverageReport,
  CurriculumDto,
  CurriculumInput,
  CurriculumUnitDto,
  LinkedRef,
  Paginated,
  SetCurriculumUnitsInput,
  UpdateOf,
  ValidationIssue,
} from '@cdms/contracts';
import { DB, Database, DbOrTx, Tx } from '../../database/database.module';
import {
  competencies,
  curricula,
  curriculumUnits,
  institutions,
  occupationCompetencies,
  occupations,
  templates,
  unitCompetencies,
  units,
} from '../../database/schema';
import { AuditService } from '../audit/audit.service';
import { WorkflowService } from '../workflow/workflow.service';
import type { RequestUser } from '../../common/request-user';
import { can } from '../../common/request-user';
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
import { businessRule, forbidden, notFound } from '../../common/errors';
import type { CurriculumListQuery } from './curricula.queries';

type Row = typeof curricula.$inferSelect;
const levelLabel = sql<
  string | null
>`(select f.code || ' L' || l.level from framework_levels l join frameworks f on f.id = l.framework_id where l.id = "curricula"."framework_level_id")`;

const dto = (r: Row, extra: Partial<CurriculumDto> = {}): CurriculumDto => ({
  id: r.id,
  code: r.code,
  titleEn: r.titleEn,
  titleAr: r.titleAr,
  summaryEn: r.summaryEn,
  summaryAr: r.summaryAr,
  occupationId: r.occupationId,
  frameworkLevelId: r.frameworkLevelId,
  institutionId: r.institutionId,
  templateId: r.templateId,
  programTypeCode: r.programTypeCode,
  durationMonths: r.durationMonths,
  effectiveFrom: r.effectiveFrom,
  sections: r.sections,
  status: r.status,
  version: r.version,
  previousVersionId: r.previousVersionId,
  createdById: r.createdById,
  createdAt: iso(r.createdAt)!,
  updatedAt: iso(r.updatedAt)!,
  rowVersion: r.rowVersion,
  ...extra,
});

/**
 * Curricula: compose units into programmes against an occupation, framework level and template.
 *
 * Access policy (enforced here, not in the UI):
 *  - Users with curriculum.all_institutions act on every curriculum.
 *  - Other users see published curricula plus their own institution's; they modify only their institution's.
 */
@Injectable()
export class CurriculaService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
    private readonly workflow: WorkflowService,
  ) {
    this.workflow.registerValidator('curriculum', async ({ id, action, user, tx }) => {
      const [row] = await tx.select().from(curricula).where(eq(curricula.id, id));
      this.assertAccess(row, user, 'write');
      if (['submit', 'approve', 'publish'].includes(action))
        return this.validate(id, tx, action === 'publish');
      return [];
    });
    // Publishing a new version supersedes (archives) the previously published version of the same code.
    this.workflow.registerAfterHook('curriculum', async ({ id, action, user, tx }) => {
      if (action !== 'publish') return;
      const [row] = await tx
        .select({ code: curricula.code })
        .from(curricula)
        .where(eq(curricula.id, id));
      const superseded = await tx
        .update(curricula)
        .set({ status: 'archived', ...touch(curricula, user.id) })
        .where(
          and(
            sql`lower(${curricula.code}) = lower(${row.code})`,
            ne(curricula.id, id),
            eq(curricula.status, 'published'),
          ),
        )
        .returning({ id: curricula.id });
      for (const s of superseded) {
        await this.audit.record(
          user,
          {
            action: 'curriculum.superseded',
            entityType: 'curriculum',
            entityId: s.id,
            metadata: { supersededBy: id },
          },
          tx,
        );
      }
    });
  }

  // ------------------------------------------------------------------ access
  private scope(user: RequestUser): SQL | undefined {
    if (can(user, PERMISSIONS.CURRICULUM_ALL_INSTITUTIONS)) return undefined;
    return user.institutionId
      ? or(eq(curricula.status, 'published'), eq(curricula.institutionId, user.institutionId))
      : eq(curricula.status, 'published');
  }

  private assertAccess(
    row: Row | undefined,
    user: RequestUser,
    mode: 'read' | 'write',
  ): asserts row is Row {
    if (!row) throw notFound('Curriculum');
    if (can(user, PERMISSIONS.CURRICULUM_ALL_INSTITUTIONS)) return;
    const own = !!user.institutionId && row.institutionId === user.institutionId;
    if (mode === 'read' && (own || row.status === 'published')) return;
    if (mode === 'write' && own) return;
    // Do not reveal existence of records outside the user's scope.
    if (mode === 'read') throw notFound('Curriculum');
    throw forbidden('You can only modify curricula of your institution');
  }

  // ------------------------------------------------------------------ queries
  async list(q: CurriculumListQuery, user: RequestUser): Promise<Paginated<CurriculumDto>> {
    const where = allOf(
      this.scope(user),
      searchFilter(q.q, [curricula.code, curricula.titleEn, curricula.titleAr]),
      q.status ? eq(curricula.status, q.status) : undefined,
      q.occupationId ? eq(curricula.occupationId, q.occupationId) : undefined,
      q.institutionId ? eq(curricula.institutionId, q.institutionId) : undefined,
      q.mine ? eq(curricula.createdById, user.id) : undefined,
      q.allVersions
        ? undefined
        : sql`not exists (select 1 from curricula newer where lower(newer.code) = lower(${curricula.code}) and newer.version > ${curricula.version})`,
    );
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          c: curricula,
          levelLabel,
          instEn: institutions.nameEn,
          instAr: institutions.nameAr,
        })
        .from(curricula)
        .leftJoin(institutions, eq(institutions.id, curricula.institutionId))
        .where(where)
        .orderBy(
          orderBy(
            q.sort,
            q.order,
            {
              code: curricula.code,
              titleEn: curricula.titleEn,
              status: curricula.status,
              updatedAt: curricula.updatedAt,
              version: curricula.version,
            },
            curricula.updatedAt,
          ),
        )
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      this.db.select({ total: countAll }).from(curricula).where(where),
    ]);
    return paginated(
      rows.map((r) =>
        dto(r.c, {
          frameworkLevelLabel: r.levelLabel,
          institutionNameEn: r.instEn,
          institutionNameAr: r.instAr,
        }),
      ),
      total,
      q.page,
      q.pageSize,
    );
  }

  async get(id: string, user: RequestUser): Promise<CurriculumDto> {
    const [r] = await this.db
      .select({
        c: curricula,
        levelLabel,
        instEn: institutions.nameEn,
        instAr: institutions.nameAr,
        occ: {
          id: occupations.id,
          code: occupations.code,
          titleEn: occupations.titleEn,
          titleAr: occupations.titleAr,
          status: occupations.status,
        },
      })
      .from(curricula)
      .leftJoin(institutions, eq(institutions.id, curricula.institutionId))
      .leftJoin(occupations, eq(occupations.id, curricula.occupationId))
      .where(eq(curricula.id, id));
    this.assertAccess(r?.c, user, 'read');
    const us = await this.loadUnits(id);
    return dto(r.c, {
      frameworkLevelLabel: r.levelLabel,
      institutionNameEn: r.instEn,
      institutionNameAr: r.instAr,
      occupation: r.occ?.id ? (r.occ as LinkedRef) : null,
      units: us,
      totals: {
        units: us.length,
        creditHours: us.reduce((a, u) => a + u.creditHours, 0),
        theoryHours: us.reduce((a, u) => a + u.theoryHours, 0),
        practicalHours: us.reduce((a, u) => a + u.practicalHours, 0),
      },
    });
  }

  async versions(id: string, user: RequestUser) {
    const [r] = await this.db.select().from(curricula).where(eq(curricula.id, id));
    this.assertAccess(r, user, 'read');
    const rows = await this.db
      .select({
        id: curricula.id,
        version: curricula.version,
        status: curricula.status,
        updatedAt: curricula.updatedAt,
      })
      .from(curricula)
      .where(sql`lower(${curricula.code}) = lower(${r.code})`)
      .orderBy(asc(curricula.version));
    return rows.map((v) => ({ ...v, updatedAt: iso(v.updatedAt) }));
  }

  private async loadUnits(id: string, tx: DbOrTx = this.db): Promise<CurriculumUnitDto[]> {
    const rows = await tx
      .select({ cu: curriculumUnits, u: units })
      .from(curriculumUnits)
      .innerJoin(units, eq(units.id, curriculumUnits.unitId))
      .where(eq(curriculumUnits.curriculumId, id))
      .orderBy(asc(curriculumUnits.term), asc(curriculumUnits.sortOrder));
    return rows.map(({ cu, u }) => ({
      unitId: u.id,
      code: u.code,
      titleEn: u.titleEn,
      titleAr: u.titleAr,
      status: u.status,
      term: cu.term,
      sortOrder: cu.sortOrder,
      isMandatory: cu.isMandatory,
      creditHours: Number(u.creditHours),
      theoryHours: u.theoryHours,
      practicalHours: u.practicalHours,
    }));
  }

  /** Which of the occupation's required competencies are covered by the curriculum's units. */
  async coverage(id: string, user: RequestUser, tx: DbOrTx = this.db): Promise<CoverageReport> {
    const [row] = await tx.select().from(curricula).where(eq(curricula.id, id));
    this.assertAccess(row, user, 'read');
    const required = row.occupationId
      ? await tx
          .select({
            id: competencies.id,
            code: competencies.code,
            titleEn: competencies.titleEn,
            titleAr: competencies.titleAr,
            status: competencies.status,
          })
          .from(occupationCompetencies)
          .innerJoin(competencies, eq(competencies.id, occupationCompetencies.competencyId))
          .where(eq(occupationCompetencies.occupationId, row.occupationId))
          .orderBy(competencies.code)
      : [];
    const covered = await tx
      .select({
        competencyId: unitCompetencies.competencyId,
        unit: {
          id: units.id,
          code: units.code,
          titleEn: units.titleEn,
          titleAr: units.titleAr,
          status: units.status,
        },
        c: {
          id: competencies.id,
          code: competencies.code,
          titleEn: competencies.titleEn,
          titleAr: competencies.titleAr,
          status: competencies.status,
        },
      })
      .from(curriculumUnits)
      .innerJoin(unitCompetencies, eq(unitCompetencies.unitId, curriculumUnits.unitId))
      .innerJoin(units, eq(units.id, curriculumUnits.unitId))
      .innerJoin(competencies, eq(competencies.id, unitCompetencies.competencyId))
      .where(eq(curriculumUnits.curriculumId, id));
    const requiredIds = new Set(required.map((r) => r.id));
    const req = required.map((c) => ({
      ...c,
      coveredBy: covered.filter((x) => x.competencyId === c.id).map((x) => x.unit),
    }));
    const additional = [
      ...new Map(
        covered.filter((x) => !requiredIds.has(x.competencyId)).map((x) => [x.c.id, x.c]),
      ).values(),
    ];
    const coveredCount = req.filter((r) => r.coveredBy.length).length;
    return {
      required: req,
      additional,
      coveragePercent: req.length ? Math.round((coveredCount / req.length) * 100) : 100,
    };
  }

  /** Readiness checks used before submit/approve/publish. */
  async validate(id: string, tx: DbOrTx = this.db, forPublish = false): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    const [row] = await tx.select().from(curricula).where(eq(curricula.id, id));
    if (!row) throw notFound('Curriculum');
    const us = await this.loadUnits(id, tx);
    if (!us.length)
      issues.push({
        severity: 'error',
        code: 'units',
        messageEn: 'Add at least one unit',
        messageAr: 'أضف وحدة واحدة على الأقل',
      });
    if (!row.occupationId)
      issues.push({
        severity: 'warning',
        code: 'occupationId',
        messageEn: 'No target occupation selected',
        messageAr: 'لم يتم تحديد المهنة المستهدفة',
      });
    if (!row.frameworkLevelId)
      issues.push({
        severity: 'warning',
        code: 'frameworkLevelId',
        messageEn: 'No qualification level selected',
        messageAr: 'لم يتم تحديد مستوى التأهيل',
      });
    if (row.templateId) {
      const [t] = await tx
        .select({ sections: templates.sections, status: templates.status })
        .from(templates)
        .where(eq(templates.id, row.templateId));
      for (const s of t?.sections ?? []) {
        const v = row.sections[s.key];
        if (s.required && !v?.en?.trim() && !v?.ar?.trim()) {
          issues.push({
            severity: 'error',
            code: `sections.${s.key}`,
            messageEn: `Required section is empty: ${s.titleEn}`,
            messageAr: `قسم مطلوب فارغ: ${s.titleAr}`,
          });
        } else if (s.required && (!v?.en?.trim() || !v?.ar?.trim())) {
          issues.push({
            severity: 'warning',
            code: `sections.${s.key}`,
            messageEn: `Section is missing one language: ${s.titleEn}`,
            messageAr: `القسم ينقصه إحدى اللغتين: ${s.titleAr}`,
          });
        }
      }
      if (forPublish && t?.status !== 'published')
        issues.push({
          severity: 'error',
          code: 'templateId',
          messageEn: 'Template must be published',
          messageAr: 'يجب نشر القالب',
        });
    } else {
      issues.push({
        severity: 'warning',
        code: 'templateId',
        messageEn: 'No template selected',
        messageAr: 'لم يتم اختيار قالب',
      });
    }
    if (forPublish) {
      const notPublished = us.filter((u) => u.status !== 'published');
      if (notPublished.length)
        issues.push({
          severity: 'error',
          code: 'units',
          messageEn: `All units must be published first: ${notPublished.map((u) => u.code).join(', ')}`,
          messageAr: `يجب نشر جميع الوحدات أولاً: ${notPublished.map((u) => u.code).join('، ')}`,
        });
      if (row.occupationId) {
        const [o] = await tx
          .select({ status: occupations.status })
          .from(occupations)
          .where(eq(occupations.id, row.occupationId));
        if (o?.status !== 'published')
          issues.push({
            severity: 'error',
            code: 'occupationId',
            messageEn: 'Target occupation must be published',
            messageAr: 'يجب نشر المهنة المستهدفة',
          });
      }
    }
    return issues;
  }

  // ------------------------------------------------------------------ commands
  create(input: CurriculumInput, user: RequestUser) {
    return this.db.transaction(async (tx) => {
      const institutionId = can(user, PERMISSIONS.CURRICULUM_ALL_INSTITUTIONS)
        ? (input.institutionId ?? user.institutionId)
        : user.institutionId;
      const [{ n }] = await tx
        .select({ n: countAll })
        .from(curricula)
        .where(sql`lower(${curricula.code}) = lower(${input.code})`);
      if (n)
        throw businessRule('A curriculum with this code already exists', [
          { path: 'code', message: 'Already in use' },
        ]);
      const [r] = await tx
        .insert(curricula)
        .values({ ...input, institutionId, createdById: user.id, updatedById: user.id })
        .returning();
      await this.workflow.recordCreation('curriculum', r.id, user, tx);
      await this.audit.record(
        user,
        {
          action: 'curriculum.create',
          entityType: 'curriculum',
          entityId: r.id,
          changes: diff(null, r),
        },
        tx,
      );
      return dto(r);
    });
  }

  update(id: string, input: UpdateOf<CurriculumInput>, user: RequestUser) {
    return this.db.transaction(async (tx) => {
      const { rowVersion, code, ...data } = input;
      const before = await lockForUpdate<Row>(tx, curricula, id, rowVersion, 'Curriculum');
      this.assertAccess(before, user, 'write');
      assertEditable(before.status);
      if (code && code.toLowerCase() !== before.code.toLowerCase() && before.version > 1)
        throw businessRule('The code of a versioned curriculum cannot change');
      if (!can(user, PERMISSIONS.CURRICULUM_ALL_INSTITUTIONS)) delete data.institutionId;
      const [after] = await tx
        .update(curricula)
        .set({ ...defined({ ...data, code }), ...touch(curricula, user.id) })
        .where(eq(curricula.id, id))
        .returning();
      await this.audit.record(
        user,
        {
          action: 'curriculum.update',
          entityType: 'curriculum',
          entityId: id,
          changes: diff(before, after),
        },
        tx,
      );
      return dto(after);
    });
  }

  setUnits(id: string, input: SetCurriculumUnitsInput, user: RequestUser) {
    return this.db.transaction(async (tx) => {
      const before = await lockForUpdate<Row>(tx, curricula, id, input.rowVersion, 'Curriculum');
      this.assertAccess(before, user, 'write');
      assertEditable(before.status);
      const ids = input.units.map((u) => u.unitId);
      if (new Set(ids).size !== ids.length)
        throw businessRule('A unit can only appear once in a curriculum');
      if (ids.length) {
        const found = await tx
          .select({ id: units.id, status: units.status })
          .from(units)
          .where(inArray(units.id, ids));
        if (found.length !== ids.length) throw businessRule('One or more units do not exist');
        if (found.some((u) => u.status === 'archived'))
          throw businessRule('Archived units cannot be added');
      }
      const old = await this.loadUnits(id, tx);
      await tx.delete(curriculumUnits).where(eq(curriculumUnits.curriculumId, id));
      if (ids.length) {
        await tx.insert(curriculumUnits).values(
          input.units.map((u, i) => ({
            curriculumId: id,
            unitId: u.unitId,
            term: u.term,
            isMandatory: u.isMandatory,
            sortOrder: i,
          })),
        );
      }
      const [after] = await tx
        .update(curricula)
        .set(touch(curricula, user.id))
        .where(eq(curricula.id, id))
        .returning();
      await this.audit.record(
        user,
        {
          action: 'curriculum.set_units',
          entityType: 'curriculum',
          entityId: id,
          changes: diff(
            { units: old.map((u) => `${u.code}@T${u.term}`) },
            { units: input.units.map((u) => `${u.unitId}@T${u.term}`) },
          ),
        },
        tx,
      );
      return { rowVersion: after.rowVersion, units: await this.loadUnits(id, tx) };
    });
  }

  /** Creates a new draft version from a published/approved/archived curriculum. */
  newVersion(id: string, user: RequestUser, reason?: string) {
    return this.db.transaction(async (tx: Tx) => {
      const src = await lockForUpdate<Row>(tx, curricula, id, undefined, 'Curriculum');
      this.assertAccess(src, user, 'write');
      if (src.status === 'draft' || src.status === 'in_review')
        throw businessRule('This curriculum is still being edited; no new version is needed');
      const [{ max }] = await tx
        .select({ max: sql<number>`max(${curricula.version})::int` })
        .from(curricula)
        .where(sql`lower(${curricula.code}) = lower(${src.code})`);
      const [{ open }] = await tx
        .select({ open: countAll })
        .from(curricula)
        .where(
          and(
            sql`lower(${curricula.code}) = lower(${src.code})`,
            inArray(curricula.status, ['draft', 'in_review']),
          ),
        );
      if (open) throw businessRule('A newer draft version already exists');
      const {
        id: _id,
        createdAt: _c,
        updatedAt: _u,
        rowVersion: _r,
        status: _s,
        version: _v,
        previousVersionId: _p,
        ...copy
      } = src;
      const [r] = await tx
        .insert(curricula)
        .values({
          ...copy,
          version: max + 1,
          previousVersionId: src.id,
          status: 'draft',
          createdById: user.id,
          updatedById: user.id,
        })
        .returning();
      const us = await tx
        .select()
        .from(curriculumUnits)
        .where(eq(curriculumUnits.curriculumId, src.id));
      if (us.length)
        await tx.insert(curriculumUnits).values(us.map((u) => ({ ...u, curriculumId: r.id })));
      await this.workflow.recordCreation('curriculum', r.id, user, tx, 'new_version', reason);
      await this.audit.record(
        user,
        {
          action: 'curriculum.new_version',
          entityType: 'curriculum',
          entityId: r.id,
          metadata: { from: src.id, version: r.version, reason },
        },
        tx,
      );
      return dto(r);
    });
  }

  remove(id: string, user: RequestUser) {
    return this.db.transaction(async (tx) => {
      const row = await lockForUpdate<Row>(tx, curricula, id, undefined, 'Curriculum');
      this.assertAccess(row, user, 'write');
      if (row.status !== 'draft')
        throw businessRule('Only drafts can be deleted. Archive published curricula instead.');
      const [{ n }] = await tx
        .select({ n: countAll })
        .from(curricula)
        .where(eq(curricula.previousVersionId, id));
      if (n) throw businessRule('This version has successors and cannot be deleted');
      await tx.delete(curricula).where(eq(curricula.id, id));
      await this.audit.record(
        user,
        {
          action: 'curriculum.delete',
          entityType: 'curriculum',
          entityId: id,
          changes: diff(row, null),
        },
        tx,
      );
    });
  }

  /** Portable, self-contained JSON document of a curriculum (for archiving and exchange). */
  async exportDocument(id: string, user: RequestUser) {
    const c = await this.get(id, user);
    const coverage = await this.coverage(id, user);
    const unitDetails = c.units?.length
      ? await this.db
          .select()
          .from(units)
          .where(
            inArray(
              units.id,
              c.units.map((u) => u.unitId),
            ),
          )
      : [];
    await this.audit.record(user, {
      action: 'curriculum.export',
      entityType: 'curriculum',
      entityId: id,
    });
    return {
      format: 'cdms.curriculum/v1',
      exportedAt: new Date().toISOString(),
      curriculum: c,
      units: unitDetails,
      coverage,
    };
  }
}
