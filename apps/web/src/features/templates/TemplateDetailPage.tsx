import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { EDITABLE_STATUSES, PERMISSIONS } from '@cdms/contracts';
import type { TemplateDto, TemplateSection } from '@cdms/contracts';
import { templates } from '@/lib/resources';
import { useCan } from '@/lib/auth';
import { useBilingual } from '@/lib/format';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/checkbox';
import { DetailLayout, PageHeader, Section } from '@/components/patterns/page';
import { EmptyState, ErrorState, Notice, PageLoader } from '@/components/patterns/states';
import { StatusBadge } from '@/components/patterns/status-badge';
import { WorkflowPanel } from '@/components/patterns/workflow';
import { ImpactButton } from '@/components/patterns/linking';
import { Field } from '@/components/patterns/form';
import { TemplateFormDialog } from './TemplatesPage';

/** Template section builder: ordered, bilingual sections with guidance and a required flag. */
export function TemplateDetailPage() {
  const { id = '' } = useParams();
  const q = templates.useOne(id);
  if (q.isLoading) return <PageLoader />;
  if (!q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  // Re-mount on every server version so the local section draft starts from saved data.
  return <TemplateDetail key={q.data.rowVersion} x={q.data} />;
}

function TemplateDetail({ x }: { x: TemplateDto }) {
  const id = x.id;
  const { t } = useTranslation();
  const { pick, isAr } = useBilingual();
  const can = useCan();
  const [editing, setEditing] = useState(false);
  const [sections, setSections] = useState<TemplateSection[]>(x.sections);
  const save = useApiMutation({
    fn: () => templates.update(id, { sections, rowVersion: x.rowVersion }),
    invalidate: [templates.keys.detail(id)],
    success: t('common.save'),
  });
  const canWrite = can(PERMISSIONS.TEMPLATE_WRITE);
  const editable = canWrite && EDITABLE_STATUSES.includes(x.status);
  const dirty = JSON.stringify(sections) !== JSON.stringify(x.sections);
  const upd = (i: number, p: Partial<TemplateSection>) =>
    setSections((s) => s.map((v, j) => (j === i ? { ...v, ...p } : v)));
  const move = (i: number, d: number) =>
    setSections((s) => {
      const c = [...s];
      const j = i + d;
      if (j < 0 || j >= c.length) return s;
      [c[i], c[j]] = [c[j]!, c[i]!];
      return c;
    });

  return (
    <>
      <PageHeader
        crumbs={[{ label: t('nav.templates'), to: '/templates' }, { label: x.code }]}
        title={pick(x, 'name')}
        meta={
          <>
            <StatusBadge status={x.status} />
            <Badge tone="outline" className="font-mono">
              {x.code}
            </Badge>
            <Badge tone="primary">{t(`templates.kinds.${x.kind}`)}</Badge>
            <Badge>{t('templates.usage', { count: x.usageCount ?? 0 })}</Badge>
          </>
        }
        actions={
          <>
            <ImpactButton endpoint={`/templates/${id}/impact`} />
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
          <Notice>{t('common.lockedNotice', { status: t(`status.${x.status}`) })}</Notice>
        </div>
      )}
      <DetailLayout
        main={
          <Section
            title={`${t('templates.sections')} (${sections.length})`}
            description={pick(x, 'description') || undefined}
            actions={
              editable && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setSections((s) => [
                        ...s,
                        {
                          key: `section_${s.length + 1}`,
                          titleEn: '',
                          titleAr: '',
                          guidanceEn: '',
                          guidanceAr: '',
                          required: false,
                        },
                      ])
                    }
                  >
                    <Plus />
                    {t('templates.addSection')}
                  </Button>
                  <Button
                    size="sm"
                    disabled={!dirty}
                    loading={save.isPending}
                    onClick={() => save.mutate()}
                  >
                    {t('common.saveChanges')}
                  </Button>
                </>
              )
            }
          >
            {!sections.length ? (
              <EmptyState title={t('templates.noSections')} />
            ) : (
              <ol className="flex flex-col gap-3">
                {sections.map((s, i) => (
                  <li key={i} className="rounded-md border p-4">
                    {editable ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label={t('templates.sectionKey')} required hint="a-z, 0-9, _">
                          <Input
                            dir="ltr"
                            className="font-mono"
                            value={s.key}
                            onChange={(e) =>
                              upd(i, {
                                key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
                              })
                            }
                          />
                        </Field>
                        <div className="flex items-end justify-between gap-2">
                          <label className="flex items-center gap-2 text-sm">
                            <Switch
                              checked={s.required}
                              onCheckedChange={(v) => upd(i, { required: v })}
                            />
                            {t('templates.requiredSection')}
                          </label>
                          <div className="flex">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={t('templates.moveUp')}
                              onClick={() => move(i, -1)}
                            >
                              <ArrowUp />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={t('templates.moveDown')}
                              onClick={() => move(i, 1)}
                            >
                              <ArrowDown />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={t('common.remove')}
                              onClick={() => setSections((ss) => ss.filter((_, j) => j !== i))}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </div>
                        <Field label={t('common.titleEn')} required>
                          <Input
                            dir="ltr"
                            value={s.titleEn}
                            onChange={(e) => upd(i, { titleEn: e.target.value })}
                          />
                        </Field>
                        <Field label={t('common.titleAr')} required>
                          <Input
                            dir="rtl"
                            className="font-arabic"
                            value={s.titleAr}
                            onChange={(e) => upd(i, { titleAr: e.target.value })}
                          />
                        </Field>
                        <Field label={t('templates.guidanceEn')}>
                          <Textarea
                            dir="ltr"
                            rows={2}
                            value={s.guidanceEn ?? ''}
                            onChange={(e) => upd(i, { guidanceEn: e.target.value })}
                          />
                        </Field>
                        <Field label={t('templates.guidanceAr')}>
                          <Textarea
                            dir="rtl"
                            rows={2}
                            className="font-arabic"
                            value={s.guidanceAr ?? ''}
                            onChange={(e) => upd(i, { guidanceAr: e.target.value })}
                          />
                        </Field>
                      </div>
                    ) : (
                      <div>
                        <p className="flex items-center gap-2 font-medium">
                          <span className="text-muted-foreground tabular">{i + 1}.</span>
                          {isAr ? s.titleAr : s.titleEn}
                          {s.required && <Badge tone="warning">{t('common.required')}</Badge>}
                          <code className="ms-auto text-xs text-muted-foreground">{s.key}</code>
                        </p>
                        {(s.guidanceEn || s.guidanceAr) && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {isAr ? s.guidanceAr || s.guidanceEn : s.guidanceEn || s.guidanceAr}
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Section>
        }
        aside={
          <WorkflowPanel
            entityType="template"
            id={x.id}
            status={x.status}
            rowVersion={x.rowVersion}
            invalidate={[[...templates.keys.all]]}
          />
        }
      />
      <TemplateFormDialog open={editing} onOpenChange={setEditing} record={x} />
    </>
  );
}
