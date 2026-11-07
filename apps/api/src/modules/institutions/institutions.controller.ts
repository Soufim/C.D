import { Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  institutionSchema,
  listQuerySchema,
  PERMISSIONS,
  updateInstitutionSchema,
} from '@cdms/contracts';
import type { InstitutionInput, ListQuery } from '@cdms/contracts';
import { CurrentUser, RequirePermissions } from '../../common/auth.decorators';
import type { RequestUser } from '../../common/request-user';
import { IdParam, ZBody, ZQuery } from '../../common/zod';
import { InstitutionsService } from './institutions.service';

@ApiTags('institutions')
@Controller('institutions')
export class InstitutionsController {
  constructor(private readonly svc: InstitutionsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.INSTITUTION_READ)
  list(@ZQuery(listQuerySchema) q: ListQuery) {
    return this.svc.list(q);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.INSTITUTION_READ)
  get(@IdParam() id: string) {
    return this.svc.get(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.INSTITUTION_WRITE)
  create(@ZBody(institutionSchema) body: InstitutionInput, @CurrentUser() u: RequestUser) {
    return this.svc.create(body, u);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.INSTITUTION_WRITE)
  update(
    @IdParam() id: string,
    @ZBody(updateInstitutionSchema) body: Partial<InstitutionInput> & { rowVersion: number },
    @CurrentUser() u: RequestUser,
  ) {
    return this.svc.update(id, body, u);
  }
}
