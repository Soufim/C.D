import { Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  createUserSchema,
  listQuerySchema,
  PERMISSIONS,
  resetPasswordSchema,
  roleSchema,
  updateRoleSchema,
  updateUserSchema,
} from '@cdms/contracts';
import type {
  CreateUserInput,
  ListQuery,
  RoleInput,
  UpdateOf,
  UpdateUserInput,
} from '@cdms/contracts';
import { CurrentUser, RequirePermissions } from '../../common/auth.decorators';
import type { RequestUser } from '../../common/request-user';
import { IdParam, ZBody, ZQuery } from '../../common/zod';
import { UsersService } from './users.service';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly svc: UsersService) {}

  @Get('users') @RequirePermissions(PERMISSIONS.USER_READ) list(
    @ZQuery(listQuerySchema) q: ListQuery,
  ) {
    return this.svc.list(q);
  }
  @Get('users/:id') @RequirePermissions(PERMISSIONS.USER_READ) get(@IdParam() id: string) {
    return this.svc.get(id);
  }
  @Post('users') @RequirePermissions(PERMISSIONS.USER_WRITE) create(
    @ZBody(createUserSchema) b: CreateUserInput,
    @CurrentUser() u: RequestUser,
  ) {
    return this.svc.create(b, u);
  }
  @Patch('users/:id') @RequirePermissions(PERMISSIONS.USER_WRITE) update(
    @IdParam() id: string,
    @ZBody(updateUserSchema) b: UpdateUserInput,
    @CurrentUser() u: RequestUser,
  ) {
    return this.svc.update(id, b, u);
  }
  @Post('users/:id/reset-password')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.USER_WRITE)
  reset(
    @IdParam() id: string,
    @ZBody(resetPasswordSchema) b: { newPassword: string },
    @CurrentUser() u: RequestUser,
  ) {
    return this.svc.resetPassword(id, b.newPassword, u);
  }

  @Get('roles') @RequirePermissions(PERMISSIONS.USER_READ) roles() {
    return this.svc.roles();
  }
  @Get('permissions') @RequirePermissions(PERMISSIONS.USER_READ) permissions() {
    return this.svc.permissionCatalog();
  }
  @Post('roles') @RequirePermissions(PERMISSIONS.ROLE_WRITE) createRole(
    @ZBody(roleSchema) b: RoleInput,
    @CurrentUser() u: RequestUser,
  ) {
    return this.svc.createRole(b, u);
  }
  @Patch('roles/:id') @RequirePermissions(PERMISSIONS.ROLE_WRITE) updateRole(
    @IdParam() id: string,
    @ZBody(updateRoleSchema) b: UpdateOf<RoleInput>,
    @CurrentUser() u: RequestUser,
  ) {
    return this.svc.updateRole(id, b, u);
  }
}
