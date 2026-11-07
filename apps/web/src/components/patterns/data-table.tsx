import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from 'lucide-react';
import type { Paginated } from '@cdms/contracts';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Input, NativeSelect } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebounce } from '@/hooks/use-debounce';
import { useFormat } from '@/lib/format';
import { cn } from '@/lib/utils';
import { EmptyState, ErrorState } from './states';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Server-side sort key; omit for unsortable columns. */
  sortKey?: string;
  className?: string;
  /** Hidden in the mobile card layout. */
  hideOnMobile?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data?: Paginated<T> | T[];
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  rowKey: (row: T) => string;
  /** Makes the whole row navigable (the first cell renders as the link for a11y). */
  rowHref?: (row: T) => string;
  sort?: { key?: string; order: 'asc' | 'desc'; onSort: (key: string) => void };
  empty?: ReactNode;
  caption: string;
  page?: { onPage: (p: number) => void; onPageSize?: (s: number) => void };
  /** Mobile-first card renderer; defaults to a stacked label/value card. */
  mobileCard?: (row: T) => ReactNode;
}

/**
 * Standard data table: server pagination & sorting, loading/empty/error states, responsive
 * card layout below the md breakpoint. Use for every tabular list.
 */
export function DataTable<T>({
  columns,
  data,
  loading,
  error,
  onRetry,
  rowKey,
  rowHref,
  sort,
  empty,
  caption,
  page,
  mobileCard,
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const rows = Array.isArray(data) ? data : (data?.items ?? []);
  const paged = data && !Array.isArray(data) ? data : undefined;

  if (error) return <ErrorState error={error} onRetry={onRetry} />;

  const sortIcon = (k?: string) => {
    if (!k || !sort) return null;
    if (sort.key !== k) return <ArrowUpDown className="size-3 opacity-50" aria-hidden />;
    return sort.order === 'asc' ? (
      <ArrowUp className="size-3" aria-hidden />
    ) : (
      <ArrowDown className="size-3" aria-hidden />
    );
  };

  return (
    <div className="flex flex-col">
      {/* Desktop / tablet */}
      <div className="hidden md:block">
        <Table aria-busy={loading || undefined}>
          <caption className="sr-only">{caption}</caption>
          <THead>
            <TR className="hover:bg-transparent">
              {columns.map((c) => (
                <TH
                  key={c.key}
                  className={c.className}
                  aria-sort={
                    sort && c.sortKey && sort.key === c.sortKey
                      ? sort.order === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                >
                  {c.sortKey && sort ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 uppercase hover:text-foreground"
                      onClick={() => sort.onSort(c.sortKey!)}
                    >
                      {c.header}
                      {sortIcon(c.sortKey)}
                    </button>
                  ) : (
                    c.header
                  )}
                </TH>
              ))}
            </TR>
          </THead>
          <TBody>
            {loading && !rows.length
              ? Array.from({ length: 6 }).map((_, i) => (
                  <TR key={i}>
                    {columns.map((c) => (
                      <TD key={c.key}>
                        <Skeleton className="h-4 w-full max-w-40" />
                      </TD>
                    ))}
                  </TR>
                ))
              : rows.map((row) => (
                  <TR
                    key={rowKey(row)}
                    className={cn(rowHref && 'cursor-pointer')}
                    onClick={
                      rowHref
                        ? (e) => {
                            if (!(e.target as HTMLElement).closest('a,button,input,label'))
                              navigate(rowHref(row));
                          }
                        : undefined
                    }
                  >
                    {columns.map((c, i) => (
                      <TD key={c.key} className={c.className}>
                        {i === 0 && rowHref ? (
                          <Link
                            to={rowHref(row)}
                            className="font-medium text-primary hover:underline"
                          >
                            {c.cell(row)}
                          </Link>
                        ) : (
                          c.cell(row)
                        )}
                      </TD>
                    ))}
                  </TR>
                ))}
          </TBody>
        </Table>
      </div>
      {/* Phone */}
      <ul className="flex flex-col divide-y md:hidden" aria-label={caption}>
        {loading &&
          !rows.length &&
          Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="p-4">
              <Skeleton className="h-12" />
            </li>
          ))}
        {rows.map((row) => (
          <li key={rowKey(row)}>
            {mobileCard ? (
              mobileCard(row)
            ) : (
              <MobileCard href={rowHref?.(row)}>
                <div className="font-medium">{columns[0]?.cell(row)}</div>
                <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  {columns
                    .slice(1)
                    .filter((c) => !c.hideOnMobile)
                    .map((c) => (
                      <div key={c.key} className="min-w-0">
                        <dt className="text-muted-foreground">{c.header}</dt>
                        <dd className="truncate">{c.cell(row)}</dd>
                      </div>
                    ))}
                </dl>
              </MobileCard>
            )}
          </li>
        ))}
      </ul>
      {!loading && !rows.length && (empty ?? <EmptyState title={t('common.noResults')} />)}
      {paged && page && paged.total > 0 && (
        <Pagination data={paged} onPage={page.onPage} onPageSize={page.onPageSize} />
      )}
    </div>
  );
}

