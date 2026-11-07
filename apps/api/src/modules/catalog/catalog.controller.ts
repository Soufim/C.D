import { Controller, Delete, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  competencySchema, linkManySchema, occupationSchema, PERMISSIONS, unitSchema, updateCompetencySchema, updateOccupationSchema, updateUnitSchema,
} from '@cdms/contracts';
import type { CompetencyInput, OccupationInput, UnitInput, UpdateOf } from '@cdms/contracts';
import { CurrentUser, RequirePermissions } from '../../common/auth.decorators';
import type { RequestUser } from '../../common/request-user';
import { IdParam, ZBody, ZQuery } from '../../common/zod';
import { competencyListQuerySchema, occupationListQuerySchema, unitListQuerySchema } from './catalog.queries';
import type { CompetencyListQuery, OccupationListQuery, UnitListQuery } from './catalog.queries';
import { CompetenciesService } from './competencies.service';
import { ImpactService } from './impact.service';
import { OccupationsService } from './occupations.service';
import { UnitsService } from './units.service';

const R = PERMISSIONS.CATALOG_READ;
const W = PERMISSIONS.CATALOG_WRITE;

@ApiTags('occupations')
@Controller('occupations')
export class OccupationsController {
  constructor(private readonly svc: OccupationsService, private readonly impact: ImpactService) {}
  @Get() @RequirePermissions(R) list(@ZQuery(occupationListQuerySchema) q: OccupationListQuery) { return this.svc.list(q); }
  @Get(':id') @RequirePermissions(R) get(@IdParam() id: string) { return this.svc.get(id); }
  @Get(':id/ancestors') @RequirePermissions(R) ancestors(@IdParam() id: string) { return this.svc.ancestors(id); }
  @Get(':id/impact') @RequirePermissions(R) impactOf(@IdParam() id: string) { return this.impact.occupation(id); }
  @Post() @RequirePermissions(W) create(@ZBody(occupationSchema) b: OccupationInput, @CurrentUser() u: RequestUser) { return this.svc.create(b, u); }
  @Patch(':id') @RequirePermissions(W) update(@IdParam() id: string, @ZBody(updateOccupationSchema) b: UpdateOf<OccupationInput>, @CurrentUser() u: RequestUser) { return this.svc.update(id, b, u); }
  @Post(':id/competencies') @HttpCode(204) @RequirePermissions(W)
  link(@IdParam() id: string, @ZBody(linkManySchema) b: { targetIds: string[] }, @CurrentUser() u: RequestUser) { return this.svc.linkCompetencies(id, b.targetIds, u); }
  @Delete(':id/competencies/:competencyId') @HttpCode(204) @RequirePermissions(W)
  unlink(@IdParam() id: string, @IdParam('competencyId') cid: string, @CurrentUser() u: RequestUser) { return this.svc.unlinkCompetency(id, cid, u); }
}

@ApiTags('competencies')
@Controller('competencies')
export class CompetenciesController {
  constructor(private readonly svc: CompetenciesService, private readonly impact: ImpactService) {}
  @Get() @RequirePermissions(R) list(@ZQuery(competencyListQuerySchema) q: CompetencyListQuery) { return this.svc.list(q); }
  @Get(':id') @RequirePermissions(R) get(@IdParam() id: string) { return this.svc.get(id); }
  @Get(':id/impact') @RequirePermissions(R) impactOf(@IdParam() id: string) { return this.impact.competency(id); }
  @Post() @RequirePermissions(W) create(@ZBody(competencySchema) b: CompetencyInput, @CurrentUser() u: RequestUser) { return this.svc.create(b, u); }
  @Patch(':id') @RequirePermissions(W) update(@IdParam() id: string, @ZBody(updateCompetencySchema) b: UpdateOf<CompetencyInput>, @CurrentUser() u: RequestUser) { return this.svc.update(id, b, u); }
}

@ApiTags('units')
@Controller('units')
export class UnitsController {
  constructor(private readonly svc: UnitsService, private readonly impact: ImpactService) {}
  @Get() @RequirePermissions(R) list(@ZQuery(unitListQuerySchema) q: UnitListQuery) { return this.svc.list(q); }
  @Get(':id') @RequirePermissions(R) get(@IdParam() id: string) { return this.svc.get(id); }
  @Get(':id/impact') @RequirePermissions(R) impactOf(@IdParam() id: string) { return this.impact.unit(id); }
  @Post() @RequirePermissions(W) create(@ZBody(unitSchema) b: UnitInput, @CurrentUser() u: RequestUser) { return this.svc.create(b, u); }
  @Patch(':id') @RequirePermissions(W) update(@IdParam() id: string, @ZBody(updateUnitSchema) b: UpdateOf<UnitInput>, @CurrentUser() u: RequestUser) { return this.svc.update(id, b, u); }
  @Post(':id/competencies') @HttpCode(204) @RequirePermissions(W)
  link(@IdParam() id: string, @ZBody(linkManySchema) b: { targetIds: string[] }, @CurrentUser() u: RequestUser) { return this.svc.linkCompetencies(id, b.targetIds, u); }
  @Delete(':id/competencies/:competencyId') @HttpCode(204) @RequirePermissions(W)
  unlink(@IdParam() id: string, @IdParam('competencyId') cid: string, @CurrentUser() u: RequestUser) { return this.svc.unlinkCompetency(id, cid, u); }
}
