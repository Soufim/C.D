import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { Pencil } from 'lucide-react';
import { EDITABLE_STATUSES, PERMISSIONS } from '@cdms/contracts';
import { competencies } from '@/lib/resources';
import { useCan } from '@/lib/auth';
import { useBilingual } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DetailLayout, KeyValue, PageHeader, Section } from '@/components/patterns/page';
import { ErrorState, Notice, PageLoader } from '@/components/patterns/states';
import { StatusBadge } from '@/components/patterns/status-badge';
import { WorkflowPanel } from '@/components/patterns/workflow';
import { ImpactButton, LinkedRecords } from '@/components/patterns/linking';
import { Attachments } from '@/components/patterns/attachments';
import { CompetencyFormDialog } from './CompetencyFormDialog';

export function CompetencyDetailPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const { pick } = useBilingual();
  const can = useCan();
  const [editing, setEditing] = useState(false);
  const q = competencies.useOne(id);
  if (q.isLoading) return <PageLoader />;
  if (!q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const c = q.data;
  const canWrite = can(PERMISSIONS.CATALOG_WRITE);
  const editable = canWrite && EDITABLE_STATUSES.includes(c.status);
  return (
    <>
      <PageHeader
        crumbs={[{ label: t('nav.competencies'), to: '/competencies' }, { label: c.code }]}
        title={pick(c, 'title')}
        meta={
          <>
            <StatusBadge status={c.status} />
            <Badge tone="outline" className="font-mono">
              {c.code}
            </Badge>
            <Badge tone="primary">{t(`competencies.types.${c.type}`)}</Badge>
            {c.frameworkLevelLabel && <Badge>{c.frameworkLevelLabel}</Badge>}
          </>
        }
        actions={
          <>
            <ImpactButton endpoint={`/competencies/${id}/impact`} />
            {editable && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil />
                {t('common.edit')}
              </Button>
            )}
          </>
        }
      />
      {!editable && canWrite && (
        <div className="mb-5">
          <Notice>{t('common.lockedNotice', { status: t(`status.${c.status}`) })}</Notice>
        </div>
      )}
      <DetailLayout
        main={
          <>
            <Section title={t('common.details')}>
              <KeyValue
                items={[
                  {
                    label: t('common.descriptionEn'),
                    value: <span dir="ltr">{c.descriptionEn || '—'}</span>,
                  },
                  {
                    label: t('common.descriptionAr'),
                    value: <span dir="rtl">{c.descriptionAr || '—'}</span>,
                  },
                  {
                    label: t('competencies.criteriaEn'),
                    value: <span dir="ltr">{c.performanceCriteriaEn || '—'}</span>,
                  },
                  {
                    label: t('competencies.criteriaAr'),
                    value: <span dir="rtl">{c.performanceCriteriaAr || '—'}</span>,
                  },
                ]}
              />
            </Section>
            <div className="grid gap-5 md:grid-cols-2">
              <Section title={`${t('nav.occupations')} (${c.occupations?.length ?? 0})`}>
                <LinkedRecords items={c.occupations} entityType="occupation" />
              </Section>
              <Section title={`${t('nav.units')} (${c.units?.length ?? 0})`}>
                <LinkedRecords items={c.units} entityType="unit" />
              </Section>
            </div>
            <Attachments entityType="competency" entityId={c.id} canWrite={canWrite} />
          </>
        }
        aside={
          <WorkflowPanel
            entityType="competency"
            id={c.id}
            status={c.status}
            rowVersion={c.rowVersion}
            invalidate={[[...competencies.keys.all]]}
          />
        }
      />
      <CompetencyFormDialog open={editing} onOpenChange={setEditing} record={c} />
    </>
  );
}
