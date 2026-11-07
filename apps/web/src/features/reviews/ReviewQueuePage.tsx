import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ClipboardCheck } from 'lucide-react';
import type { ReviewQueueItem } from '@cdms/contracts';
import { api } from '@/lib/api';
import { useBilingual, useFormat } from '@/lib/format';
import { entityPath, entityLabelKey } from '@/lib/entities';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/patterns/page';
import { DataTable, type Column } from '@/components/patterns/data-table';
import { EmptyState } from '@/components/patterns/states';
import { StatusBadge } from '@/components/patterns/status-badge';

export function ReviewQueuePage() {
  const { t } = useTranslation();
  const { pick } = useBilingual();
  const f = useFormat();
  const q = useQuery({
    queryKey: ['reviews'],
    queryFn: () => api.get<ReviewQueueItem[]>('/workflow/review-queue'),
  });
  const columns: Column<ReviewQueueItem>[] = [
    {
      key: 'title',
      header: t('common.title'),
      cell: (r) => (
        <span className="flex flex-col">
          <span>{pick(r, 'title')}</span>
          <span className="font-mono text-xs font-normal text-muted-foreground">{r.code}</span>
        </span>
      ),
    },
    {
      key: 'type',
      header: t('reviews.entity'),
      cell: (r) => <Badge tone="primary">{t(entityLabelKey(r.entityType))}</Badge>,
    },
    { key: 'by', header: t('admin.actor'), cell: (r) => r.submittedBy ?? '—' },
    {
      key: 'when',
      header: t('admin.when'),
      cell: (r) =>
        r.submittedAt ? <time dateTime={r.submittedAt}>{f.relative(r.submittedAt)}</time> : '—',
    },
    {
      key: 'status',
      header: t('common.status'),
      cell: (r) => <StatusBadge status={r.status} />,
      hideOnMobile: true,
    },
  ];
  return (
    <>
      <PageHeader title={t('reviews.title')} description={t('reviews.subtitle')} />
      <Card>
        <DataTable
          caption={t('reviews.title')}
          columns={columns}
          data={q.data}
          loading={q.isLoading}
          error={q.error}
          rowKey={(r) => r.entityType + r.entityId}
          rowHref={(r) => entityPath(r.entityType, r.entityId)!}
          empty={
            <EmptyState
              icon={<ClipboardCheck />}
              title={t('reviews.empty')}
              body={t('reviews.emptyBody')}
            />
          }
        />
      </Card>
    </>
  );
}
