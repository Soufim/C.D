import { useQuery } from '@tanstack/react-query';
import type { Paginated, UpdateOf } from '@cdms/contracts';
import { api } from './api';
import { qs } from './utils';

/**
 * Typed hooks + calls for a standard REST resource:
 *   GET /path?…  GET /path/:id  POST /path  PATCH /path/:id
 * Use for catalogue-style resources. Feature-specific endpoints go in the feature's api.ts.
 */
export function createResource<TDto, TInput>(path: string, key: string) {
  const keys = {
    all: [key] as const,
    list: (p: Record<string, unknown>) => [key, 'list', p] as const,
    detail: (id: string) => [key, id] as const,
  };
  return {
    keys,
    path,
    useList: (p: Record<string, unknown>, enabled = true) =>
      useQuery({
        queryKey: keys.list(p),
        queryFn: () => api.get<Paginated<TDto>>(`${path}${qs(p)}`),
        placeholderData: (prev) => prev,
        enabled,
      }),
    useOne: (id: string | undefined) =>
      useQuery({
        queryKey: keys.detail(id ?? ''),
        queryFn: () => api.get<TDto>(`${path}/${id}`),
        enabled: !!id,
      }),
    create: (b: TInput) => api.post<TDto>(path, b),
    update: (id: string, b: UpdateOf<TInput>) => api.patch<TDto>(`${path}/${id}`, b),
  };
}
