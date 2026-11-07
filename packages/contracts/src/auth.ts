import { z } from 'zod';
import type { Permission } from './permissions';
import type { Locale } from './enums';

export const loginSchema = z.object({
  email: z.email().max(254).transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(256),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Password policy (OWASP ASVS v4 2.1): length over complexity, max 128. */
export const passwordSchema = z.string().min(12, 'At least 12 characters').max(128);

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const updateProfileSchema = z.object({
  fullNameEn: z.string().trim().min(1).max(200).optional(),
  fullNameAr: z.string().trim().min(1).max(200).optional(),
  locale: z.enum(['en', 'ar']).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export interface SessionUser {
  id: string;
  email: string;
  fullNameEn: string;
  fullNameAr: string;
  locale: Locale;
  institutionId: string | null;
  roles: string[];
  permissions: Permission[];
}

export interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  user: SessionUser;
}
