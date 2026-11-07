import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Plus, Puzzle } from 'lucide-react';
import { PERMISSIONS, RECORD_STATUSES } from '@cdms/contracts';
import type { UnitDto } from '@cdms/contracts';
import { units } from '@/lib/resources';
import { useCan } from '@/lib/auth';
import { useBilingual, useFormat } from '@/lib/format';
import { useListParams } from '@/hooks/use-list-params';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/patterns/page';
import { DataTable, FilterSelect, ListToolbar, SearchInput, type Column } from '@/components/patterns/data-table';
import { EmptyState } from '@/components/patterns/states';
import { StatusBadge } from '@/components/patterns/status-badge';
import { UnitFormDialog } from './UnitFormDialog';

export function UnitsPage() {
  const { t } = useTranslation();
  const { pick } = useBilingual();
  const f = useFormat();
  const can = useCan();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const { params, set, toggleSort } = useListParams({ sort: 'code' });
  const q = units.useList(params);
  const columns: Column<UnitDto>[] = [
    { key: 'title', header: t('common.title'), sortKey: 'titleEn', cell: (u) => <span className="flex flex-col"><span>{pick(u, 'title')}</span><span className="font-mono text-xs font-normal text-muted-foreground">{u.code}</span></span> },
    { key: 'hours', header: t('common.hours'), cell: (u) => <span className="tabular">{f.number(u.theoryHours)} + {f.number(u.practicalHours)}</span> },
    { key: 'credits', header: t('common.credits'), sortKey: 'creditHours', cell: (u) => <span className="tabular">{f.number(u.creditHours, 1)}</span>, hideOnMobile: true },
    { key: 'level', header: t('common.level'), cell: (u) => u.frameworkLevelLabel ?? '—', hideOnMobile: true },
    { key: 'status', header: t('common.status'), sortKey: 'status', cell: (u) => <StatusBadge status={u.status} /> },
  ];
  return (
    <>
      <PageHeader title={t('units.title')} description={t('units.subtitle')} actions={can(PERMISSIONS.CATALOG_WRITE) && <Button onClick={() => setCreating(true)}><Plus />{t('units.new')}</Button>} />
      <Card>
        <ListToolbar>
          <SearchInput value={params.q} onChange={(v) => set({ q: v })} />
          <FilterSelect label={t('common.status')} value={params.status as string} onChange={(v) => set({ status: v })} options={RECORD_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))} />
        </ListToolbar>
        <DataTable caption={t('units.title')} columns={columns} data={q.data} loading={q.isLoading} error={q.error} onRetry={() => void q.refetch()} rowKey={(u) => u.id} rowHref={(u) => `/units/${u.id}`}
          sort={{ key: params.sort, order: params.order, onSort: toggleSort }} page={{ onPage: (p) => set({ page: p }, false), onPageSize: (s) => set({ pageSize: s }) }}
          empty={<EmptyState icon={<Puzzle />} title={t('common.noResults')} />} />
      </Card>
      <UnitFormDialog open={creating} onOpenChange={setCreating} onSaved={(u) => navigate(`/units/${u.id}`)} />
    </>
  );
}
