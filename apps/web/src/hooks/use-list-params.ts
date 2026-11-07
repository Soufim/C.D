import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

export interface ListParams {
  page: number;
  pageSize: number;
  q: string;
  sort?: string;
  order: 'asc' | 'desc';
  [filter: string]: string | number | undefined;
}

/**
 * List state (page, search, sort, filters) lives in the URL so views are shareable,
 * bookmarkable and survive reloads. Use this for EVERY list page.
 */
export function useListParams(defaults: Partial<ListParams> = {}) {
  const [sp, setSp] = useSearchParams();
  const params = useMemo<ListParams>(() => {
    const out: ListParams = {
      page: Number(sp.get('page') ?? defaults.page ?? 1),
      pageSize: Number(sp.get('pageSize') ?? defaults.pageSize ?? 20),
      q: sp.get('q') ?? '',
      sort: sp.get('sort') ?? (defaults.sort as string | undefined),
      order: (sp.get('order') as 'asc' | 'desc') ?? defaults.order ?? 'asc',
    };
    sp.forEach((v, k) => {
      if (!(k in out)) out[k] = v;
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  const set = useCallback(
    (patch: Partial<ListParams>, resetPage = true) => {
      setSp((prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v === undefined || v === '' || v === null) next.delete(k);
          else next.set(k, String(v));
        }
        if (resetPage && !('page' in patch)) next.delete('page');
        return next;
      }, { replace: true });
    },
    [setSp],
  );

  const toggleSort = useCallback(
    (key: string) => set({ sort: key, order: params.sort === key && params.order === 'asc' ? 'desc' : 'asc' }),
    [params.sort, params.order, set],
  );

  return { params, set, toggleSort };
}
