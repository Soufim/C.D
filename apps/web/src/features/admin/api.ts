import { useQuery } from '@tanstack/react-query';
import type { AuditEntryDto, Paginated, RoleDto, UserDto } from '@cdms/contracts';
import { api } from '@/lib/api';
import { qs } from '@/lib/utils';

export const adminKeys = {
  users: ['admin', 'users'] as const,
  roles: ['admin', 'roles'] as const,
  audit: ['admin', 'audit'] as const,
};
export const useUsers = (p: Record<string, unknown>) =>
  useQuery({
    queryKey: [...adminKeys.users, p],
    queryFn: () => api.get<Paginated<UserDto>>(`/admin/users${qs(p)}`),
    placeholderData: (x) => x,
  });
export const useRoles = () =>
  useQuery({ queryKey: adminKeys.roles, queryFn: () => api.get<RoleDto[]>('/admin/roles') });
export const usePermissionCatalog = () =>
  useQuery({
    queryKey: ['admin', 'permissions'],
    queryFn: () => api.get<string[]>('/admin/permissions'),
    staleTime: Infinity,
  });
export const useAudit = (p: Record<string, unknown>) =>
  useQuery({
    queryKey: [...adminKeys.audit, p],
    queryFn: () => api.get<Paginated<AuditEntryDto>>(`/audit${qs(p)}`),
    placeholderData: (x) => x,
  });
