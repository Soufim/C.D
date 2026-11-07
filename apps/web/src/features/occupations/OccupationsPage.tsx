import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { ChevronRight, ListTree, Plus, Table2 } from 'lucide-react';
import { OCCUPATION_LEVELS, PERMISSIONS, RECORD_STATUSES } from '@cdms/contracts';
import type { OccupationDto } from '@cdms/contracts';
import { occupations } from '@/lib/resources';
import { useCan } from '@/lib/auth';
import { useBilingual } from '@/lib/format';
import { useListParams } from '@/hooks/use-list-params';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/patterns/page';
import { DataTable, FilterSelect, ListToolbar, SearchInput, type Column } from '@/components/patterns/data-table';
import { StatusBadge } from '@/components/patterns/status-badge';
import { OccupationFormDialog } from './OccupationFormDialog';

/** Lazily-expanding classification tree (ARIA tree pattern). */
function TreeLevel({ parentId, depth }: { parentId: string; depth: number }) {
  const q = occupations.useList({ parentId, pageSize: 200, sort: 'code' });
  if (q.isLoading) return <li className="py-1 ps-6"><Skeleton className="h-5 w-48" /></li>;
  return <>{q.data?.items.map((o) => <TreeNode key={o.id} node={o} depth={depth} />)}</>;
}

function TreeNode({ node, depth }: { node: OccupationDto; depth: number }) {
  const { t } = useTranslation();
  const { pick } = useBilingual();
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = (node.childCount ?? 0) > 0;
  return (
    <li role="treeitem" aria-expanded={hasChildren ? open : undefined} aria-level={depth + 1}>
      <div className="flex items-center gap-1 rounded-md py-1 pe-2 hover:bg-muted/60" style={{ paddingInlineStart: `${depth * 1.25}rem` }}>
        <button type="button" disabled={!hasChildren} onClick={() => setOpen((o) => !o)} aria-label={open ? 'Collapse' : 'Expand'} className={cn('grid size-6 place-items-center rounded hover:bg-muted', !hasChildren && 'invisible')}>
          <ChevronRight className={cn('size-4 transition-transform rtl-flip', open && 'rotate-90 rtl:-rotate-90')} />
        </button>
        <Link to={`/occupations/${node.id}`} className="flex min-w-0 flex-1 items-center gap-2 text-sm hover:underline">
          <span className="font-mono text-xs text-muted-foreground">{node.iscoCode ?? node.code}</span>
          <span className={cn('truncate', node.level === 'occupation' && 'font-medium')}>{pick(node, 'title')}</span>
        </Link>
        <Badge tone="outline" className="hidden sm:inline-flex">{t(`occupations.levels.${node.level}`)}</Badge>
        <StatusBadge status={node.status} />
      </div>
      {open && hasChildren && <ul role="group"><TreeLevel parentId={node.id} depth={depth + 1} /></ul>}
    </li>
  );
}

export function OccupationsPage() {
  const { t } = useTranslation();
  const { pick } = useBilingual();
  const can = useCan();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const { params, set, toggleSort } = useListParams({ sort: 'code' });
  const view = (params.view as string) ?? (params.q || params.status || params.level ? 'table' : 'tree');
  const roots = occupations.useList({ parentId: 'root', pageSize: 200, sort: 'code' }, view === 'tree');
  const list = occupations.useList({ ...params, view: undefined }, view === 'table');
  const columns: Column<OccupationDto>[] = [
    { key: 'title', header: t('common.title'), sortKey: 'titleEn', cell: (o) => <span className="flex flex-col"><span>{pick(o, 'title')}</span><span className="font-mono text-xs font-normal text-muted-foreground">{o.code}</span></span> },
    { key: 'level', header: t('common.level'), cell: (o) => t(`occupations.levels.${o.level}`) },
    { key: 'isco', header: t('occupations.isco'), cell: (o) => <span className="font-mono">{o.iscoCode ?? '—'}</span>, hideOnMobile: true },
    { key: 'status', header: t('common.status'), sortKey: 'status', cell: (o) => <StatusBadge status={o.status} /> },
  ];
  return (
    <>
      <PageHeader title={t('occupations.title')} description={t('occupations.subtitle')} actions={can(PERMISSIONS.CATALOG_WRITE) && <Button onClick={() => setCreating(true)}><Plus />{t('occupations.new')}</Button>} />
      <Card>
        <ListToolbar end={
          <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="View">
            <Button size="sm" variant={view === 'tree' ? 'secondary' : 'ghost'} aria-pressed={view === 'tree'} onClick={() => set({ view: 'tree', q: undefined, status: undefined, level: undefined })}><ListTree />{t('occupations.tree')}</Button>
            <Button size="sm" variant={view === 'table' ? 'secondary' : 'ghost'} aria-pressed={view === 'table'} onClick={() => set({ view: 'table' })}><Table2 />{t('occupations.table')}</Button>
          </div>}>
          <SearchInput value={params.q} onChange={(v) => set({ q: v, view: v ? 'table' : undefined })} />
          {view === 'table' && <>
            <FilterSelect label={t('common.level')} value={params.level as string} onChange={(v) => set({ level: v })} options={OCCUPATION_LEVELS.map((l) => ({ value: l, label: t(`occupations.levels.${l}`) }))} />
            <FilterSelect label={t('common.status')} value={params.status as string} onChange={(v) => set({ status: v })} options={RECORD_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))} />
          </>}
        </ListToolbar>
        {view === 'tree' ? (
          <ul role="tree" aria-label={t('occupations.tree')} className="p-2">
            {roots.isLoading ? <li className="p-3"><Skeleton className="h-24" /></li> : roots.data?.items.map((o) => <TreeNode key={o.id} node={o} depth={0} />)}
          </ul>
        ) : (
          <DataTable caption={t('occupations.title')} columns={columns} data={list.data} loading={list.isLoading} error={list.error} rowKey={(o) => o.id} rowHref={(o) => `/occupations/${o.id}`}
            sort={{ key: params.sort, order: params.order, onSort: toggleSort }} page={{ onPage: (p) => set({ page: p }, false), onPageSize: (s) => set({ pageSize: s }) }} />
        )}
      </Card>
      <OccupationFormDialog open={creating} onOpenChange={setCreating} onSaved={(o) => navigate(`/occupations/${o.id}`)} />
    </>
  );
}
