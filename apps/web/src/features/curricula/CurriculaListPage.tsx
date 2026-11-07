import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { BookOpenCheck, Plus } from 'lucide-react';
import { PERMISSIONS, RECORD_STATUSES } from '@cdms/contracts';
import type { CurriculumDto } from '@cdms/contracts';
import { useCan } from '@/lib/auth';
import { useBilingual, useFormat } from '@/lib/format';
import { useListParams } from '@/hooks/use-list-params';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/patterns/page';
import {
  DataTable,
  FilterSelect,
  ListToolbar,
  SearchInput,
  type Column,
} from '@/components/patterns/data-table';
import { EmptyState } from '@/components/patterns/states';
import { StatusBadge } from '@/components/patterns/status-badge';
import { useCurricula } from './api';
import { CurriculumFormDialog } from './CurriculumFormDialog';

export function CurriculaListPage() {
  const { t } = useTranslation();
  const { pick } = useBilingual();
  const f = useFormat();
  const can = useCan();
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const { params, set, toggleSort } = useListParams({ sort: 'updatedAt', order: 'desc' });
  const { new: _n, ...query } = params;
  const q = useCurricula(query);
  const creating = sp.get('new') === '1';
  const setCreating = (o: boolean) =>
    setSp((p) => {
      const n = new URLSearchParams(p);
      if (o) n.set('new', '1');
      else n.delete('new');
      return n;
    });

  const columns: Column<CurriculumDto>[] = [
    {
      key: 'title',
      header: t('common.title'),
      sortKey: 'titleEn',
      cell: (c) => (
        <span className="flex flex-col">
          <span>{pick(c, 'title')}</span>
          <span className="font-mono text-xs font-normal text-muted-foreground">
            {c.code} · v{c.version}
          </span>
        </span>
      ),
    },
    {
      key: 'level',
      header: t('curricula.frameworkLevel'),
      cell: (c) => c.frameworkLevelLabel ?? '—',
      hideOnMobile: true,
    },
    {
      key: 'inst',
      header: t('curricula.institution'),
      cell: (c) => (
        <span className="line-clamp-1">
          {pick({ nameEn: c.institutionNameEn, nameAr: c.institutionNameAr }, 'name') || '—'}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'status',
      header: t('common.status'),
      sortKey: 'status',
      cell: (c) => <StatusBadge status={c.status} />,
    },
    {
      key: 'updated',
      header: t('common.updated'),
      sortKey: 'updatedAt',
      cell: (c) => (
        <time dateTime={c.updatedAt} className="text-muted-foreground">
          {f.date(c.updatedAt)}
        </time>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('curricula.title')}
        description={t('curricula.subtitle')}
        actions={
          can(PERMISSIONS.CURRICULUM_WRITE) && (
            <Button onClick={() => setCreating(true)}>
              <Plus />
              {t('curricula.new')}
            </Button>
          )
        }
      />
      <Card>
        <ListToolbar>
          <SearchInput value={params.q} onChange={(v) => set({ q: v })} />
          <FilterSelect
            label={t('common.status')}
            value={params.status as string}
            onChange={(v) => set({ status: v })}
            options={RECORD_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))}
          />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={params.mine === '1' || params.mine === 'true'}
              onCheckedChange={(c) => set({ mine: c ? '1' : undefined })}
            />
            {t('curricula.mine')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={params.allVersions === '1'}
              onCheckedChange={(c) => set({ allVersions: c ? '1' : undefined })}
            />
            {t('curricula.allVersions')}
          </label>
        </ListToolbar>
        <DataTable
          caption={t('curricula.title')}
          columns={columns}
          data={q.data}
          loading={q.isLoading}
          error={q.error}
          onRetry={() => void q.refetch()}
          rowKey={(c) => c.id}
          rowHref={(c) => `/curricula/${c.id}`}
          sort={{ key: params.sort, order: params.order, onSort: toggleSort }}
          page={{ onPage: (p) => set({ page: p }, false), onPageSize: (s) => set({ pageSize: s }) }}
          empty={
            <EmptyState
              icon={<BookOpenCheck />}
              title={t('curricula.empty')}
              body={t('curricula.emptyBody')}
            />
          }
        />
      </Card>
      <CurriculumFormDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(c) => navigate(`/curricula/${c.id}`)}
      />
    </>
  );
}
