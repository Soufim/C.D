import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, eq, inArray, isNull, sql } from 'drizzle-orm';
import { ALL_PERMISSIONS } from '@cdms/contracts';
import type { CreateUserInput, ListQuery, Paginated, RoleDto, RoleInput, UpdateUserInput, UserDto } from '@cdms/contracts';
import { DB, Database, Tx } from '../../database/database.module';
import { institutions, refreshTokens, roles, userRoles, users } from '../../database/schema';
import { AuditService } from '../audit/audit.service';
import { PasswordService } from '../auth/password.service';
import type { RequestUser } from '../../common/request-user';
import { lockForUpdate } from '../../common/crud';
import { allOf, countAll, defined, diff, iso, orderBy, paginated, searchFilter } from '../../common/util';
import { businessRule, notFound } from '../../common/errors';

type UserRow = typeof users.$inferSelect;
type RoleRow = typeof roles.$inferSelect;

/** User and role administration. Self-lockout and privilege-escalation safeguards live here. */
@Injectable()
export class UsersService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
    private readonly passwords: PasswordService,
  ) {}

  private async rolesFor(userIds: string[]) {
    if (!userIds.length) return new Map<string, UserDto['roles']>();
    const rows = await this.db.select({ userId: userRoles.userId, id: roles.id, code: roles.code, nameEn: roles.nameEn, nameAr: roles.nameAr })
      .from(userRoles).innerJoin(roles, eq(roles.id, userRoles.roleId)).where(inArray(userRoles.userId, userIds));
    const m = new Map<string, UserDto['roles']>();
    rows.forEach(({ userId, ...r }) => m.set(userId, [...(m.get(userId) ?? []), r]));
    return m;
  }

  private dto(u: UserRow, rolesList: UserDto['roles'], instName?: string | null): UserDto {
    return {
      id: u.id, email: u.email, fullNameEn: u.fullNameEn, fullNameAr: u.fullNameAr, locale: u.locale, institutionId: u.institutionId,
      institutionNameEn: instName ?? null, isActive: u.isActive, lastLoginAt: iso(u.lastLoginAt), roles: rolesList,
      createdAt: iso(u.createdAt)!, updatedAt: iso(u.updatedAt)!, rowVersion: u.rowVersion,
    };
  }

  async list(q: ListQuery): Promise<Paginated<UserDto>> {
    const where = allOf(searchFilter(q.q, [users.email, users.fullNameEn, users.fullNameAr]));
    const [rows, [{ total }]] = await Promise.all([
      this.db.select({ u: users, inst: institutions.nameEn }).from(users).leftJoin(institutions, eq(institutions.id, users.institutionId)).where(where)
        .orderBy(orderBy(q.sort, q.order, { email: users.email, fullNameEn: users.fullNameEn, lastLoginAt: users.lastLoginAt }, users.email))
        .limit(q.pageSize).offset((q.page - 1) * q.pageSize),
      this.db.select({ total: countAll }).from(users).where(where),
    ]);
    const rm = await this.rolesFor(rows.map((r) => r.u.id));
    return paginated(rows.map((r) => this.dto(r.u, rm.get(r.u.id) ?? [], r.inst)), total, q.page, q.pageSize);
  }

  async get(id: string) {
    const [r] = await this.db.select({ u: users, inst: institutions.nameEn }).from(users).leftJoin(institutions, eq(institutions.id, users.institutionId)).where(eq(users.id, id));
    if (!r) throw notFound('User');
    return this.dto(r.u, (await this.rolesFor([id])).get(id) ?? [], r.inst);
  }

  /** Only holders of every permission in a role may grant it (prevents privilege escalation). */
  private async assertCanGrant(tx: Tx, actor: RequestUser, roleIds: string[]) {
    if (!roleIds.length) return;
    const rs = await tx.select().from(roles).where(inArray(roles.id, roleIds));
    if (rs.length !== new Set(roleIds).size) throw businessRule('One or more roles do not exist');
    const missing = rs.flatMap((r) => r.permissions).filter((p) => !actor.permissions.has(p as never));
    if (missing.length) throw businessRule(`You cannot grant permissions you do not hold: ${[...new Set(missing)].join(', ')}`);
  }

  create(input: CreateUserInput, actor: RequestUser) {
    return this.db.transaction(async (tx) => {
      await this.assertCanGrant(tx, actor, input.roleIds);
      const passwordHash = await this.passwords.hash(input.password);
      const [u] = await tx.insert(users).values({
        email: input.email, fullNameEn: input.fullNameEn, fullNameAr: input.fullNameAr, locale: input.locale,
        institutionId: input.institutionId ?? null, passwordHash, passwordChangedAt: new Date(), createdById: actor.id, updatedById: actor.id,
      }).returning();
      if (input.roleIds.length) await tx.insert(userRoles).values(input.roleIds.map((roleId) => ({ userId: u.id, roleId })));
      await this.audit.record(actor, { action: 'user.create', entityType: 'user', entityId: u.id, changes: diff(null, u), metadata: { roleIds: input.roleIds } }, tx);
      return this.dto(u, []);
    }).then((u) => this.get(u.id));
  }

  update(id: string, input: UpdateUserInput, actor: RequestUser) {
    return this.db.transaction(async (tx) => {
      const { rowVersion, roleIds, ...data } = input;
      const before = await lockForUpdate<UserRow>(tx, users, id, rowVersion, 'User');
      if (id === actor.id && data.isActive === false) throw businessRule('You cannot deactivate your own account');
      const [after] = await tx.update(users).set({ ...defined(data), updatedAt: new Date(), updatedById: actor.id, rowVersion: sql`${users.rowVersion} + 1` }).where(eq(users.id, id)).returning();
      const changes = diff(before, after);
      if (roleIds) {
        if (id === actor.id) throw businessRule('You cannot change your own roles');
        await this.assertCanGrant(tx, actor, roleIds);
        const old = await tx.select({ roleId: userRoles.roleId }).from(userRoles).where(eq(userRoles.userId, id));
        await tx.delete(userRoles).where(eq(userRoles.userId, id));
        if (roleIds.length) await tx.insert(userRoles).values(roleIds.map((roleId) => ({ userId: id, roleId })));
        changes.roleIds = { from: old.map((r) => r.roleId).sort(), to: [...roleIds].sort() };
        await this.audit.record(actor, { action: 'user.roles_change', entityType: 'user', entityId: id, changes: { roleIds: changes.roleIds } }, tx);
      }
      if (data.isActive === false) {
        await tx.update(refreshTokens).set({ revokedAt: new Date() }).where(and(eq(refreshTokens.userId, id), isNull(refreshTokens.revokedAt)));
      }
      await this.audit.record(actor, { action: 'user.update', entityType: 'user', entityId: id, changes }, tx);
    }).then(() => this.get(id));
  }

  resetPassword(id: string, newPassword: string, actor: RequestUser) {
    return this.db.transaction(async (tx) => {
      await lockForUpdate<UserRow>(tx, users, id, undefined, 'User');
      const passwordHash = await this.passwords.hash(newPassword);
      await tx.update(users).set({ passwordHash, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null, updatedAt: new Date() }).where(eq(users.id, id));
      await tx.update(refreshTokens).set({ revokedAt: new Date() }).where(and(eq(refreshTokens.userId, id), isNull(refreshTokens.revokedAt)));
      await this.audit.record(actor, { action: 'user.password_reset', entityType: 'user', entityId: id }, tx);
    });
  }

  // ------------------------------------------------------------------ roles
  private roleDto(r: RoleRow, userCount?: number): RoleDto {
    return { id: r.id, code: r.code, nameEn: r.nameEn, nameAr: r.nameAr, description: r.description, isSystem: r.isSystem, permissions: r.permissions, userCount, rowVersion: r.rowVersion };
  }

  async roles(): Promise<RoleDto[]> {
    const rows = await this.db.select({ r: roles, n: count(userRoles.userId) }).from(roles).leftJoin(userRoles, eq(userRoles.roleId, roles.id)).groupBy(roles.id).orderBy(asc(roles.code));
    return rows.map((x) => this.roleDto(x.r, x.n));
  }

  permissionCatalog() {
    return ALL_PERMISSIONS;
  }

  createRole(input: RoleInput, actor: RequestUser) {
    return this.db.transaction(async (tx) => {
      const missing = input.permissions.filter((p) => !actor.permissions.has(p as never));
      if (missing.length) throw businessRule(`You cannot grant permissions you do not hold: ${missing.join(', ')}`);
      const [r] = await tx.insert(roles).values({ ...input, description: input.description ?? null }).returning();
      await this.audit.record(actor, { action: 'role.create', entityType: 'role', entityId: r.id, changes: diff(null, r) }, tx);
      return this.roleDto(r);
    });
  }

  updateRole(id: string, input: Partial<RoleInput> & { rowVersion: number }, actor: RequestUser) {
    return this.db.transaction(async (tx) => {
      const { rowVersion, ...data } = input;
      const before = await lockForUpdate<RoleRow>(tx, roles, id, rowVersion, 'Role');
      if (before.isSystem && data.code && data.code !== before.code) throw businessRule('System role codes cannot change');
      if (data.permissions) {
        const added = data.permissions.filter((p) => !before.permissions.includes(p));
        const missing = added.filter((p) => !actor.permissions.has(p as never));
        if (missing.length) throw businessRule(`You cannot grant permissions you do not hold: ${missing.join(', ')}`);
        if (before.code === 'system_admin' && data.permissions.length < ALL_PERMISSIONS.length) throw businessRule('The system administrator role must keep all permissions');
      }
      const [after] = await tx.update(roles).set({ ...defined(data), updatedAt: new Date(), rowVersion: sql`${roles.rowVersion} + 1` }).where(eq(roles.id, id)).returning();
      await this.audit.record(actor, { action: 'role.update', entityType: 'role', entityId: id, changes: diff(before, after) }, tx);
      return this.roleDto(after);
    });
  }
}
