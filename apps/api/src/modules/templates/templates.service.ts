import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { ListQuery, Paginated, TemplateDto, TemplateInput, UpdateOf } from '@cdms/contracts';
import { DB, Database } from '../../database/database.module';
import { templates } from '../../database/schema';
import { AuditService } from '../audit/audit.service';
import { WorkflowService } from '../workflow/workflow.service';
import { ImpactService } from '../catalog/impact.service';
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
import { notFound } from '../../common/errors';

type Row = typeof templates.$inferSelect;
const usage = sql<number>`(select count(*)::int from curricula c where c.template_id = "templates"."id")`;

export const templateDto = (r: Row, usageCount?: number): TemplateDto => ({
  id: r.id,
  code: r.code,
  nameEn: r.nameEn,
  nameAr: r.nameAr,
  descriptionEn: r.descriptionEn,
  descriptionAr: r.descriptionAr,
  kind: r.kind,
  sections: r.sections,
  status: r.status,
  usageCount,
  createdAt: iso(r.createdAt)!,
  updatedAt: iso(r.updatedAt)!,
  rowVersion: r.rowVersion,
});

/** Structured templates define the sections a curriculum document must contain. */
@Injectable()
export class TemplatesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
    private readonly workflow: WorkflowService,
    private readonly impact: ImpactService,
  ) {
    this.workflow.registerValidator('template', async ({ id, action, tx }) => {
      if (action === 'submit') {
        const [t] = await tx
          .select({ sections: templates.sections })
          .from(templates)
          .where(eq(templates.id, id));
        if (!t?.sections.length)
          return [
            {
              severity: 'error',
              code: 'sections',
              messageEn: 'Add at least one section',
              messageAr: 'أضف قسمًا واحدًا على الأقل',
            },
          ];
      }
      if (action === 'archive') {
        const r = await this.impact.template(id, tx);
        if (r.totalAffected)
          return [
            {
              severity: 'warning',
              code: 'in_use',
              messageEn: `Used by ${r.totalAffected} curricula; they keep their content`,
              messageAr: `مستخدم في ${r.totalAffected} منهج`,
            },
          ];
      }
      return [];
    });
  }

  async list(q: ListQuery & { kind?: Row['kind'] }): Promise<Paginated<TemplateDto>> {
    const where = allOf(
      searchFilter(q.q, [templates.code, templates.nameEn, templates.nameAr]),
      q.status ? eq(templates.status, q.status) : undefined,
      q.kind ? eq(templates.kind, q.kind) : undefined,
    );
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({ t: templates, usage })
        .from(templates)
        .where(where)
        .orderBy(
          orderBy(
            q.sort,
            q.order,
            {
              code: templates.code,
              nameEn: templates.nameEn,
              status: templates.status,
              updatedAt: templates.updatedAt,
            },
            templates.code,
          ),
        )
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      this.db.select({ total: countAll }).from(templates).where(where),
    ]);
    return paginated(
      rows.map((r) => templateDto(r.t, r.usage)),
      total,
      q.page,
      q.pageSize,
    );
  }

  async get(id: string) {
    const [r] = await this.db
      .select({ t: templates, usage })
      .from(templates)
      .where(eq(templates.id, id));
    if (!r) throw notFound('Template');
    return templateDto(r.t, r.usage);
  }

  create(input: TemplateInput, user: RequestUser) {
    return this.db.transaction(async (tx) => {
      const [r] = await tx
        .insert(templates)
        .values({ ...input, createdById: user.id, updatedById: user.id })
        .returning();
      await this.workflow.recordCreation('template', r.id, user, tx);
      await this.audit.record(
        user,
        {
          action: 'template.create',
          entityType: 'template',
          entityId: r.id,
          changes: diff(null, r),
        },
        tx,
      );
      return templateDto(r);
    });
  }

  update(id: string, input: UpdateOf<TemplateInput>, user: RequestUser) {
    return this.db.transaction(async (tx) => {
      const { rowVersion, ...data } = input;
      const before = await lockForUpdate<Row>(tx, templates, id, rowVersion, 'Template');
      assertEditable(before.status);
      const [after] = await tx
        .update(templates)
        .set({ ...defined(data), ...touch(templates, user.id) })
        .where(eq(templates.id, id))
        .returning();
      await this.audit.record(
        user,
        {
          action: 'template.update',
          entityType: 'template',
          entityId: id,
          changes: diff(before, after),
        },
        tx,
      );
      return templateDto(after);
    });
  }
}
