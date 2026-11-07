import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Plus, Target } from 'lucide-react';
import { COMPETENCY_TYPES, PERMISSIONS, RECORD_STATUSES } from '@cdms/contracts';
import type { CompetencyDto } from '@cdms/contracts';
import { competencies } from '@/lib/resources';
import { useCan } from '@/lib/auth';
import { useBilingual, useFormat } from '@/lib/format';
import { useListParams } from '@/hooks/use-list-params';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/patterns/page';
import { DataTable, FilterSelect, ListToolbar, SearchInput, type Column } from '@/components/patterns/data-table';
import { EmptyState } from '@/components/patterns/states';
import { StatusBadge } from '@/components/patterns/status-badge';
import { CompetencyFormDialog } from './CompetencyFormDialog';

export function CompetenciesPage() {
  const { t } = useTranslation();
  const { pick } = useBilingual();
  const f = useFormat();
  const can = useCan();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const { params, set, toggleSort } = useListParams({ sort: 'code' });
  const q = competencies.useList(params);
  const columns: Column<CompetencyDto>[] = [
    { key: 'title', header: t('common.title'), sortKey: 'titleEn', cell: (c) => <span className="flex flex-col"><span>{pick(c, 'title')}</span><span className="font-mono text-xs font-normal text-muted-foreground">{c.code}</span></span> },
    { key: 'type', header: t('common.type'), sortKey: 'type', cell: (c) => <Badge tone="primary">{t(`competencies.types.${c.type}`)}</Badge> },
    { key: 'level', header: t('common.level'), cell: (c) => c.frameworkLevelLabel ?? '—', hideOnMobile: true },
    { key: 'status', header: t('common.status'), sortKey: 'status', cell: (c) => <StatusBadge status={c.status} /> },
    { key: 'updated', header: t('common.updated'), sortKey: 'updatedAt', cell: (c) => <span className="text-muted-foreground">{f.date(c.updatedAt)}</span>, hideOnMobile: true },
  ];
  return (
    <>
      <PageHeader title={t('competencies.title')} description={t('competencies.subtitle')} actions={can(PERMISSIONS.CATALOG_WRITE) && <Button onClick={() => setCreating(true)}><Plus />{t('competencies.new')}</Button>} />
      <Card>
        <ListToolbar>
          <SearchInput value={params.q} onChange={(v) => set({ q: v })} />
          <FilterSelect label={t('common.type')} value={params.type as string} onChange={(v) => set({ type: v })} options={COMPETENCY_TYPES.map((x) => ({ value: x, label: t(`competencies.types.${x}`) }))} />
          <FilterSelect label={t('common.status')} value={params.status as string} onChange={(v) => set({ status: v })} options={RECORD_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))} />
        </ListToolbar>
        <DataTable caption={t('competencies.title')} columns={columns} data={q.data} loading={q.isLoading} error={q.error} onRetry={() => void q.refetch()} rowKey={(c) => c.id} rowHref={(c) => `/competencies/${c.id}`}
          sort={{ key: params.sort, order: params.order, onSort: toggleSort }} page={{ onPage: (p) => set({ page: p }, false), onPageSize: (s) => set({ pageSize: s }) }}
          empty={<EmptyState icon={<Target />} title={t('common.noResults')} />} />
      </Card>
      <CompetencyFormDialog open={creating} onOpenChange={setCreating} onSaved={(c) => navigate(`/competencies/${c.id}`)} />
    </>
  );
}
