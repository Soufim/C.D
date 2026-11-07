import { Inject, Injectable } from '@nestjs/common';
import Papa from 'papaparse';
import { asc, eq, inArray, sql } from 'drizzle-orm';
import {
  competencySchema,
  institutionSchema,
  occupationSchema,
  referenceItemSchema,
  unitSchema,
} from '@cdms/contracts';
import type { ImportableEntity, ImportRequest, ImportResult } from '@cdms/contracts';
import type { z } from 'zod';
import { DB, Database, Tx } from '../../database/database.module';
import {
  competencies,
  frameworkLevels,
  frameworks,
  institutions,
  occupationCompetencies,
  occupations,
  referenceItems,
  referenceLists,
  templates,
  unitCompetencies,
  units,
  learningOutcomes,
} from '../../database/schema';
import { AuditService } from '../audit/audit.service';
import type { RequestUser } from '../../common/request-user';
import { businessRule } from '../../common/errors';
import { COLUMNS, csvSafe } from './columns';

class DryRunRollback extends Error {}
const MAX_ROWS = 5000;

const blankToUndef = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === '' ? undefined : v]));
const num = (v: unknown) => (v === undefined || v === '' ? undefined : Number(v));
const bool = (v: unknown) =>
  v === undefined || v === ''
    ? undefined
    : ['1', 'true', 'yes', 'نعم'].includes(String(v).toLowerCase());

/**
 * Bulk import (CSV/JSON) with row-level validation and dry-run, and structured exports.
 * Imports always create DRAFT records; they then go through the normal review workflow.
 */
