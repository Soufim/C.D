import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Permission } from '@cdms/contracts';
import { DB, Database } from '../../database/database.module';
import { roles, userRoles, users } from '../../database/schema';

export interface LoadedPrincipal {
  id: string;
  email: string;
  fullNameEn: string;
  fullNameAr: string;
  locale: 'en' | 'ar';
  institutionId: string | null;
  isActive: boolean;
  roles: string[];
  permissions: Permission[];
}

/** Resolves a user's effective permissions from their roles (fresh on every request). */
@Injectable()
export class PermissionsLoader {
  constructor(@Inject(DB) private readonly db: Database) {}

  async load(userId: string): Promise<LoadedPrincipal | null> {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return null;
    const rs = await this.db
      .select({ code: roles.code, permissions: roles.permissions })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(eq(userRoles.userId, userId));
    const perms = new Set<Permission>();
    rs.forEach((r) => r.permissions.forEach((p) => perms.add(p as Permission)));
    return {
      id: user.id,
      email: user.email,
      fullNameEn: user.fullNameEn,
      fullNameAr: user.fullNameAr,
      locale: user.locale,
      institutionId: user.institutionId,
      isActive: user.isActive,
      roles: rs.map((r) => r.code),
      permissions: [...perms].sort(),
    };
  }
}
