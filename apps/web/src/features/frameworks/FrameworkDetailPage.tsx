import { useState } from 'react';

import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { EDITABLE_STATUSES, frameworkLevelSchema, PERMISSIONS } from '@cdms/contracts';
import type { FrameworkLevelDto, FrameworkLevelInput } from '@cdms/contracts';
import { api } from '@/lib/api';
import { frameworks } from '@/lib/resources';
import { useCan } from '@/lib/auth';
import { useBilingual } from '@/lib/format';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DetailLayout, PageHeader, Section } from '@/components/patterns/page';
import { ErrorState, Notice, PageLoader } from '@/components/patterns/states';
import { StatusBadge } from '@/components/patterns/status-badge';
import { WorkflowPanel } from '@/components/patterns/workflow';
import {
  BilingualField,
  Field,
  FormGrid,
  applyServerErrors,
  useZodForm,
} from '@/components/patterns/form';
import { ConfirmDialog } from '@/components/patterns/confirm';
import { FrameworkFormDialog } from './FrameworksPage';

function LevelDialog({
  frameworkId,
  record,
  open,
  onOpenChange,
  nextLevel,
}: {
  frameworkId: string;
  record?: FrameworkLevelDto;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  nextLevel: number;
}) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useZodForm(frameworkLevelSchema, {
    values: record
      ? {
          level: record.level,
          nameEn: record.nameEn,
          nameAr: record.nameAr,
          knowledgeEn: record.knowledgeEn ?? '',
          knowledgeAr: record.knowledgeAr ?? '',
          skillsEn: record.skillsEn ?? '',
          skillsAr: record.skillsAr ?? '',
          autonomyEn: record.autonomyEn ?? '',
          autonomyAr: record.autonomyAr ?? '',
        }
      : { level: nextLevel, nameEn: '', nameAr: '' },
  });
  const m = useApiMutation({
    fn: (v: FrameworkLevelInput) =>
      record
        ? api.patch(`/frameworks/levels/${record.id}`, { ...v, rowVersion: record.rowVersion })
        : api.post(`/frameworks/${frameworkId}/levels`, v),
    invalidate: [frameworks.keys.detail(frameworkId), ['frameworks', 'levels']],
    success: t('common.save'),
    toastErrors: false,
    onSuccess: () => onOpenChange(false),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <form
          noValidate
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={handleSubmit((v) =>
            m.mutate(v as FrameworkLevelInput, {
              onError: (e) => {
                if (!applyServerErrors(e, setError)) setError('root', { message: e.message });
              },
            }),
          )}
        >
          <DialogHeader>
            <DialogTitle>{record ? t('common.edit') : t('frameworks.addLevel')}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {errors.root && (
              <p
                role="alert"
                className="mb-4 rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive"
              >
                {errors.root.message}
              </p>
            )}
            <FormGrid>
              <Field label={t('frameworks.level')} required error={errors.level?.message}>
                <Input
                  type="number"
                  min={0}
                  max={20}
                  {...register('level', { valueAsNumber: true })}
                />
              </Field>
              <div />
              <BilingualField
                base="name"
                labelEn={t('common.nameEn')}
                labelAr={t('common.nameAr')}
                register={register}
                errors={errors}
                required
              />
              <BilingualField
                base="knowledge"
                labelEn={t('frameworks.knowledgeEn')}
                labelAr={t('frameworks.knowledgeAr')}
                register={register}
                errors={errors}
                multiline
                rows={2}
              />
              <BilingualField
                base="skills"
                labelEn={t('frameworks.skillsEn')}
                labelAr={t('frameworks.skillsAr')}
                register={register}
                errors={errors}
                multiline
                rows={2}
              />
              <BilingualField
                base="autonomy"
                labelEn={t('frameworks.autonomyEn')}
                labelAr={t('frameworks.autonomyAr')}
                register={register}
                errors={errors}
                multiline
                rows={2}
              />
            </FormGrid>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={m.isPending}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function FrameworkDetailPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const { pick } = useBilingual();
  const can = useCan();
  const q = frameworks.useOne(id);
  const [editing, setEditing] = useState(false);
  const [level, setLevel] = useState<FrameworkLevelDto | 'new' | null>(null);
  const del = useApiMutation({
    fn: (lid: string) => api.delete(`/frameworks/levels/${lid}`),
    invalidate: [frameworks.keys.detail(id)],
  });
  if (q.isLoading) return <PageLoader />;
  if (!q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const f = q.data;
  const canWrite = can(PERMISSIONS.CATALOG_WRITE);
  const editable = canWrite && EDITABLE_STATUSES.includes(f.status);
  const levels = f.levels ?? [];
  return (
    <>
      <PageHeader
        crumbs={[{ label: t('nav.frameworks'), to: '/frameworks' }, { label: f.code }]}
        title={pick(f, 'name')}
        meta={
          <>
            <StatusBadge status={f.status} />
            <Badge tone="outline" className="font-mono">
              {f.code}
            </Badge>
            <Badge>
              {t('frameworks.versionLabel')} {f.versionLabel}
            </Badge>
          </>
        }
        actions={
          editable && (
            <>
              <Button variant="outline" onClick={() => setLevel('new')}>
                <Plus />
                {t('frameworks.addLevel')}
              </Button>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil />
                {t('common.edit')}
              </Button>
            </>
          )
        }
      />
      {!editable && canWrite && (
        <div className="mb-5">
          <Notice>{t('common.lockedNotice', { status: t(`status.${f.status}`) })}</Notice>
        </div>
      )}
      <DetailLayout
        main={
          <Section
            title={`${t('frameworks.levels')} (${levels.length})`}
            description={f.description ?? undefined}
          >
            <ol className="flex flex-col gap-3">
              {levels.map((l) => (
                <li key={l.id} className="rounded-md border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="flex items-center gap-2 font-semibold">
                      <span className="grid size-7 place-items-center rounded-full bg-primary text-xs text-primary-foreground tabular">
                        {l.level}
                      </span>
                      {pick(l, 'name')}
                    </h3>
                    {editable && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`${t('common.edit')} L${l.level}`}
                          onClick={() => setLevel(l)}
                        >
                          <Pencil />
                        </Button>
                        <ConfirmDialog
                          title={`${t('common.delete')} L${l.level}?`}
                          onConfirm={() => del.mutateAsync(l.id)}
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`${t('common.delete')} L${l.level}`}
                            >
                              <Trash2 />
                            </Button>
                          }
                        />
                      </div>
                    )}
                  </div>
                  <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                    {(['knowledge', 'skills', 'autonomy'] as const).map((k) => (
                      <div key={k}>
                        <dt className="text-xs font-medium text-muted-foreground">
                          {t(`frameworks.${k}`)}
                        </dt>
                        <dd className="mt-1">{pick(l, k) || '—'}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ol>
          </Section>
        }
        aside={
          <WorkflowPanel
            entityType="framework"
            id={f.id}
            status={f.status}
            rowVersion={f.rowVersion}
            invalidate={[[...frameworks.keys.all]]}
          />
        }
      />
      <FrameworkFormDialog open={editing} onOpenChange={setEditing} record={f} />
      {level && (
        <LevelDialog
          frameworkId={id}
          open
          onOpenChange={(o) => !o && setLevel(null)}
          record={level === 'new' ? undefined : level}
          nextLevel={(levels.at(-1)?.level ?? 0) + 1}
        />
      )}
    </>
  );
}