function MobileCard({ href, children }: { href?: string; children: ReactNode }) {
  return href ? (
    <Link to={href} className="block p-4 hover:bg-muted/50">
      {children}
    </Link>
  ) : (
    <div className="p-4">{children}</div>
  );
}

export function Pagination({
  data,
  onPage,
  onPageSize,
}: {
  data: Paginated<unknown>;
  onPage: (p: number) => void;
  onPageSize?: (s: number) => void;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const from = (data.page - 1) * data.pageSize + 1;
  const to = Math.min(data.total, data.page * data.pageSize);
  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t px-3 py-3 text-sm"
    >
      <span className="text-muted-foreground tabular">
        {t('common.showing', {
          from: f.number(from),
          to: f.number(to),
          total: f.number(data.total),
        })}
      </span>
      <div className="flex items-center gap-2">
        {onPageSize && (
          <label className="hidden items-center gap-2 text-muted-foreground sm:flex">
            {t('common.rowsPerPage')}
            <NativeSelect
              className="h-8 w-20"
              value={data.pageSize}
              onChange={(e) => onPageSize(Number(e.target.value))}
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </NativeSelect>
          </label>
        )}
        <Button
          variant="outline"
          size="icon-sm"
          disabled={data.page <= 1}
          onClick={() => onPage(data.page - 1)}
          aria-label={t('common.previous')}
        >
          <ChevronLeft className="rtl-flip" />
        </Button>
        <span className="tabular px-1">
          {t('common.page', { page: f.number(data.page), pages: f.number(pages) })}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={data.page >= pages}
          onClick={() => onPage(data.page + 1)}
          aria-label={t('common.next')}
        >
          <ChevronRight className="rtl-flip" />
        </Button>
      </div>
    </nav>
  );
}

/** Debounced search box bound to the URL `q` parameter. */
export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const [local, setLocal] = useState(value);
  const [prev, setPrev] = useState(value);
  // Sync when the URL changes externally (React's "adjust state on prop change" pattern).
  if (value !== prev) {
    setPrev(value);
    setLocal(value);
  }
  const debounced = useDebounce(local, 300);
  useEffect(() => {
    if (debounced !== value) onChange(debounced);
  }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={cn('relative w-full sm:max-w-xs', className)}>
      <Search
        className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder ?? t('common.searchPlaceholder')}
        aria-label={t('common.search')}
        className="ps-8 pe-8"
      />
      {local && (
        <button
          type="button"
          onClick={() => setLocal('')}
          className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
          aria-label={t('common.clearFilters')}
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

/** Toolbar above a list: search + filters on the start side, extra actions at the end. */
export function ListToolbar({ children, end }: { children: ReactNode; end?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">{children}</div>
      {end && <div className="flex items-center gap-2">{end}</div>}
    </div>
  );
}

/** Compact filter select for list toolbars. */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value?: string;
  onChange: (v: string | undefined) => void;
  options: { value: string; label: string }[];
}) {
  const { t } = useTranslation();
  return (
    <NativeSelect
      aria-label={label}
      className="h-9 sm:w-44"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || undefined)}
    >
      <option value="">
        {label}: {t('common.all')}
      </option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </NativeSelect>
  );
}
