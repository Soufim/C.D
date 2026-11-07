import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { and, eq, isNull, lt, sql } from 'drizzle-orm';
import type {
  AuthResponse,
  ChangePasswordInput,
  LoginInput,
  SessionUser,
  UpdateProfileInput,
} from '@cdms/contracts';
import { ENV, Env } from '../../config/env';
import { DB, Database } from '../../database/database.module';
import { refreshTokens, users } from '../../database/schema';
import { AuditService } from '../audit/audit.service';
import type { RequestUser } from '../../common/request-user';
import { businessRule } from '../../common/errors';
import { PasswordService } from './password.service';
import { PermissionsLoader } from './permissions.loader';

export interface ClientInfo {
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
}

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
const GENERIC_LOGIN_ERROR = 'Invalid email or password';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    private readonly jwt: JwtService,
    private readonly passwords: PasswordService,
    private readonly loader: PermissionsLoader,
    private readonly audit: AuditService,
  ) {}

  async login(
    input: LoginInput,
    client: ClientInfo,
  ): Promise<{ auth: AuthResponse; refreshToken: string }> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${input.email}`)
      .limit(1);
    const actor = user
      ? { id: user.id, email: user.email, ...client }
      : { id: '', email: input.email, ...client };

    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      await this.audit.record(user ? actor : null, {
        action: 'auth.login',
        entityType: 'user',
        entityId: user.id,
        outcome: 'failure',
        metadata: { reason: 'locked', email: input.email },
      });
      throw new UnauthorizedException({
        title: 'Account temporarily locked',
        detail: 'Too many failed attempts. Try again later.',
      });
    }
    const ok = await this.passwords.verify(user?.passwordHash, input.password);
    if (!user || !ok || !user.isActive) {
      if (user) {
        const failed = user.failedLoginCount + 1;
        const lock = failed >= this.env.LOGIN_MAX_FAILED_ATTEMPTS;
        await this.db
          .update(users)
          .set({
            failedLoginCount: lock ? 0 : failed,
            lockedUntil: lock
              ? new Date(Date.now() + this.env.LOGIN_LOCKOUT_MINUTES * 60_000)
              : user.lockedUntil,
          })
          .where(eq(users.id, user.id));
      }
      await this.audit.record(user ? actor : null, {
        action: 'auth.login',
        entityType: 'user',
        entityId: user?.id ?? null,
        outcome: 'failure',
        metadata: {
          reason: !user ? 'unknown_user' : !user.isActive ? 'inactive' : 'bad_password',
          email: input.email,
        },
      });
      throw new UnauthorizedException({ title: GENERIC_LOGIN_ERROR });
    }

    await this.db
      .update(users)
      .set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() })
      .where(eq(users.id, user.id));
    // Housekeeping: drop expired refresh tokens for this user.
    await this.db
      .delete(refreshTokens)
      .where(and(eq(refreshTokens.userId, user.id), lt(refreshTokens.expiresAt, new Date())));

    const refreshToken = await this.issueRefreshToken(user.id, randomUUID(), client);
    await this.audit.record(actor, { action: 'auth.login', entityType: 'user', entityId: user.id });
    return { auth: await this.buildAuthResponse(user.id), refreshToken };
  }

  /**
   * Rotates the refresh token. Presenting an already-rotated token is treated as theft:
   * the whole token family is revoked (OWASP refresh-token reuse detection).
   */
  async refresh(raw: string | undefined, client: ClientInfo) {
    if (!raw) throw new UnauthorizedException({ title: 'No session' });
    const [token] = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, sha256(raw)))
      .limit(1);
    if (!token) throw new UnauthorizedException({ title: 'Invalid session' });
    if (token.revokedAt) {
      await this.db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.familyId, token.familyId), isNull(refreshTokens.revokedAt)));
      await this.audit.record(
        { id: token.userId, email: '', ...client },
        {
          action: 'auth.refresh_reuse_detected',
          entityType: 'user',
          entityId: token.userId,
          outcome: 'failure',
        },
      );
      throw new UnauthorizedException({ title: 'Session revoked' });
    }
    if (token.expiresAt < new Date()) throw new UnauthorizedException({ title: 'Session expired' });
    const principal = await this.loader.load(token.userId);
    if (!principal?.isActive) throw new UnauthorizedException({ title: 'Account disabled' });

    const next = await this.db.transaction(async (tx) => {
      const nextRaw = randomBytes(32).toString('base64url');
      const [row] = await tx
        .insert(refreshTokens)
        .values({
          userId: token.userId,
          tokenHash: sha256(nextRaw),
          familyId: token.familyId,
          expiresAt: token.expiresAt, // absolute session lifetime does not slide
          ip: client.ip,
          userAgent: client.userAgent?.slice(0, 400),
        })
        .returning({ id: refreshTokens.id });
      const updated = await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date(), replacedById: row.id })
        .where(and(eq(refreshTokens.id, token.id), isNull(refreshTokens.revokedAt)))
        .returning({ id: refreshTokens.id });
      if (!updated.length) throw new UnauthorizedException({ title: 'Session revoked' });
      return nextRaw;
    });
    return { auth: await this.buildAuthResponse(token.userId), refreshToken: next };
  }

  async logout(raw: string | undefined, actor: ClientInfo) {
    if (!raw) return;
    const [token] = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, sha256(raw)))
      .limit(1);
    if (!token) return;
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.familyId, token.familyId), isNull(refreshTokens.revokedAt)));
    await this.audit.record(
      { id: token.userId, email: '', ...actor },
      { action: 'auth.logout', entityType: 'user', entityId: token.userId },
    );
  }

  async me(userId: string): Promise<SessionUser> {
    const p = await this.loader.load(userId);
    if (!p) throw new UnauthorizedException();
    return {
      id: p.id,
      email: p.email,
      fullNameEn: p.fullNameEn,
      fullNameAr: p.fullNameAr,
      locale: p.locale,
      institutionId: p.institutionId,
      roles: p.roles,
      permissions: p.permissions,
    };
  }

  async changePassword(user: RequestUser, input: ChangePasswordInput) {
    const [row] = await this.db.select().from(users).where(eq(users.id, user.id)).limit(1);
    if (!(await this.passwords.verify(row?.passwordHash, input.currentPassword))) {
      await this.audit.record(user, {
        action: 'auth.password_change',
        entityType: 'user',
        entityId: user.id,
        outcome: 'failure',
      });
      throw businessRule('Current password is incorrect', [
        { path: 'currentPassword', message: 'Incorrect password' },
      ]);
    }
    if (input.newPassword.toLowerCase().includes(user.email.split('@')[0].toLowerCase())) {
      throw businessRule('Password must not contain your user name', [
        { path: 'newPassword', message: 'Contains user name' },
      ]);
    }
    const passwordHash = await this.passwords.hash(input.newPassword);
    await this.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ passwordHash, passwordChangedAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, user.id));
      // Changing the password ends every other session.
      await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.userId, user.id), isNull(refreshTokens.revokedAt)));
      await this.audit.record(
        user,
        { action: 'auth.password_change', entityType: 'user', entityId: user.id },
        tx,
      );
    });
  }

  async updateProfile(user: RequestUser, input: UpdateProfileInput): Promise<SessionUser> {
    await this.db
      .update(users)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    await this.audit.record(user, {
      action: 'user.profile_update',
      entityType: 'user',
      entityId: user.id,
      metadata: { fields: Object.keys(input) },
    });
    return this.me(user.id);
  }

  private async issueRefreshToken(userId: string, familyId: string, client: ClientInfo) {
    const raw = randomBytes(32).toString('base64url');
    await this.db.insert(refreshTokens).values({
      userId,
      tokenHash: sha256(raw),
      familyId,
      expiresAt: new Date(Date.now() + this.env.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
      ip: client.ip,
      userAgent: client.userAgent?.slice(0, 400),
    });
    return raw;
  }

  private async buildAuthResponse(userId: string): Promise<AuthResponse> {
    const user = await this.me(userId);
    const accessToken = await this.jwt.signAsync(
      { sub: userId },
      {
        expiresIn: this.env.ACCESS_TOKEN_TTL_SECONDS,
        audience: 'cdms-api',
        issuer: 'cdms',
        algorithm: 'HS256',
      },
    );
    return { accessToken, expiresIn: this.env.ACCESS_TOKEN_TTL_SECONDS, user };
  }
}
