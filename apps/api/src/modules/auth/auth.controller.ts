import { Controller, Get, HttpCode, Inject, Patch, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { changePasswordSchema, loginSchema, updateProfileSchema } from '@cdms/contracts';
import type { ChangePasswordInput, LoginInput, UpdateProfileInput } from '@cdms/contracts';
import { Authenticated, CurrentUser, Public } from '../../common/auth.decorators';
import type { RequestUser } from '../../common/request-user';
import { ZBody } from '../../common/zod';
import { ENV, Env } from '../../config/env';
import { AuthService, ClientInfo } from './auth.service';

export const REFRESH_COOKIE = 'cdms_rt';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.env.COOKIE_SECURE,
      sameSite: 'strict',
      path: '/api/v1/auth',
      maxAge: this.env.REFRESH_TOKEN_TTL_DAYS * 86_400_000,
    };
  }

  private client(req: Request & { id?: unknown }): ClientInfo {
    return { ip: req.ip ?? null, userAgent: req.headers['user-agent'] ?? null, requestId: req.id ? String(req.id) : null };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(@ZBody(loginSchema) body: LoginInput, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { auth, refreshToken } = await this.auth.login(body, this.client(req));
    res.cookie(REFRESH_COOKIE, refreshToken, this.cookieOptions());
    return auth;
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const { auth, refreshToken } = await this.auth.refresh(req.cookies?.[REFRESH_COOKIE], this.client(req));
      res.cookie(REFRESH_COOKIE, refreshToken, this.cookieOptions());
      return auth;
    } catch (e) {
      res.clearCookie(REFRESH_COOKIE, { ...this.cookieOptions(), maxAge: undefined });
      throw e;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE], this.client(req));
    res.clearCookie(REFRESH_COOKIE, { ...this.cookieOptions(), maxAge: undefined });
  }

  @Get('me')
  @Authenticated()
  me(@CurrentUser() user: RequestUser) {
    return this.auth.me(user.id);
  }

  @Patch('me')
  @Authenticated()
  updateProfile(@CurrentUser() user: RequestUser, @ZBody(updateProfileSchema) body: UpdateProfileInput) {
    return this.auth.updateProfile(user, body);
  }

  @Post('change-password')
  @HttpCode(204)
  @Authenticated()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  changePassword(@CurrentUser() user: RequestUser, @ZBody(changePasswordSchema) body: ChangePasswordInput) {
    return this.auth.changePassword(user, body);
  }
}
