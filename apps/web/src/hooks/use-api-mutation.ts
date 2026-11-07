import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api';

interface Options<TData, TVars> {
  fn: (vars: TVars) => Promise<TData>;
  /** Query keys to invalidate on success (prefix match). */
  invalidate?: QueryKey[];
  success?: string | ((data: TData) => string);
  onSuccess?: (data: TData, vars: TVars) => void;
  /** Set false when the form shows errors inline instead of a toast. */
  toastErrors?: boolean;
}

/**
 * Standard mutation: invalidates caches, shows success toast, maps API problems to
 * user-facing messages. Use for every write operation.
 */
export function useApiMutation<TData = unknown, TVars = void>(o: Options<TData, TVars>) {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation<TData, Error, TVars>({
    mutationFn: o.fn,
    onSuccess: async (data, vars) => {
      await Promise.all((o.invalidate ?? []).map((k) => qc.invalidateQueries({ queryKey: k })));
      if (o.success) toast.success(typeof o.success === 'function' ? o.success(data) : o.success);
      o.onSuccess?.(data, vars);
    },
    onError: (err) => {
      if (o.toastErrors === false) return;
      toast.error(errorMessage(err, t));
    },
  });
}

export function errorMessage(err: unknown, t: (k: string) => string): string {
  if (err instanceof ApiError) {
    if (err.status === 409 && err.problem.type === 'urn:cdms:edit-conflict') return t('errors.conflict');
    if (err.status === 403) return err.problem.detail ?? t('errors.forbidden');
    const first = err.problem.errors?.[0];
    return [err.problem.detail ?? err.problem.title, first && !err.problem.detail ? first.message : null].filter(Boolean).join(' — ');
  }
  if (err instanceof TypeError) return t('errors.network');
  return t('errors.generic');
}
