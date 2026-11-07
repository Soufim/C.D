import { Controller, Delete, Get, HttpCode, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { curriculumSchema, PERMISSIONS, setCurriculumUnitsSchema, updateCurriculumSchema } from '@cdms/contracts';
import type { CurriculumInput, SetCurriculumUnitsInput, UpdateOf } from '@cdms/contracts';
import { CurrentUser, RequirePermissions } from '../../common/auth.decorators';
import type { RequestUser } from '../../common/request-user';
import { IdParam, ZBody, ZQuery } from '../../common/zod';
import { curriculumListQuerySchema } from './curricula.queries';
import type { CurriculumListQuery } from './curricula.queries';
import { CurriculaService } from './curricula.service';

const R = PERMISSIONS.CURRICULUM_READ;
const W = PERMISSIONS.CURRICULUM_WRITE;
const newVersionSchema = z.object({ reason: z.string().trim().max(2000).optional() });

@ApiTags('curricula')
@Controller('curricula')
export class CurriculaController {
  constructor(private readonly svc: CurriculaService) {}

  @Get() @RequirePermissions(R) list(@ZQuery(curriculumListQuerySchema) q: CurriculumListQuery, @CurrentUser() u: RequestUser) { return this.svc.list(q, u); }
  @Get(':id') @RequirePermissions(R) get(@IdParam() id: string, @CurrentUser() u: RequestUser) { return this.svc.get(id, u); }
  @Get(':id/versions') @RequirePermissions(R) versions(@IdParam() id: string, @CurrentUser() u: RequestUser) { return this.svc.versions(id, u); }
  @Get(':id/coverage') @RequirePermissions(R) coverage(@IdParam() id: string, @CurrentUser() u: RequestUser) { return this.svc.coverage(id, u); }
  @Get(':id/validation') @RequirePermissions(R)
  async validation(@IdParam() id: string, @CurrentUser() u: RequestUser) { await this.svc.get(id, u); return this.svc.validate(id, undefined, true); }
  @Get(':id/export') @RequirePermissions(R, PERMISSIONS.EXPORT_RUN) export(@IdParam() id: string, @CurrentUser() u: RequestUser) { return this.svc.exportDocument(id, u); }

  @Post() @RequirePermissions(W) create(@ZBody(curriculumSchema) b: CurriculumInput, @CurrentUser() u: RequestUser) { return this.svc.create(b, u); }
  @Patch(':id') @RequirePermissions(W) update(@IdParam() id: string, @ZBody(updateCurriculumSchema) b: UpdateOf<CurriculumInput>, @CurrentUser() u: RequestUser) { return this.svc.update(id, b, u); }
  @Put(':id/units') @RequirePermissions(W) setUnits(@IdParam() id: string, @ZBody(setCurriculumUnitsSchema) b: SetCurriculumUnitsInput, @CurrentUser() u: RequestUser) { return this.svc.setUnits(id, b, u); }
  @Post(':id/new-version') @RequirePermissions(W) newVersion(@IdParam() id: string, @ZBody(newVersionSchema) b: z.infer<typeof newVersionSchema>, @CurrentUser() u: RequestUser) { return this.svc.newVersion(id, u, b.reason); }
  @Delete(':id') @HttpCode(204) @RequirePermissions(W) remove(@IdParam() id: string, @CurrentUser() u: RequestUser) { return this.svc.remove(id, u); }
}
