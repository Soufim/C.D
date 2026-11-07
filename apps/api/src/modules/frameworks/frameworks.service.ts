import { Inject, Injectable } from '@nestjs/common';
import { asc, eq, sql } from 'drizzle-orm';
import type { FrameworkDto, FrameworkInput, FrameworkLevelDto, FrameworkLevelInput, ListQuery, Paginated, UpdateOf } from '@cdms/contracts';
import { DB, Database } from '../../database/database.module';
import { frameworkLevels, frameworks } from '../../database/schema';
import { AuditService } from '../audit/audit.service';
import { WorkflowService } from '../workflow/workflow.service';
import type { RequestUser } from '../../common/request-user';
import { assertEditable, lockForUpdate, touch } from '../../common/crud';
import { allOf, countAll, defined, diff, iso, orderBy, paginated, searchFilter } from '../../common/util';
import { businessRule, notFound } from '../../common/errors';

type Row = typeof frameworks.$inferSelect;
type LevelRow = typeof frameworkLevels.$inferSelect;

const dto = (r: Row): FrameworkDto => ({
  id: r.id, code: r.code, nameEn: r.nameEn, nameAr: r.nameAr, description: r.description, versionLabel: r.versionLabel,
  status: r.status, createdAt: iso(r.createdAt)!, updatedAt: iso(r.updatedAt)!, rowVersion: r.rowVersion,
});
const levelDto = (r: LevelRow): FrameworkLevelDto => ({
  id: r.id, frameworkId: r.frameworkId, level: r.level, nameEn: r.nameEn, nameAr: r.nameAr,
  knowledgeEn: r.knowledgeEn, knowledgeAr: r.knowledgeAr, skillsEn: r.skillsEn, skillsAr: r.skillsAr,
  autonomyEn: r.autonomyEn, autonomyAr: r.autonomyAr, createdAt: iso(r.createdAt)!, updatedAt: iso(r.updatedAt)!, rowVersion: r.rowVersion,
});

