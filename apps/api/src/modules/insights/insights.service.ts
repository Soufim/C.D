import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, or, sql } from 'drizzle-orm';
import { PERMISSIONS, RECORD_STATUSES } from '@cdms/contracts';
import type { DashboardStats, RecordStatus, SearchHit } from '@cdms/contracts';
import { DB, Database } from '../../database/database.module';
import {
  auditLogs,
  competencies,
  curricula,
  institutions,
  occupations,
  templates,
  units,
  users,
} from '../../database/schema';
import type { RequestUser } from '../../common/request-user';
import { can } from '../../common/request-user';
import { countAll, iso, likePattern } from '../../common/util';
import { WorkflowService } from '../workflow/workflow.service';

/** Read-only aggregations: dashboard, global search and reports. */
@Injectable()
export class InsightsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly workflow: WorkflowService,
  ) {}

  private curriculumScope(user: RequestUser) {
    if (can(user, PERMISSIONS.CURRICULUM_ALL_INSTITUTIONS)) return undefined;
    return user.institutionId
      ? or(eq(curricula.status, 'published'), eq(curricula.institutionId, user.institutionId))
      : eq(curricula.status, 'published');
  }

  async dashboard(user: RequestUser): Promise<DashboardStats> {
    const scope = this.curriculumScope(user);
    const [byStatus, c1, c2, c3, c4, c5, mine, queue] = await Promise.all([
      this.db
        .select({ status: curricula.status, n: countAll })
        .from(curricula)
        .where(scope)
        .groupBy(curricula.status),
      this.db.select({ n: countAll }).from(units),
      this.db.select({ n: countAll }).from(competencies),
      this.db.select({ n: countAll }).from(occupations),
      this.db.select({ n: countAll }).from(templates),
      this.db.select({ n: countAll }).from(institutions),
      this.db
        .select({ n: countAll })
        .from(curricula)
        .where(and(eq(curricula.createdById, user.id), eq(curricula.status, 'draft'))),
      this.workflow.reviewQueue(user),
    ]);
    const curriculaByStatus = Object.fromEntries(RECORD_STATUSES.map((s) => [s, 0])) as Record<
      RecordStatus,
      number
    >;
    byStatus.forEach((r) => (curriculaByStatus[r.status] = r.n));
    const activity = can(user, PERMISSIONS.AUDIT_READ)
      ? await this.db
          .select({
            id: auditLogs.id,
            action: auditLogs.action,
            entityType: auditLogs.entityType,
            entityId: auditLogs.entityId,
            occurredAt: auditLogs.occurredAt,
            actorName: users.fullNameEn,
          })
          .from(auditLogs)
          .leftJoin(users, eq(users.id, auditLogs.actorId))
          .where(
            and(
              eq(auditLogs.outcome, 'success'),
              sql`${auditLogs.action} not like 'auth.%'`,
              sql`${auditLogs.action} not like 'file.download'`,
            ),
          )
          .orderBy(desc(auditLogs.occurredAt))
          .limit(10)
      : await this.db
          .select({
            id: auditLogs.id,
            action: auditLogs.action,
            entityType: auditLogs.entityType,
            entityId: auditLogs.entityId,
            occurredAt: auditLogs.occurredAt,
            actorName: users.fullNameEn,
          })
          .from(auditLogs)
          .leftJoin(users, eq(users.id, auditLogs.actorId))
          .where(and(eq(auditLogs.actorId, user.id), sql`${auditLogs.action} not like 'auth.%'`))
          .orderBy(desc(auditLogs.occurredAt))
          .limit(10);
    return {
      counts: {
        curricula: Object.values(curriculaByStatus).reduce((a, b) => a + b, 0),
        units: c1[0].n,
        competencies: c2[0].n,
        occupations: c3[0].n,
        templates: c4[0].n,
        institutions: c5[0].n,
      },
      curriculaByStatus,
      pendingReviews: queue.length,
      myDrafts: mine[0].n,
      recentActivity: activity.map((a) => ({
        id: a.id.toString(),
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        actorName: a.actorName,
        occurredAt: iso(a.occurredAt)!,
      })),
    };
  }

  /** Cross-entity search on code and both languages, limited to what the user may read. */
  async search(q: string, user: RequestUser): Promise<SearchHit[]> {
    const term = q.trim();
    if (term.length < 2) return [];
    const p = likePattern(term);
    const hits: SearchHit[] = [];
    const sources: {
      type: SearchHit['entityType'];
      perm: string;
      t: typeof units | typeof competencies | typeof occupations;
    }[] = [
      { type: 'unit', perm: PERMISSIONS.CATALOG_READ, t: units },
      { type: 'competency', perm: PERMISSIONS.CATALOG_READ, t: competencies },
      { type: 'occupation', perm: PERMISSIONS.CATALOG_READ, t: occupations },
    ];
    if (user.permissions.has(PERMISSIONS.CURRICULUM_READ)) {
      const rows = await this.db
        .select({
          id: curricula.id,
          code: curricula.code,
          titleEn: curricula.titleEn,
          titleAr: curricula.titleAr,
          status: curricula.status,
        })
        .from(curricula)
        .where(
          and(
            this.curriculumScope(user),
            or(
              sql`${curricula.code} ilike ${p}`,
              sql`${curricula.titleEn} ilike ${p}`,
              sql`${curricula.titleAr} ilike ${p}`,
            ),
          ),
        )
        .limit(8);
      hits.push(...rows.map((r) => ({ entityType: 'curriculum' as const, ...r })));
    }
    for (const s of sources) {
      if (!user.permissions.has(s.perm as never)) continue;
      const t = s.t as typeof units;
      const rows = await this.db
        .select({
          id: t.id,
          code: t.code,
          titleEn: t.titleEn,
          titleAr: t.titleAr,
          status: t.status,
        })
        .from(t)
        .where(
          or(sql`${t.code} ilike ${p}`, sql`${t.titleEn} ilike ${p}`, sql`${t.titleAr} ilike ${p}`),
        )
        .limit(8);
      hits.push(...rows.map((r) => ({ entityType: s.type, ...r })));
    }
    if (user.permissions.has(PERMISSIONS.TEMPLATE_READ)) {
      const rows = await this.db
        .select({
          id: templates.id,
          code: templates.code,
          titleEn: templates.nameEn,
          titleAr: templates.nameAr,
          status: templates.status,
        })
        .from(templates)
        .where(
          or(
            sql`${templates.code} ilike ${p}`,
            sql`${templates.nameEn} ilike ${p}`,
            sql`${templates.nameAr} ilike ${p}`,
          ),
        )
        .limit(5);
      hits.push(...rows.map((r) => ({ entityType: 'template' as const, ...r })));
    }
    return hits;
  }

  /** Standardisation report: competencies not used by any unit, units not used by any curriculum, coverage per occupation. */
  async standardisationReport() {
    const [orphanCompetencies, orphanUnits, occupationsWithoutProfile] = await Promise.all([
      this.db
        .execute(sql`select c.id, c.code, c.title_en as "titleEn", c.title_ar as "titleAr", c.status from competencies c
        where c.status <> 'archived' and not exists (select 1 from unit_competencies uc where uc.competency_id = c.id) order by c.code limit 200`),
      this.db
        .execute(sql`select u.id, u.code, u.title_en as "titleEn", u.title_ar as "titleAr", u.status from units u
        where u.status <> 'archived' and not exists (select 1 from curriculum_units cu where cu.unit_id = u.id) order by u.code limit 200`),
      this.db
        .execute(sql`select o.id, o.code, o.title_en as "titleEn", o.title_ar as "titleAr", o.status from occupations o
        where o.level = 'occupation' and o.status <> 'archived' and not exists (select 1 from occupation_competencies oc where oc.occupation_id = o.id) order by o.code limit 200`),
    ]);
    const statusMatrix = await this.db.execute(sql`
      select 'curriculum' as entity, status, count(*)::int as n from curricula group by status
      union all select 'unit', status, count(*)::int from units group by status
      union all select 'competency', status, count(*)::int from competencies group by status
      union all select 'occupation', status, count(*)::int from occupations group by status
      union all select 'template', status, count(*)::int from templates group by status`);
    return {
      orphanCompetencies: orphanCompetencies.rows,
      orphanUnits: orphanUnits.rows,
      occupationsWithoutProfile: occupationsWithoutProfile.rows,
      statusMatrix: statusMatrix.rows,
    };
  }
}
