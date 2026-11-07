import { Controller, Delete, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  frameworkLevelSchema,
  frameworkSchema,
  listQuerySchema,
  PERMISSIONS,
  updateFrameworkLevelSchema,
  updateFrameworkSchema,
} from '@cdms/contracts';
import type { FrameworkInput, FrameworkLevelInput, ListQuery, UpdateOf } from '@cdms/contracts';
import { CurrentUser, RequirePermissions } from '../../common/auth.decorators';
import type { RequestUser } from '../../common/request-user';
import { IdParam, ZBody, ZQuery } from '../../common/zod';
import { FrameworksService } from './frameworks.service';

@ApiTags('frameworks')
@Controller('frameworks')
export class FrameworksController {
  constructor(private readonly svc: FrameworksService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CATALOG_READ)
  list(@ZQuery(listQuerySchema) q: ListQuery) {
    return this.svc.list(q);
  }

  @Get('levels')
  @RequirePermissions(PERMISSIONS.CATALOG_READ)
  levels() {
    return this.svc.allLevels();
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CATALOG_READ)
  get(@IdParam() id: string) {
    return this.svc.get(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CATALOG_WRITE)
  create(@ZBody(frameworkSchema) b: FrameworkInput, @CurrentUser() u: RequestUser) {
    return this.svc.create(b, u);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.CATALOG_WRITE)
  update(
    @IdParam() id: string,
    @ZBody(updateFrameworkSchema) b: UpdateOf<FrameworkInput>,
    @CurrentUser() u: RequestUser,
  ) {
    return this.svc.update(id, b, u);
  }

  @Post(':id/levels')
  @RequirePermissions(PERMISSIONS.CATALOG_WRITE)
  addLevel(
    @IdParam() id: string,
    @ZBody(frameworkLevelSchema) b: FrameworkLevelInput,
    @CurrentUser() u: RequestUser,
  ) {
    return this.svc.addLevel(id, b, u);
  }

  @Patch('levels/:id')
  @RequirePermissions(PERMISSIONS.CATALOG_WRITE)
  updateLevel(
    @IdParam() id: string,
    @ZBody(updateFrameworkLevelSchema) b: UpdateOf<FrameworkLevelInput>,
    @CurrentUser() u: RequestUser,
  ) {
    return this.svc.updateLevel(id, b, u);
  }

  @Delete('levels/:id')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.CATALOG_WRITE)
  removeLevel(@IdParam() id: string, @CurrentUser() u: RequestUser) {
    return this.svc.removeLevel(id, u);
  }
}