/** Qualification frameworks (e.g. the Egyptian NQF) and their level descriptors. */
@Injectable()
export class FrameworksService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
    private readonly workflow: WorkflowService,
  ) {
    this.workflow.registerValidator('framework', async ({ id, action, tx }) => {
      if (action !== 'submit' && action !== 'publish') return [];
      const [{ n }] = await tx.select({ n: countAll }).from(frameworkLevels).where(eq(frameworkLevels.frameworkId, id));
      return n > 0 ? [] : [{ severity: 'error', code: 'levels', messageEn: 'Add at least one level', messageAr: 'أضف مستوى واحدًا على الأقل' }];
    });
  }

  async list(q: ListQuery): Promise<Paginated<FrameworkDto>> {
    const where = allOf(searchFilter(q.q, [frameworks.code, frameworks.nameEn, frameworks.nameAr]), q.status ? eq(frameworks.status, q.status) : undefined);
    const [rows, [{ total }]] = await Promise.all([
      this.db.select().from(frameworks).where(where).orderBy(orderBy(q.sort, q.order, { code: frameworks.code, nameEn: frameworks.nameEn }, frameworks.code))
        .limit(q.pageSize).offset((q.page - 1) * q.pageSize),
      this.db.select({ total: countAll }).from(frameworks).where(where),
    ]);
    return paginated(rows.map(dto), total, q.page, q.pageSize);
  }

  async get(id: string): Promise<FrameworkDto> {
    const [r] = await this.db.select().from(frameworks).where(eq(frameworks.id, id));
    if (!r) throw notFound('Framework');
    const levels = await this.db.select().from(frameworkLevels).where(eq(frameworkLevels.frameworkId, id)).orderBy(asc(frameworkLevels.level));
    return { ...dto(r), levels: levels.map(levelDto) };
  }

  /** Flat list of all levels for pickers, labelled "<framework code> L<n> — name". */
  async allLevels() {
    const rows = await this.db
      .select({ id: frameworkLevels.id, level: frameworkLevels.level, nameEn: frameworkLevels.nameEn, nameAr: frameworkLevels.nameAr, fw: frameworks.code, status: frameworks.status })
      .from(frameworkLevels).innerJoin(frameworks, eq(frameworks.id, frameworkLevels.frameworkId))
      .where(sql`${frameworks.status} <> 'archived'`)
      .orderBy(asc(frameworks.code), asc(frameworkLevels.level));
    return rows.map((r) => ({ id: r.id, labelEn: `${r.fw} L${r.level} — ${r.nameEn}`, labelAr: `${r.fw} م${r.level} — ${r.nameAr}`, level: r.level }));
  }

  create(input: FrameworkInput, user: RequestUser) {
    return this.db.transaction(async (tx) => {
      const [r] = await tx.insert(frameworks).values({ ...input, createdById: user.id, updatedById: user.id }).returning();
      await this.workflow.recordCreation('framework', r.id, user, tx);
      await this.audit.record(user, { action: 'framework.create', entityType: 'framework', entityId: r.id, changes: diff(null, r) }, tx);
      return dto(r);
    });
  }

  update(id: string, input: UpdateOf<FrameworkInput>, user: RequestUser) {
    return this.db.transaction(async (tx) => {
      const { rowVersion, ...data } = input;
      const before = await lockForUpdate<Row>(tx, frameworks, id, rowVersion, 'Framework');
      assertEditable(before.status);
      const [after] = await tx.update(frameworks).set({ ...defined(data), ...touch(frameworks, user.id) }).where(eq(frameworks.id, id)).returning();
      await this.audit.record(user, { action: 'framework.update', entityType: 'framework', entityId: id, changes: diff(before, after) }, tx);
      return dto(after);
    });
  }

  addLevel(frameworkId: string, input: FrameworkLevelInput, user: RequestUser) {
    return this.db.transaction(async (tx) => {
      const fw = await lockForUpdate<Row>(tx, frameworks, frameworkId, undefined, 'Framework');
      assertEditable(fw.status);
      const [r] = await tx.insert(frameworkLevels).values({ ...input, frameworkId, createdById: user.id, updatedById: user.id }).returning();
      await this.audit.record(user, { action: 'framework.level_add', entityType: 'framework', entityId: frameworkId, changes: diff(null, r) }, tx);
      return levelDto(r);
    });
  }

  updateLevel(levelId: string, input: UpdateOf<FrameworkLevelInput>, user: RequestUser) {
    return this.db.transaction(async (tx) => {
      const { rowVersion, ...data } = input;
      const before = await lockForUpdate<LevelRow>(tx, frameworkLevels, levelId, rowVersion, 'Framework level');
      const fw = await lockForUpdate<Row>(tx, frameworks, before.frameworkId, undefined, 'Framework');
      assertEditable(fw.status);
      const [after] = await tx.update(frameworkLevels).set({ ...defined(data), ...touch(frameworkLevels, user.id) }).where(eq(frameworkLevels.id, levelId)).returning();
      await this.audit.record(user, { action: 'framework.level_update', entityType: 'framework', entityId: fw.id, changes: diff(before, after) }, tx);
      return levelDto(after);
    });
  }

  removeLevel(levelId: string, user: RequestUser) {
    return this.db.transaction(async (tx) => {
      const before = await lockForUpdate<LevelRow>(tx, frameworkLevels, levelId, undefined, 'Framework level');
      const fw = await lockForUpdate<Row>(tx, frameworks, before.frameworkId, undefined, 'Framework');
      assertEditable(fw.status);
      try {
        await tx.delete(frameworkLevels).where(eq(frameworkLevels.id, levelId));
      } catch (e) {
        if ((e as { cause?: { code?: string } }).cause?.code === '23503') throw businessRule('This level is used by competencies, units or curricula and cannot be removed.');
        throw e;
      }
      await this.audit.record(user, { action: 'framework.level_remove', entityType: 'framework', entityId: fw.id, changes: diff(before, null) }, tx);
    });
  }
}
