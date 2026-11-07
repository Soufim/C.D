import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { Link2, Pencil } from 'lucide-react';
import { EDITABLE_STATUSES, PERMISSIONS } from '@cdms/contracts';
import { api } from '@/lib/api';
import { units } from '@/lib/resources';
import { useCan } from '@/lib/auth';
import { useBilingual, useFormat } from '@/lib/format';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DetailLayout, KeyValue, PageHeader, Section } from '@/components/patterns/page';
import { ErrorState, Notice, PageLoader } from '@/components/patterns/states';
import { StatusBadge } from '@/components/patterns/status-badge';
import { WorkflowPanel } from '@/components/patterns/workflow';
import { ImpactButton, LinkedRecords, LinkPicker } from '@/components/patterns/linking';
import { Attachments } from '@/components/patterns/attachments';
import { UnitFormDialog } from './UnitFormDialog';

export function UnitDetailPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const { pick } = useBilingual();
  const f = useFormat();
  const can = useCan();
  const [editing, setEditing] = useState(false);
  const [linking, setLinking] = useState(false);
  const q = units.useOne(id);
  const inv = [units.keys.detail(id), ['competencies']];
  const link = useApiMutation({
    fn: (ids: string[]) => api.post(`/units/${id}/competencies`, { targetIds: ids }),
    invalidate: inv,
    success: t('link.added'),
  });
  const unlink = useApiMutation({
    fn: (cid: string) => api.delete(`/units/${id}/competencies/${cid}`),
    invalidate: inv,
    success: t('link.removed'),
  });
  if (q.isLoading) return <PageLoader />;
  if (!q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const u = q.data;
  const canWrite = can(PERMISSIONS.CATALOG_WRITE);
  const editable = canWrite && EDITABLE_STATUSES.includes(u.status);
  return (
    <>
      <PageHeader
        crumbs={[{ label: t('nav.units'), to: '/units' }, { label: u.code }]}
        title={pick(u, 'title')}
        meta={
          <>
            <StatusBadge status={u.status} />
            <Badge tone="outline" className="font-mono">
              {u.code}
            </Badge>
            {u.frameworkLevelLabel && <Badge tone="primary">{u.frameworkLevelLabel}</Badge>}
          </>
        }
        actions={
          <>
            <ImpactButton endpoint={`/units/${id}/impact`} />
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
          <Notice>{t('common.lockedNotice', { status: t(`status.${u.status}`) })}</Notice>
        </div>
      )}
      <DetailLayout
        main={
          <>
            <Section title={t('common.details')}>
              <KeyValue
                columns={3}
                items={[
                  { label: t('units.theoryHours'), value: f.number(u.theoryHours) },
                  { label: t('units.practicalHours'), value: f.number(u.practicalHours) },
                  { label: t('units.creditHours'), value: f.number(u.creditHours, 1) },
                  {
                    label: t('common.descriptionEn'),
                    value: <span dir="ltr">{u.descriptionEn || '—'}</span>,
                    full: true,
                  },
                  {
                    label: t('common.descriptionAr'),
                    value: <span dir="rtl">{u.descriptionAr || '—'}</span>,
                    full: true,
                  },
                  { label: t('units.assessment'), value: pick(u, 'assessment') || '—', full: true },
                ]}
              />
            </Section>
            <Section title={`${t('units.learningOutcomes')} (${u.learningOutcomes?.length ?? 0})`}>
              {!u.learningOutcomes?.length ? (
                <p className="text-sm text-muted-foreground">{t('units.noOutcomes')}</p>
              ) : (
                <ol className="flex flex-col gap-3">
                  {u.learningOutcomes.map((l) => (
                    <li
                      key={l.id}
                      className="grid gap-1 rounded-md border p-3 sm:grid-cols-[4rem_1fr_1fr] sm:gap-3"
                    >
                      <span className="font-mono text-xs font-semibold text-primary">{l.code}</span>
                      <p dir="ltr" lang="en" className="text-sm">
                        {l.textEn}
                      </p>
                      <p dir="rtl" lang="ar" className="font-arabic text-sm">
                        {l.textAr}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </Section>
            <Section
              title={`${t('units.competencies')} (${u.competencies?.length ?? 0})`}
              actions={
                editable && (
                  <Button size="sm" variant="outline" onClick={() => setLinking(true)}>
                    <Link2 />
                    {t('common.link')}
                  </Button>
                )
              }
            >
              <LinkedRecords
                items={u.competencies}
                entityType="competency"
                onUnlink={editable ? (cid) => unlink.mutateAsync(cid) : undefined}
              />
            </Section>
            <Section title={`${t('units.usedIn')} (${u.curricula?.length ?? 0})`}>
              <LinkedRecords items={u.curricula} entityType="curriculum" />
            </Section>
            <Attachments entityType="unit" entityId={u.id} canWrite={canWrite} />
          </>
        }
        aside={
          <WorkflowPanel
            entityType="unit"
            id={u.id}
            status={u.status}
            rowVersion={u.rowVersion}
            invalidate={[[...units.keys.all]]}
          />
        }
      />
      <UnitFormDialog open={editing} onOpenChange={setEditing} record={u} />
      <LinkPicker
        open={linking}
        onOpenChange={setLinking}
        title={t('link.title', { what: t('nav.competencies') })}
        endpoint="/competencies"
        exclude={u.competencies?.map((c) => c.id)}
        onConfirm={(ids) => link.mutateAsync(ids)}
      />
    </>
  );
}
