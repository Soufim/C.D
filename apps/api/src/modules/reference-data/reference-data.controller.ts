import { Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  listQuerySchema, PERMISSIONS, referenceItemSchema, referenceListSchema, updateReferenceItemSchema, updateReferenceListSchema,
} from '@cdms/contracts';
import type { ListQuery, ReferenceItemInput, ReferenceListInput, UpdateOf } from '@cdms/contracts';
import { CurrentUser, RequirePermissions } from '../../common/auth.decorators';
import type { RequestUser } from '../../common/request-user';
import { IdParam, ZBody, ZQuery } from '../../common/zod';
import { ReferenceDataService } from './reference-data.service';

@ApiTags('reference-data')
@Controller('reference-data')
export class ReferenceDataController {
  constructor(private readonly svc: ReferenceDataService) {}

  @Get('lists') @RequirePermissions(PERMISSIONS.REFERENCE_READ)
  lists(@ZQuery(listQuerySchema) q: ListQuery) { return this.svc.lists(q); }

  /** Accepts a list id or code (e.g. /lists/sector/items?active=1). */
  @Get('lists/:idOrCode') @RequirePermissions(PERMISSIONS.REFERENCE_READ)
  getList(@Param('idOrCode') idOrCode: string) { return this.svc.getList(idOrCode); }

  @Get('lists/:idOrCode/items') @RequirePermissions(PERMISSIONS.REFERENCE_READ)
  items(@Param('idOrCode') idOrCode: string, @Query('active') active?: string) { return this.svc.items(idOrCode, active === '1'); }

  @Post('lists') @RequirePermissions(PERMISSIONS.REFERENCE_WRITE)
  createList(@ZBody(referenceListSchema) b: ReferenceListInput, @CurrentUser() u: RequestUser) { return this.svc.createList(b, u); }

  @Patch('lists/:id') @RequirePermissions(PERMISSIONS.REFERENCE_WRITE)
  updateList(@IdParam() id: string, @ZBody(updateReferenceListSchema) b: UpdateOf<ReferenceListInput>, @CurrentUser() u: RequestUser) { return this.svc.updateList(id, b, u); }

  @Post('lists/:id/items') @RequirePermissions(PERMISSIONS.REFERENCE_WRITE)
  createItem(@IdParam() id: string, @ZBody(referenceItemSchema) b: ReferenceItemInput, @CurrentUser() u: RequestUser) { return this.svc.createItem(id, b, u); }

  @Patch('items/:id') @RequirePermissions(PERMISSIONS.REFERENCE_WRITE)
  updateItem(@IdParam() id: string, @ZBody(updateReferenceItemSchema) b: UpdateOf<ReferenceItemInput>, @CurrentUser() u: RequestUser) { return this.svc.updateItem(id, b, u); }
}
