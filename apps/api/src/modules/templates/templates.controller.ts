import { Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  listQuerySchema,
  PERMISSIONS,
  TEMPLATE_KINDS,
  templateSchema,
  updateTemplateSchema,
} from '@cdms/contracts';
import type { TemplateInput, UpdateOf } from '@cdms/contracts';
import { CurrentUser, RequirePermissions } from '../../common/auth.decorators';
import type { RequestUser } from '../../common/request-user';
import { IdParam, ZBody, ZQuery } from '../../common/zod';
import { ImpactService } from '../catalog/impact.service';
import { TemplatesService } from './templates.service';

const templateListQuery = listQuerySchema.extend({ kind: z.enum(TEMPLATE_KINDS).optional() });

@ApiTags('templates')
@Controller('templates')
export class TemplatesController {
  constructor(
    private readonly svc: TemplatesService,
    private readonly impact: ImpactService,
  ) {}
  @Get() @RequirePermissions(PERMISSIONS.TEMPLATE_READ) list(
    @ZQuery(templateListQuery) q: z.infer<typeof templateListQuery>,
  ) {
    return this.svc.list(q);
  }
  @Get(':id') @RequirePermissions(PERMISSIONS.TEMPLATE_READ) get(@IdParam() id: string) {
    return this.svc.get(id);
  }
  @Get(':id/impact') @RequirePermissions(PERMISSIONS.TEMPLATE_READ) impactOf(
    @IdParam() id: string,
  ) {
    return this.impact.template(id);
  }
  @Post() @RequirePermissions(PERMISSIONS.TEMPLATE_WRITE) create(
    @ZBody(templateSchema) b: TemplateInput,
    @CurrentUser() u: RequestUser,
  ) {
    return this.svc.create(b, u);
  }
  @Patch(':id') @RequirePermissions(PERMISSIONS.TEMPLATE_WRITE) update(
    @IdParam() id: string,
    @ZBody(updateTemplateSchema) b: UpdateOf<TemplateInput>,
    @CurrentUser() u: RequestUser,
  ) {
    return this.svc.update(id, b, u);
  }
}
