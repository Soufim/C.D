import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { Permission } from '@cdms/contracts';
import { AUTHENTICATED_ONLY, IS_PUBLIC, PERMISSIONS_KEY } from '../../common/auth.decorators';
import type { RequestUser } from '../../common/request-user';
import { forbidden } from '../../common/errors';
import { PermissionsLoader } from './permissions.loader';

/**
 * Global guard (registered as APP_GUARD). Fail-closed:
 *  - @Public() routes skip authentication.
 *  - Every other route requires a valid bearer access token for an active user.
 *  - Then it MUST declare @RequirePermissions(...) or @Authenticated(); routes declaring
 *    neither are rejected, so a forgotten decorator can never expose an endpoint.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly loader: PermissionsLoader,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: RequestUser; id?: string }>();
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException({ title: 'Authentication required' });

    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync(token, { algorithms: ['HS256'], audience: 'cdms-api', issuer: 'cdms' });
    } catch {
      throw new UnauthorizedException({ title: 'Invalid or expired token' });
    }
    const principal = await this.loader.load(payload.sub);
    if (!principal || !principal.isActive) throw new UnauthorizedException({ title: 'Account disabled' });

    req.user = {
      id: principal.id,
      email: principal.email,
      institutionId: principal.institutionId,
      permissions: new Set(principal.permissions),
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
      requestId: req.id ? String(req.id) : null,
    };

    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, targets);
    const authOnly = this.reflector.getAllAndOverride<boolean>(AUTHENTICATED_ONLY, targets);
    if (!required?.length) {
      if (authOnly) return true;
      throw forbidden('Route has no permission policy');
    }
    if (!required.every((p) => req.user!.permissions.has(p))) throw forbidden();
    return true;
  }
}
