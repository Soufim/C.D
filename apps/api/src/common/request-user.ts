import type { Permission } from '@cdms/contracts';

/** The authenticated principal attached to each request by the auth guard. */
export interface RequestUser {
  id: string;
  email: string;
  institutionId: string | null;
  permissions: ReadonlySet<Permission>;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
}

export function can(user: RequestUser, permission: Permission): boolean {
  return user.permissions.has(permission);
}
