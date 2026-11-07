import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, ne } from 'drizzle-orm';
import type { ImpactReport, LinkedRef } from '@cdms/contracts';
import { DB, Database, DbOrTx } from '../../database/database.module';
import {
  competencies,
  curricula,
  curriculumUnits,
  occupationCompetencies,
  occupations,
  templates,
  unitCompetencies,
  units,
} from '../../database/schema';

/**
 * Impact analysis for shared standardisation records. Used (1) by the UI before a change and
 * (2) by workflow validators to block changes that would break published records.
 */
@Injectable()
export class ImpactService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async curriculaUsingUnits(unitIds: string[], tx: DbOrTx = this.db): Promise<LinkedRef[]> {
    if (!unitIds.length) return [];
    return tx
      .selectDistinct({
        id: curricula.id,
        code: curricula.code,
        titleEn: curricula.titleEn,
        titleAr: curricula.titleAr,
        status: curricula.status,
      })
      .from(curriculumUnits)
      .innerJoin(curricula, eq(curricula.id, curriculumUnits.curriculumId))
      .where(and(inArray(curriculumUnits.unitId, unitIds), ne(curricula.status, 'archived')));
  }

  async unitsUsingCompetency(competencyId: string, tx: DbOrTx = this.db): Promise<LinkedRef[]> {
    return tx
      .select({
        id: units.id,
        code: units.code,
        titleEn: units.titleEn,
        titleAr: units.titleAr,
        status: units.status,
      })
      .from(unitCompetencies)
      .innerJoin(units, eq(units.id, unitCompetencies.unitId))
      .where(and(eq(unitCompetencies.competencyId, competencyId), ne(units.status, 'archived')));
  }

  async occupationsUsingCompetency(
    competencyId: string,
    tx: DbOrTx = this.db,
  ): Promise<LinkedRef[]> {
    return tx
      .select({
        id: occupations.id,
        code: occupations.code,
        titleEn: occupations.titleEn,
        titleAr: occupations.titleAr,
        status: occupations.status,
      })
      .from(occupationCompetencies)
      .innerJoin(occupations, eq(occupations.id, occupationCompetencies.occupationId))
      .where(
        and(
          eq(occupationCompetencies.competencyId, competencyId),
          ne(occupations.status, 'archived'),
        ),
      );
  }

  async competency(id: string, tx: DbOrTx = this.db): Promise<ImpactReport> {
    const [us, os] = await Promise.all([
      this.unitsUsingCompetency(id, tx),
      this.occupationsUsingCompetency(id, tx),
    ]);
    const cs = await this.curriculaUsingUnits(
      us.map((u) => u.id),
      tx,
    );
    return this.report('competency', id, [
      { entityType: 'unit', items: us },
      { entityType: 'occupation', items: os },
      { entityType: 'curriculum', items: cs },
    ]);
  }

  async unit(id: string, tx: DbOrTx = this.db): Promise<ImpactReport> {
    return this.report('unit', id, [
      { entityType: 'curriculum', items: await this.curriculaUsingUnits([id], tx) },
    ]);
  }

  async occupation(id: string, tx: DbOrTx = this.db): Promise<ImpactReport> {
    const [cs, children] = await Promise.all([
      tx
        .select({
          id: curricula.id,
          code: curricula.code,
          titleEn: curricula.titleEn,
          titleAr: curricula.titleAr,
          status: curricula.status,
        })
        .from(curricula)
        .where(and(eq(curricula.occupationId, id), ne(curricula.status, 'archived'))),
      tx
        .select({
          id: occupations.id,
          code: occupations.code,
          titleEn: occupations.titleEn,
          titleAr: occupations.titleAr,
          status: occupations.status,
        })
        .from(occupations)
        .where(and(eq(occupations.parentId, id), ne(occupations.status, 'archived'))),
    ]);
    return this.report('occupation', id, [
      { entityType: 'curriculum', items: cs },
      { entityType: 'occupation', items: children },
    ]);
  }

  async template(id: string, tx: DbOrTx = this.db): Promise<ImpactReport> {
    const cs = await tx
      .select({
        id: curricula.id,
        code: curricula.code,
        titleEn: curricula.titleEn,
        titleAr: curricula.titleAr,
        status: curricula.status,
      })
      .from(curricula)
      .where(and(eq(curricula.templateId, id), ne(curricula.status, 'archived')));
    return this.report('template', id, [{ entityType: 'curriculum', items: cs }]);
  }

  private report(
    entityType: string,
    entityId: string,
    affected: ImpactReport['affected'],
  ): ImpactReport {
    const all = affected.flatMap((a) => a.items);
    return {
      entityType,
      entityId,
      affected,
      totalAffected: all.length,
      publishedAffected: all.filter((i) => i.status === 'published').length,
    };
  }
}

export const linkedCompetencyCols = {
  id: competencies.id,
  code: competencies.code,
  titleEn: competencies.titleEn,
  titleAr: competencies.titleAr,
  status: competencies.status,
};
export const linkedTemplateCols = {
  id: templates.id,
  code: templates.code,
  titleEn: templates.nameEn,
  titleAr: templates.nameAr,
  status: templates.status,
};
