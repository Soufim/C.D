import { z } from 'zod';
import { code, rowVersion, uuid } from './common';
import { passwordSchema } from './auth';
import { ALL_PERMISSIONS } from './permissions';

export const createUserSchema = z.object({
  email: z.email().max(254).transform((v) => v.toLowerCase()),
  fullNameEn: z.string().trim().min(1).max(200),
  fullNameAr: z.string().trim().min(1).max(200),
  password: passwordSchema,
  institutionId: uuid.nullable().optional(),
  roleIds: z.array(uuid).max(20).default([]),
  locale: z.enum(['en', 'ar']).default('ar'),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  fullNameEn: z.string().trim().min(1).max(200).optional(),
  fullNameAr: z.string().trim().min(1).max(200).optional(),
  institutionId: uuid.nullable().optional(),
  roleIds: z.array(uuid).max(20).optional(),
  isActive: z.boolean().optional(),
  rowVersion,
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const resetPasswordSchema = z.object({ newPassword: passwordSchema });

export const roleSchema = z.object({
  code,
  nameEn: z.string().trim().min(1).max(100),
  nameAr: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).optional().nullable(),
  permissions: z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])).max(100),
});
export type RoleInput = z.infer<typeof roleSchema>;
export const updateRoleSchema = roleSchema.partial().extend({ rowVersion });

export interface UserDto {
  id: string;
  email: string;
  fullNameEn: string;
  fullNameAr: string;
  locale: 'en' | 'ar';
  institutionId: string | null;
  institutionNameEn?: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  roles: { id: string; code: string; nameEn: string; nameAr: string }[];
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
}

export interface RoleDto {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  userCount?: number;
  rowVersion: number;
}

export const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  entityType: z.string().max(50).optional(),
  entityId: uuid.optional(),
  actorId: uuid.optional(),
  action: z.string().max(100).optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
});
export type AuditQuery = z.infer<typeof auditQuerySchema>;

export interface AuditEntryDto {
  id: string;
  occurredAt: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  outcome: 'success' | 'failure';
  ip: string | null;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  metadata: Record<string, unknown> | null;
}
