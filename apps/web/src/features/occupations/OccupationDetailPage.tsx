import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { Link2, Pencil, Plus } from 'lucide-react';
import { EDITABLE_STATUSES, PERMISSIONS } from '@cdms/contracts';
import type { LinkedRef } from '@cdms/contracts';
import { api } from '@/lib/api';
import { occupations } from '@/lib/resources';
import { useCan } from '@/lib/auth';
import { useBilingual } from '@/lib/format';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DetailLayout, KeyValue, PageHeader, Section } from '@/components/patterns/page';
import { ErrorState, Notice, PageLoader } from '@/components/patterns/states';
import { StatusBadge } from '@/components/patterns/status-badge';
import { WorkflowPanel } from '@/components/patterns/workflow';
import { ImpactButton, LinkedRecords, LinkPicker, ReferenceLabel } from '@/components/patterns/linking';
import { OccupationFormDialog } from './OccupationFormDialog';

export function OccupationDetailPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const { pick } = useBilingual();
  const can = useCan();
  const [editing, setEditing] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  const [linking, setLinking] = useState(false);
  const q = occupations.useOne(id);
  const ancestors = useQuery({ queryKey: ['occupations', id, 'ancestors'], queryFn: () => api.get<LinkedRef[]>(`/occupations/${id}/ancestors`) });
  const children = occupations.useList({ parentId: id, pageSize: 200, sort: 'code' });
  const inv = [occupations.keys.detail(id)];
  const link = useApiMutation({ fn: (ids: string[]) => api.post(`/occupations/${id}/competencies`, { targetIds: ids }), invalidate: inv, success: t('link.added') });
  const unlink = useApiMutation({ fn: (cid: string) => api.delete(`/occupations/${id}/competencies/${cid}`), invalidate: inv, success: t('link.removed') });
  if (q.isLoading) return <PageLoader />;
  if (!q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const o = q.data;
  const canWrite = can(PERMISSIONS.CATALOG_WRITE);
  const editable = canWrite && EDITABLE_STATUSES.includes(o.status);
  const crumbs = [{ label: t('nav.occupations'), to: '/occupations' }, ...(ancestors.data ?? []).slice(0, -1).map((a) => ({ label: a.code, to: `/occupations/${a.id}` })), { label: o.code }];
  return (
    <>
      <PageHeader crumbs={crumbs} title={pick(o, 'title')}
        meta={<><StatusBadge status={o.status} /><Badge tone="outline" className="font-mono">{o.code}</Badge><Badge tone="primary">{t(`occupations.levels.${o.level}`)}</Badge>{o.iscoCode && <Badge>ISCO {o.iscoCode}</Badge>}</>}
        actions={<>
          <ImpactButton endpoint={`/occupations/${id}/impact`} />
          {canWrite && o.level !== 'occupation' && <Button variant="outline" onClick={() => setAddingChild(true)}><Plus />{t('common.add')}</Button>}
          {editable && <Button variant="outline" onClick={() => setEditing(true)}><Pencil />{t('common.edit')}</Button>}
        </>} />
      {!editable && canWrite && <div className="mb-5"><Notice>{t('common.lockedNotice', { status: t(`status.${o.status}`) })}</Notice></div>}
      <DetailLayout
        main={<>
          <Section title={t('common.details')}>
            <KeyValue items={[
              { label: t('occupations.sector'), value: <ReferenceLabel listCode="sector" code={o.sectorCode} /> },
              { label: t('occupations.parent'), value: o.parent ? `${o.parent.code} — ${pick(o.parent, 'title')}` : '—' },
              { label: t('common.descriptionEn'), value: <span dir="ltr">{o.descriptionEn || '—'}</span> },
              { label: t('common.descriptionAr'), value: <span dir="rtl">{o.descriptionAr || '—'}</span> },
            ]} />
          </Section>
          {o.level === 'occupation' ? (
            <Section title={`${t('occupations.profile')} (${o.competencies?.length ?? 0})`} actions={editable && <Button size="sm" variant="outline" onClick={() => setLinking(true)}><Link2 />{t('occupations.addCompetencies')}</Button>}>
              <LinkedRecords items={o.competencies} entityType="competency" empty={t('occupations.noProfile')} onUnlink={editable ? (cid) => unlink.mutateAsync(cid) : undefined} />
            </Section>
          ) : (
            <Section title={`${t('occupations.children')} (${children.data?.total ?? 0})`}>
              <LinkedRecords items={children.data?.items} entityType="occupation" />
            </Section>
          )}
        </>}
        aside={<WorkflowPanel entityType="occupation" id={o.id} status={o.status} rowVersion={o.rowVersion} invalidate={[[...occupations.keys.all]]} />}
      />
      <OccupationFormDialog open={editing} onOpenChange={setEditing} record={o} />
      <OccupationFormDialog open={addingChild} onOpenChange={setAddingChild} parent={o} />
      <LinkPicker open={linking} onOpenChange={setLinking} title={t('link.title', { what: t('nav.competencies') })} endpoint="/competencies" exclude={o.competencies?.map((c) => c.id)} onConfirm={(ids) => link.mutateAsync(ids)} />
    </>
  );
}
