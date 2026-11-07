import { useQuery } from '@tanstack/react-query';
import type {
  CoverageReport,
  CurriculumDto,
  CurriculumInput,
  Paginated,
  SetCurriculumUnitsInput,
  UpdateOf,
  ValidationIssue,
} from '@cdms/contracts';
import { api } from '@/lib/api';
import { qs } from '@/lib/utils';
import type { ListParams } from '@/hooks/use-list-params';

/** Query keys for the curricula feature. Invalidate `curriculaKeys.all` after any write. */
export const curriculaKeys = {
  all: ['curricula'] as const,
  list: (p: ListParams) => ['curricula', 'list', p] as const,
  detail: (id: string) => ['curricula', id] as const,
  coverage: (id: string) => ['curricula', id, 'coverage'] as const,
  versions: (id: string) => ['curricula', id, 'versions'] as const,
};

export const useCurricula = (p: ListParams) =>
  useQuery({
    queryKey: curriculaKeys.list(p),
    queryFn: () => api.get<Paginated<CurriculumDto>>(`/curricula${qs(p)}`),
    placeholderData: (prev) => prev,
  });
export const useCurriculum = (id: string) =>
  useQuery({
    queryKey: curriculaKeys.detail(id),
    queryFn: () => api.get<CurriculumDto>(`/curricula/${id}`),
  });
export const useCoverage = (id: string, enabled = true) =>
  useQuery({
    queryKey: curriculaKeys.coverage(id),
    queryFn: () => api.get<CoverageReport>(`/curricula/${id}/coverage`),
    enabled,
  });
export const useVersions = (id: string) =>
  useQuery({
    queryKey: curriculaKeys.versions(id),
    queryFn: () =>
      api.get<{ id: string; version: number; status: string; updatedAt: string }[]>(
        `/curricula/${id}/versions`,
      ),
  });
export const useValidation = (id: string) =>
  useQuery({
    queryKey: ['curricula', id, 'validation'],
    queryFn: () => api.get<ValidationIssue[]>(`/curricula/${id}/validation`),
  });

export const curriculaApi = {
  create: (b: CurriculumInput) => api.post<CurriculumDto>('/curricula', b),
  update: (id: string, b: UpdateOf<CurriculumInput>) =>
    api.patch<CurriculumDto>(`/curricula/${id}`, b),
  setUnits: (id: string, b: SetCurriculumUnitsInput) =>
    api.put<{ rowVersion: number }>(`/curricula/${id}/units`, b),
  newVersion: (id: string, reason?: string) =>
    api.post<CurriculumDto>(`/curricula/${id}/new-version`, { reason }),
  remove: (id: string) => api.delete(`/curricula/${id}`),
  export: (id: string) => api.get<unknown>(`/curricula/${id}/export`),
};
