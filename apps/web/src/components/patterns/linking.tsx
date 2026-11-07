import { useId, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Check, ChevronsUpDown, GitBranch, Link2, Unlink, X } from 'lucide-react';
import type {
  ImpactReport,
  LinkedRef,
  Paginated,
  RecordStatus,
  ReferenceItemDto,
} from '@cdms/contracts';
import { api } from '@/lib/api';
import { qs, cn } from '@/lib/utils';
import { useBilingual } from '@/lib/format';
import { entityPath, entityLabelKey } from '@/lib/entities';
import { useDebounce } from '@/hooks/use-debounce';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input, NativeSelect } from '@/components/ui/input';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/menu';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from './confirm';
import { EmptyState } from './states';
import { StatusBadge } from './status-badge';

type Searchable = { id: string; code: string; status?: RecordStatus } & Record<string, unknown>;

/** Label "CODE — Title" in the current language. Titles may be in title* or name* fields. */
export function useRecordLabel() {
  const { pick } = useBilingual();
  return (r: Record<string, unknown> | null | undefined) =>
    r ? `${r.code} — ${pick(r, 'title') || pick(r, 'name')}` : '';
}

/** List of linked records with navigation and optional unlink. */
export function LinkedRecords({
  items,
  entityType,
  onUnlink,
  empty,
}: {
  items?: LinkedRef[];
  entityType: string;
  onUnlink?: (id: string) => Promise<unknown>;
  empty?: string;
}) {
  const { t } = useTranslation();
  const { pick } = useBilingual();
  if (!items?.length)
    return <EmptyState className="py-6" icon={<Link2 />} title={empty ?? t('common.none')} />;
  return (
    <ul className="divide-y">
      {items.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
          <Link to={entityPath(entityType, r.id) ?? '#'} className="min-w-0 hover:underline">
            <span className="font-mono text-xs text-muted-foreground">{r.code}</span>
            <span className="block truncate text-sm font-medium">{pick(r as never, 'title')}</span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            {r.status && <StatusBadge status={r.status as RecordStatus} />}
            {onUnlink && (
              <ConfirmDialog
                title={t('link.confirmUnlink')}
                confirmLabel={t('common.unlink')}
                onConfirm={() => onUnlink(r.id)}
                trigger={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`${t('common.unlink')} ${r.code}`}
                  >
                    <Unlink />
                  </Button>
                }
              />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Multi-select search dialog to link records (e.g. competencies to a unit).
 * `endpoint` must be a list endpoint supporting ?q= and returning Paginated<T>.
 */
export function LinkPicker({
  open,
  onOpenChange,
  title,
  endpoint,
  exclude = [],
  onConfirm,
  extraQuery,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  endpoint: string;
  exclude?: string[];
  onConfirm: (ids: string[]) => Promise<unknown>;
  extraQuery?: Record<string, unknown>;
}) {
  const { t } = useTranslation();
  const label = useRecordLabel();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const dq = useDebounce(q);
  const res = useQuery({
    queryKey: ['picker', endpoint, dq, extraQuery],
    queryFn: () =>
      api.get<Paginated<Searchable>>(`${endpoint}${qs({ q: dq, pageSize: 30, ...extraQuery })}`),
    enabled: open,
  });
  const items = (res.data?.items ?? []).filter(
    (i) => !exclude.includes(i.id) && i.status !== 'archived',
  );
  const toggle = (id: string) =>
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setSel([]);
      }}
    >
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t('common.selected', { count: sel.length })}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <Input
            type="search"
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('link.search')}
            aria-label={t('common.search')}
          />
          <ul
            className="flex max-h-[50dvh] flex-col divide-y overflow-y-auto rounded-md border"
            role="listbox"
            aria-multiselectable
          >
            {res.isLoading && (
              <li className="p-3">
                <Skeleton className="h-8" />
              </li>
            )}
            {!res.isLoading && !items.length && (
              <li className="p-6 text-center text-sm text-muted-foreground">
                {t('common.noResults')}
              </li>
            )}
            {items.map((i) => (
              <li key={i.id} role="option" aria-selected={sel.includes(i.id)}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/50">
                  <Checkbox checked={sel.includes(i.id)} onCheckedChange={() => toggle(i.id)} />
                  <span className="min-w-0 flex-1 truncate text-sm">{label(i)}</span>
                  {i.status && <StatusBadge status={i.status} />}
                </label>
              </li>
            ))}
          </ul>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={!sel.length}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(sel);
                setSel([]);
                onOpenChange(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            {t('common.link')} ({sel.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Searchable single-record select (combobox) backed by a list endpoint.
 * Value is the record id; `initial` supplies the label for the current value.
 */
export function RecordSelect({
  endpoint,
  value,
  onChange,
  initial,
  placeholder,
  extraQuery,
  id,
  disabled,
  ...aria
}: {
  endpoint: string;
  value: string | null | undefined;
  onChange: (id: string | null, rec?: Searchable) => void;
  initial?: Searchable | LinkedRef | null;
  placeholder?: string;
  extraQuery?: Record<string, unknown>;
  id?: string;
  disabled?: boolean;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}) {
  const { t } = useTranslation();
  const label = useRecordLabel();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [chosen, setChosen] = useState<Searchable | LinkedRef | null | undefined>(initial);
  const listId = useId();
  const dq = useDebounce(q);
  const res = useQuery({
    queryKey: ['select', endpoint, dq, extraQuery],
    queryFn: () =>
      api.get<Paginated<Searchable>>(`${endpoint}${qs({ q: dq, pageSize: 20, ...extraQuery })}`),
    enabled: open,
  });
  const current = value
    ? chosen?.id === value
      ? chosen
      : initial?.id === value
        ? initial
        : null
    : null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-haspopup="listbox"
          {...aria}
          className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-start text-sm shadow-sm disabled:opacity-60 aria-[invalid=true]:border-destructive"
        >
          <span className={cn('truncate', !current && 'text-muted-foreground')}>
            {current ? label(current as never) : value ? '…' : (placeholder ?? t('common.select'))}
          </span>
          <span className="flex items-center gap-1">
            {value && !disabled && (
              <span
                role="button"
                tabIndex={0}
                aria-label={t('common.clearFilters')}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                  setChosen(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.stopPropagation();
                    onChange(null);
                  }
                }}
                className="rounded p-0.5 hover:bg-muted"
              >
                <X className="size-3.5" />
              </span>
            )}
            <ChevronsUpDown className="size-4 opacity-50" aria-hidden />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-72 p-2">
        <Input
          autoFocus
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('common.searchPlaceholder')}
          aria-label={t('common.search')}
          className="mb-2"
        />
        <ul id={listId} role="listbox" className="max-h-64 overflow-y-auto">
          {res.isLoading && (
            <li className="p-2">
              <Skeleton className="h-6" />
            </li>
          )}
          {res.data?.items
            .filter((i) => i.status !== 'archived')
            .map((i) => (
              <li key={i.id} role="option" aria-selected={i.id === value}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-sm hover:bg-muted"
                  onClick={() => {
                    setChosen(i);
                    onChange(i.id, i);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn('size-4 shrink-0', i.id === value ? 'opacity-100' : 'opacity-0')}
                    aria-hidden
                  />
                  <span className="truncate">{label(i)}</span>
                </button>
              </li>
            ))}
          {res.data && !res.data.items.length && (
            <li className="p-3 text-center text-sm text-muted-foreground">
              {t('common.noResults')}
            </li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/** Select bound to a reference-data list (value = item code). */
export function ReferenceSelect({
  listCode,
  value,
  onChange,
  includeEmpty = true,
  ...rest
}: {
  listCode: string;
  value: string | null | undefined;
  onChange: (code: string | null) => void;
  includeEmpty?: boolean;
  id?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}) {
  const { t } = useTranslation();
  const { pick } = useBilingual();
  const q = useQuery({
    queryKey: ['reference', listCode, 'active'],
    queryFn: () => api.get<ReferenceItemDto[]>(`/reference-data/lists/${listCode}/items?active=1`),
    staleTime: 5 * 60_000,
  });
  return (
    <NativeSelect value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} {...rest}>
      {includeEmpty && <option value="">{t('common.none')}</option>}
      {q.data?.map((i) => (
        <option key={i.id} value={i.code}>
          {pick(i as never, 'label')}
        </option>
      ))}
    </NativeSelect>
  );
}

/** Displays a reference code as its label. */
export function ReferenceLabel({
  listCode,
  code,
}: {
  listCode: string;
  code: string | null | undefined;
}) {
  const { pick } = useBilingual();
  const q = useQuery({
    queryKey: ['reference', listCode, 'active'],
    queryFn: () => api.get<ReferenceItemDto[]>(`/reference-data/lists/${listCode}/items?active=1`),
    staleTime: 5 * 60_000,
    enabled: !!code,
  });
  if (!code) return <>—</>;
  const it = q.data?.find((i) => i.code === code);
  return <>{it ? pick(it as never, 'label') : code}</>;
}

/** Qualification level select (all levels of non-archived frameworks). */
export function LevelSelect({
  value,
  onChange,
  ...rest
}: {
  value: string | null | undefined;
  onChange: (id: string | null) => void;
  id?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}) {
  const { t } = useTranslation();
  const { isAr } = useBilingual();
  const q = useQuery({
    queryKey: ['frameworks', 'levels'],
    queryFn: () =>
      api.get<{ id: string; labelEn: string; labelAr: string }[]>('/frameworks/levels'),
    staleTime: 5 * 60_000,
  });
  return (
    <NativeSelect value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} {...rest}>
      <option value="">{t('common.none')}</option>
      {q.data?.map((l) => (
        <option key={l.id} value={l.id}>
          {isAr ? l.labelAr : l.labelEn}
        </option>
      ))}
    </NativeSelect>
  );
}

/** Shows which records depend on this one before changing shared reference information. */
export function ImpactButton({ endpoint, children }: { endpoint: string; children?: ReactNode }) {
  const { t } = useTranslation();
  const { pick } = useBilingual();
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ['impact', endpoint],
    queryFn: () => api.get<ImpactReport>(endpoint),
    enabled: open,
  });
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <GitBranch />
        {children ?? t('impact.check')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>{t('impact.title')}</DialogTitle>
            <DialogDescription>{t('impact.body')}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            {q.isLoading ? (
              <Skeleton className="h-24" />
            ) : !q.data?.totalAffected ? (
              <p className="text-sm text-muted-foreground">{t('impact.none')}</p>
            ) : (
              <div className="flex flex-col gap-4">
                {q.data.affected
                  .filter((a) => a.items.length)
                  .map((a) => (
                    <div key={a.entityType}>
                      <h3 className="mb-1 text-sm font-semibold">
                        {t(entityLabelKey(a.entityType))} · {a.items.length}
                      </h3>
                      <ul className="divide-y rounded-md border">
                        {a.items.map((i) => (
                          <li
                            key={i.id}
                            className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                          >
                            <Link
                              className="truncate hover:underline"
                              to={entityPath(a.entityType, i.id) ?? '#'}
                            >
                              <span className="font-mono text-xs text-muted-foreground">
                                {i.code}
                              </span>{' '}
                              {pick(i as never, 'title')}
                            </Link>
                            {i.status && <StatusBadge status={i.status as RecordStatus} />}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}