@Injectable()
export class ImportExportService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  parse(buffer: Buffer, format: 'csv' | 'json'): Record<string, unknown>[] {
    const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
    let rows: unknown;
    if (format === 'json') {
      try {
        rows = JSON.parse(text);
      } catch {
        throw businessRule('Invalid JSON file');
      }
      if (!Array.isArray(rows)) throw businessRule('JSON file must contain an array of records');
    } else {
      const res = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: 'greedy',
        transformHeader: (h) => h.trim(),
      });
      if (res.errors.length)
        throw businessRule(
          `CSV parse error on row ${(res.errors[0].row ?? 0) + 2}: ${res.errors[0].message}`,
        );
      rows = res.data;
    }
    const list = rows as Record<string, unknown>[];
    if (list.length > MAX_ROWS)
      throw businessRule(`A single import is limited to ${MAX_ROWS} rows`);
    return list;
  }

  async run(req: ImportRequest, buffer: Buffer, user: RequestUser): Promise<ImportResult> {
    const rows = this.parse(buffer, req.format);
    const result: ImportResult = {
      dryRun: req.dryRun,
      totalRows: rows.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };
    try {
      await this.db.transaction(async (tx) => {
        let listId: string | undefined;
        if (req.entity === 'reference_item') {
          if (!req.listCode) throw businessRule('listCode is required for reference items');
          const [l] = await tx
            .select()
            .from(referenceLists)
            .where(sql`lower(${referenceLists.code}) = lower(${req.listCode})`);
          if (!l) throw businessRule(`Reference list "${req.listCode}" not found`);
          listId = l.id;
        }
        const seen = new Set<string>();
        for (let i = 0; i < rows.length; i++) {
          const rowNo = i + 2; // header is row 1
          const raw = blankToUndef(rows[i]);
          const codeKey = String(raw.code ?? '').toLowerCase();
          if (codeKey && seen.has(codeKey)) {
            result.errors.push({ row: rowNo, field: 'code', message: 'Duplicate code in file' });
            continue;
          }
          seen.add(codeKey);
          try {
            const outcome = await this.importRow(tx, req, raw, user, listId);
            result[outcome]++;
          } catch (e) {
            if (e instanceof RowError)
              result.errors.push({ row: rowNo, field: e.field, message: e.message });
            else throw e;
          }
        }
        // All-or-nothing: any error, or a dry run, rolls the whole batch back.
        if (req.dryRun || result.errors.length) throw new DryRunRollback();
      });
    } catch (e) {
      if (!(e instanceof DryRunRollback)) throw e;
    }
    if (!req.dryRun) {
      await this.audit.record(user, {
        action: 'import.run',
        entityType: req.entity,
        outcome: result.errors.length ? 'failure' : 'success',
        metadata: {
          format: req.format,
          mode: req.mode,
          totalRows: result.totalRows,
          created: result.created,
          updated: result.updated,
          skipped: result.skipped,
          errorCount: result.errors.length,
        },
      });
    }
    if (result.errors.length && !req.dryRun) {
      result.created = 0;
      result.updated = 0;
    }
    return result;
  }

  private parseWith<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
    const r = schema.safeParse(data);
    if (!r.success) {
      const i = r.error.issues[0];
      throw new RowError(i.message, i.path.join('.'));
    }
    return r.data;
  }

  private async existing(
    tx: Tx,
    table: typeof occupations | typeof competencies | typeof units | typeof institutions,
    code: string,
  ) {
    const [r] = await tx
      .select()
      .from(table as typeof occupations)
      .where(sql`lower(${table.code}) = lower(${code})`);
    return r as (Record<string, unknown> & { id: string; status?: string }) | undefined;
  }

  private async importRow(
    tx: Tx,
    req: ImportRequest,
    raw: Record<string, unknown>,
    user: RequestUser,
    listId?: string,
  ): Promise<'created' | 'updated' | 'skipped'> {
    const meta = { createdById: user.id, updatedById: user.id };
    switch (req.entity) {
      case 'occupation': {
        let parentId: string | null = null;
        if (raw.parentCode) {
          const p = await this.existing(tx, occupations, String(raw.parentCode));
          if (!p)
            throw new RowError(
              `Parent code ${raw.parentCode} not found (list parents before children)`,
              'parentCode',
            );
          parentId = p.id;
        }
        const data = this.parseWith(occupationSchema, { ...raw, parentId });
        return this.upsert(tx, req, occupations, data, meta);
      }
      case 'competency':
        return this.upsert(tx, req, competencies, this.parseWith(competencySchema, raw), meta);
      case 'unit': {
        const { competencyCodes, ...rest } = raw;
        const data = this.parseWith(unitSchema, {
          ...rest,
          creditHours: num(raw.creditHours),
          theoryHours: num(raw.theoryHours),
          practicalHours: num(raw.practicalHours),
        });
        const { learningOutcomes: los, ...unitData } = data;
        const outcome = await this.upsert(tx, req, units, unitData, meta);
        const u = await this.existing(tx, units, data.code);
        if (u && outcome !== 'skipped') {
          if (los.length) {
            await tx.delete(learningOutcomes).where(eq(learningOutcomes.unitId, u.id));
            await tx.insert(learningOutcomes).values(
              los.map((l, i) => ({
                unitId: u.id,
                code: l.code,
                textEn: l.textEn,
                textAr: l.textAr,
                sortOrder: i,
              })),
            );
          }
          const codes = String(competencyCodes ?? '')
            .split(/[|;,]/)
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean);
          if (codes.length) {
            const found = await tx
              .select({ id: competencies.id, code: competencies.code })
              .from(competencies)
              .where(inArray(sql`lower(${competencies.code})`, codes));
            const missing = codes.filter((c) => !found.some((f) => f.code.toLowerCase() === c));
            if (missing.length)
              throw new RowError(
                `Unknown competency codes: ${missing.join(', ')}`,
                'competencyCodes',
              );
            await tx
              .insert(unitCompetencies)
              .values(found.map((f) => ({ unitId: u.id, competencyId: f.id })))
              .onConflictDoNothing();
          }
        }
        return outcome;
      }
      case 'institution':
        return this.upsert(
          tx,
          req,
          institutions,
          this.parseWith(institutionSchema, { ...raw, isActive: bool(raw.isActive) }),
          meta,
          false,
        );
      case 'reference_item': {
        const data = this.parseWith(referenceItemSchema, {
          ...raw,
          sortOrder: num(raw.sortOrder),
          isActive: bool(raw.isActive),
        });
        const [ex] = await tx
          .select()
          .from(referenceItems)
          .where(
            sql`${referenceItems.listId} = ${listId} and lower(${referenceItems.code}) = lower(${data.code})`,
          );
        if (ex) {
          if (req.mode === 'create') return 'skipped';
          await tx
            .update(referenceItems)
            .set({
              labelEn: data.labelEn,
              labelAr: data.labelAr,
              sortOrder: data.sortOrder,
              isActive: data.isActive,
              updatedById: user.id,
              updatedAt: new Date(),
              rowVersion: sql`${referenceItems.rowVersion} + 1`,
            })
            .where(eq(referenceItems.id, ex.id));
          return 'updated';
        }
        await tx.insert(referenceItems).values({ ...data, listId: listId!, ...meta });
        return 'created';
      }
    }
  }

  private async upsert(
    tx: Tx,
    req: ImportRequest,
    table: typeof occupations | typeof competencies | typeof units | typeof institutions,
    data: Record<string, unknown> & { code: string },
    meta: Record<string, string>,
    workflowControlled = true,
  ) {
    const ex = await this.existing(tx, table, data.code);
    if (ex) {
      if (req.mode === 'create') return 'skipped';
      if (workflowControlled && ex.status !== 'draft')
        throw new RowError(
          `Existing record is ${ex.status}; only drafts can be updated by import`,
          'code',
        );
      await tx
        .update(table as typeof occupations)
        .set({
          ...data,
          updatedById: meta.updatedById,
          updatedAt: new Date(),
          rowVersion: sql`row_version + 1`,
        } as never)
        .where(eq((table as typeof occupations).id, ex.id));
      return 'updated';
    }
    // Imported records are always drafts regardless of any status column in the file.
    const { status: _ignored, ...clean } = data as Record<string, unknown>;
    await tx.insert(table as typeof occupations).values({ ...clean, ...meta } as never);
    return 'created';
  }

  // ------------------------------------------------------------------ export
  async exportRows(
    entity: ImportableEntity,
    listCode?: string,
  ): Promise<Record<string, unknown>[]> {
    switch (entity) {
      case 'occupation': {
        const rows = await this.db.select().from(occupations).orderBy(asc(occupations.code));
        const byId = new Map(rows.map((r) => [r.id, r.code]));
        // Parents first so the export can be re-imported as-is.
        const order = ['major_group', 'sub_major_group', 'minor_group', 'unit_group', 'occupation'];
        return rows
          .sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level))
          .map((r) => ({ ...r, parentCode: r.parentId ? byId.get(r.parentId) : '' }));
      }
      case 'competency':
        return this.db.select().from(competencies).orderBy(asc(competencies.code));
      case 'unit': {
        const rows = await this.db.select().from(units).orderBy(asc(units.code));
        const links = await this.db
          .select({ unitId: unitCompetencies.unitId, code: competencies.code })
          .from(unitCompetencies)
          .innerJoin(competencies, eq(competencies.id, unitCompetencies.competencyId));
        return rows.map((r) => ({
          ...r,
          competencyCodes: links.filter((l) => l.unitId === r.id).map((l) => l.code),
        }));
      }
      case 'institution':
        return this.db.select().from(institutions).orderBy(asc(institutions.code));
      case 'reference_item': {
        if (!listCode) throw businessRule('listCode is required');
        return this.db
          .select({ i: referenceItems })
          .from(referenceItems)
          .innerJoin(referenceLists, eq(referenceLists.id, referenceItems.listId))
          .where(sql`lower(${referenceLists.code}) = lower(${listCode})`)
          .orderBy(asc(referenceItems.sortOrder))
          .then((r) => r.map((x) => x.i));
      }
    }
  }

  toCsv(entity: ImportableEntity, rows: Record<string, unknown>[]) {
    const cols = COLUMNS[entity];
    return (
      '﻿' + Papa.unparse({ fields: cols, data: rows.map((r) => cols.map((c) => csvSafe(r[c]))) })
    );
  }

  /** Full structured export of the standardisation catalogue (data portability). */
  async fullExport(user: RequestUser) {
    const [fw, lv, occ, oc, comp, un, lo, uc, tpl, rl, ri, inst] = await Promise.all([
      this.db.select().from(frameworks),
      this.db.select().from(frameworkLevels),
      this.db.select().from(occupations),
      this.db.select().from(occupationCompetencies),
      this.db.select().from(competencies),
      this.db.select().from(units),
      this.db.select().from(learningOutcomes),
      this.db.select().from(unitCompetencies),
      this.db.select().from(templates),
      this.db.select().from(referenceLists),
      this.db.select().from(referenceItems),
      this.db.select().from(institutions),
    ]);
    await this.audit.record(user, {
      action: 'export.full',
      metadata: { occupations: occ.length, competencies: comp.length, units: un.length },
    });
    return {
      format: 'cdms.catalog/v1',
      exportedAt: new Date().toISOString(),
      frameworks: fw,
      frameworkLevels: lv,
      occupations: occ,
      occupationCompetencies: oc,
      competencies: comp,
      units: un,
      learningOutcomes: lo,
      unitCompetencies: uc,
      templates: tpl,
      referenceLists: rl,
      referenceItems: ri,
      institutions: inst,
    };
  }
}

class RowError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
  }
}
