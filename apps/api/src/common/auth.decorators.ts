import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Permission } from '@cdms/contracts';
import type { RequestUser } from './request-user';

export const IS_PUBLIC = 'isPublic';
export const PERMISSIONS_KEY = 'permissions';

/** Marks a route as not requiring authentication. Use sparingly (login, health). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Requires ALL listed permissions. Every non-public route MUST declare at least one. */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/** Routes that only need an authenticated session (e.g. own profile). */
export const AUTHENTICATED_ONLY = 'authenticatedOnly';
export const Authenticated = () => SetMetadata(AUTHENTICATED_ONLY, true);

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): RequestUser => ctx.switchToHttp().getRequest().user,
);
