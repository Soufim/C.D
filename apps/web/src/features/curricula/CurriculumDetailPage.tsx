import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { CopyPlus, FileJson, MoreHorizontal, Pencil, Printer, Trash2 } from 'lucide-react';
import { EDITABLE_STATUSES, PERMISSIONS } from '@cdms/contracts';
import { useCan } from '@/lib/auth';
import { useBilingual, useFormat } from '@/lib/format';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/menu';
import { DetailLayout, KeyValue, PageHeader, Section } from '@/components/patterns/page';
import { ErrorState, Notice, PageLoader } from '@/components/patterns/states';
import { StatusBadge } from '@/components/patterns/status-badge';
import { WorkflowPanel } from '@/components/patterns/workflow';
import { Attachments } from '@/components/patterns/attachments';
import { ReferenceLabel } from '@/components/patterns/linking';
import { ConfirmDialog } from '@/components/patterns/confirm';
import { curriculaApi, curriculaKeys, useCurriculum, useVersions } from './api';
import { CurriculumFormDialog } from './CurriculumFormDialog';
import { StructureEditor } from './StructureEditor';
import { SectionsEditor } from './SectionsEditor';
import { CoveragePanel } from './CoveragePanel';

export function CurriculumDetailPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const { pick } = useBilingual();
  const f = useFormat();
  const can = useCan();
  const navigate = useNavigate();
  const q = useCurriculum(id);
  const versions = useVersions(id);
  const [editing, setEditing] = useState(false);
  const [versioning, setVersioning] = useState(false);
  const [reason, setReason] = useState('');
  const newVersion = useApiMutation({
    fn: () => curriculaApi.newVersion(id, reason || undefined), invalidate: [curriculaKeys.all],
    success: t('workflow.new_version'), onSuccess: (c) => { setVersioning(false); navigate(`/curricula/${c.id}`); },
  });
  const remove = useApiMutation({ fn: () => curriculaApi.remove(id), invalidate: [curriculaKeys.all, ['dashboard']], onSuccess: () => navigate('/curricula') });

  if (q.isLoading) return <PageLoader />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const c = q.data;
  const canWrite = can(PERMISSIONS.CURRICULUM_WRITE);
  const editable = canWrite && EDITABLE_STATUSES.includes(c.status);
  const exportJson = async () => {
    const doc = await curriculaApi.export(id);
    const url = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }));
    Object.assign(document.createElement('a'), { href: url, download: `${c.code}-v${c.version}.json` }).click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: t('nav.curricula'), to: '/curricula' }, { label: c.code }]}
        title={pick(c, 'title')}
        meta={<><StatusBadge status={c.status} /><Badge tone="outline" className="font-mono">{c.code} · v{c.version}</Badge>{c.frameworkLevelLabel && <Badge tone="primary">{c.frameworkLevelLabel}</Badge>}</>}
        actions={
          <>
            {editable && <Button variant="outline" onClick={() => setEditing(true)}><Pencil />{t('common.edit')}</Button>}
            {canWrite && ['published', 'approved', 'archived'].includes(c.status) && <Button variant="outline" onClick={() => setVersioning(true)}><CopyPlus />{t('curricula.newVersion')}</Button>}
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label={t('common.moreActions')}><MoreHorizontal /></Button></DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem asChild><Link to={`/curricula/${id}/print`} target="_blank"><Printer />{t('curricula.printView')}</Link></DropdownMenuItem>
                {can(PERMISSIONS.EXPORT_RUN) && <DropdownMenuItem onSelect={() => void exportJson()}><FileJson />{t('curricula.exportJson')}</DropdownMenuItem>}
                {editable && c.status === 'draft' && (<><DropdownMenuSeparator />
                  <ConfirmDialog title={t('curricula.deleteDraft')} body={t('curricula.deleteBody')} confirmLabel={t('common.delete')} onConfirm={() => remove.mutateAsync()}
                    trigger={<DropdownMenuItem destructive onSelect={(e) => e.preventDefault()}><Trash2 />{t('curricula.deleteDraft')}</DropdownMenuItem>} /></>)}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
      {!EDITABLE_STATUSES.includes(c.status) && canWrite && <div className="mb-5"><Notice tone="info">{t('common.lockedNotice', { status: t(`status.${c.status}`) })}</Notice></div>}
      <DetailLayout
        main={
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">{t('common.overview')}</TabsTrigger>
              <TabsTrigger value="structure">{t('curricula.structure')} <Badge>{c.totals?.units ?? 0}</Badge></TabsTrigger>
              <TabsTrigger value="coverage">{t('curricula.coverage')}</TabsTrigger>
              <TabsTrigger value="sections">{t('curricula.sections')}</TabsTrigger>
              <TabsTrigger value="files">{t('common.files')}</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="flex flex-col gap-5">
              <Section title={t('common.details')}>
                <KeyValue items={[
                  { label: t('curricula.summaryEn'), value: <span dir="ltr">{c.summaryEn || '—'}</span>, full: true },
                  { label: t('curricula.summaryAr'), value: <span dir="rtl">{c.summaryAr || '—'}</span>, full: true },
                  { label: t('curricula.occupation'), value: c.occupation ? <Link className="text-primary hover:underline" to={`/occupations/${c.occupation.id}`}>{c.occupation.code} — {pick(c.occupation, 'title')}</Link> : '—' },
                  { label: t('curricula.frameworkLevel'), value: c.frameworkLevelLabel },
                  { label: t('curricula.institution'), value: pick({ nameEn: c.institutionNameEn, nameAr: c.institutionNameAr }, 'name') || '—' },
                  { label: t('curricula.programType'), value: <ReferenceLabel listCode="program_type" code={c.programTypeCode} /> },
                  { label: t('curricula.duration'), value: f.number(c.durationMonths) },
                  { label: t('curricula.effectiveFrom'), value: f.date(c.effectiveFrom) },
                  { label: t('curricula.totalHours'), value: c.totals ? `${f.number(c.totals.theoryHours + c.totals.practicalHours)} (${t('curricula.theory')} ${f.number(c.totals.theoryHours)} / ${t('curricula.practical')} ${f.number(c.totals.practicalHours)})` : '—' },
                  { label: t('common.credits'), value: c.totals ? f.number(c.totals.creditHours, 1) : '—' },
                ]} />
              </Section>
            </TabsContent>
            <TabsContent value="structure"><StructureEditor curriculum={c} editable={editable} /></TabsContent>
            <TabsContent value="coverage"><CoveragePanel curriculum={c} /></TabsContent>
            <TabsContent value="sections"><SectionsEditor curriculum={c} editable={editable} /></TabsContent>
            <TabsContent value="files"><Attachments entityType="curriculum" entityId={c.id} canWrite={canWrite} /></TabsContent>
          </Tabs>
        }
        aside={
          <>
            <WorkflowPanel entityType="curriculum" id={c.id} status={c.status} rowVersion={c.rowVersion} invalidate={[[...curriculaKeys.all]]} />
            <Section title={t('curricula.versions')}>
              <ul className="flex flex-col gap-1">
                {versions.data?.map((v) => (
                  <li key={v.id}>
                    <Link to={`/curricula/${v.id}`} aria-current={v.id === id ? 'page' : undefined} className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted aria-[current=page]:bg-secondary">
                      <span className="font-mono">v{v.version}</span><StatusBadge status={v.status as never} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          </>
        }
      />
      <CurriculumFormDialog open={editing} onOpenChange={setEditing} record={c} />
      <Dialog open={versioning} onOpenChange={setVersioning}>
        <DialogContent size="sm">
          <DialogHeader><DialogTitle>{t('curricula.newVersion')}</DialogTitle><DialogDescription>{t('curricula.newVersionBody')}</DialogDescription></DialogHeader>
          <DialogBody><label className="flex flex-col gap-1.5 text-sm font-medium">{t('common.reason')}<Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} /></label></DialogBody>
          <DialogFooter><Button variant="outline" onClick={() => setVersioning(false)}>{t('common.cancel')}</Button><Button loading={newVersion.isPending} onClick={() => newVersion.mutate()}>{t('common.create')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
