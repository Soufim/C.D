import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AlertCircle, AlertTriangle, CheckCircle2, History } from 'lucide-react';
import { availableActions, PERMISSIONS } from '@cdms/contracts';
import type { Permission, RecordStatus, ValidationIssue, WorkflowAction, WorkflowEntityType, WorkflowEventDto } from '@cdms/contracts';
import { api } from '@/lib/api';
import { useCan } from '@/lib/auth';
import { useBilingual, useFormat } from '@/lib/format';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Field } from './form';
import { Section } from './page';
import { StatusBadge } from './status-badge';

const P = PERMISSIONS;
const catalog: Record<WorkflowAction, Permission> = { submit: P.CATALOG_WRITE, return: P.CATALOG_REVIEW, approve: P.CATALOG_APPROVE, publish: P.CATALOG_APPROVE, archive: P.CATALOG_APPROVE, restore: P.CATALOG_WRITE };
/** Mirrors api/src/modules/workflow/workflow.registry.ts (UI hint only; backend enforces). */
const ACTION_PERMS: Record<WorkflowEntityType, Record<WorkflowAction, Permission>> = {
  curriculum: { submit: P.CURRICULUM_WRITE, return: P.CURRICULUM_REVIEW, approve: P.CURRICULUM_APPROVE, publish: P.CURRICULUM_PUBLISH, archive: P.CURRICULUM_PUBLISH, restore: P.CURRICULUM_WRITE },
  unit: catalog, competency: catalog, occupation: catalog, framework: catalog,
  template: { submit: P.TEMPLATE_WRITE, return: P.TEMPLATE_APPROVE, approve: P.TEMPLATE_APPROVE, publish: P.TEMPLATE_APPROVE, archive: P.TEMPLATE_APPROVE, restore: P.TEMPLATE_WRITE },
};

export const workflowKeys = { history: (t: string, id: string) => ['workflow', t, id, 'history'] as const };

/**
 * Status + available transitions + readiness checks + history for any controlled record.
 * Place it in the aside column of every detail page of a workflow entity.
 */
export function WorkflowPanel({ entityType, id, status, rowVersion, invalidate }: { entityType: WorkflowEntityType; id: string; status: RecordStatus; rowVersion: number; invalidate: readonly unknown[][] }) {
  const { t } = useTranslation();
  const can = useCan();
  const actions = availableActions(status).filter((a) => can(ACTION_PERMS[entityType][a]));
  const [action, setAction] = useState<WorkflowAction | null>(null);

  return (
    <Section title={t('workflow.title')}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t('common.status')}</span>
          <StatusBadge status={status} />
        </div>
        {actions.length ? (
          <div className="flex flex-col gap-2">
            {actions.map((a) => (
              <Button key={a} variant={a === 'approve' || a === 'publish' || a === 'submit' ? 'default' : a === 'return' || a === 'archive' ? 'outline' : 'secondary'} onClick={() => setAction(a)} className="w-full justify-center">
                {t(`workflow.${a}`)}
              </Button>
            ))}
            {actions.includes('approve') && <p className="text-xs text-muted-foreground">{t('workflow.fourEyes')}</p>}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('workflow.noActions')}</p>
        )}
        <WorkflowHistory entityType={entityType} id={id} />
      </div>
      {action && (
        <TransitionDialog entityType={entityType} id={id} action={action} rowVersion={rowVersion} invalidate={[...invalidate, [...workflowKeys.history(entityType, id)]]} onClose={() => setAction(null)} />
      )}
    </Section>
  );
}

function TransitionDialog({ entityType, id, action, rowVersion, invalidate, onClose }: { entityType: WorkflowEntityType; id: string; action: WorkflowAction; rowVersion: number; invalidate: unknown[][]; onClose: () => void }) {
  const { t } = useTranslation();
  const { isAr } = useBilingual();
  const [comment, setComment] = useState('');
  const checks = useQuery({
    queryKey: ['workflow', entityType, id, 'check', action, rowVersion],
    queryFn: () => api.get<ValidationIssue[]>(`/workflow/${entityType}/${id}/check?action=${action}`),
  });
  const errors = checks.data?.filter((i) => i.severity === 'error') ?? [];
  const warnings = checks.data?.filter((i) => i.severity === 'warning') ?? [];
  const m = useApiMutation({
    fn: () => api.post<{ status: RecordStatus }>(`/workflow/${entityType}/${id}/transition`, { action, comment: comment || undefined, rowVersion }),
    invalidate: [...invalidate, ['dashboard'], ['reviews']],
    success: (d) => t('workflow.success', { status: t(`status.${d.status}`) }),
    onSuccess: onClose,
  });
  const needsComment = action === 'return';
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t('workflow.confirmTitle', { action: t(`workflow.${action}`) })}</DialogTitle>
          <DialogDescription>{t('workflow.readiness')}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {checks.isLoading ? <Skeleton className="h-10" /> : (
            <div className="flex flex-col gap-2 text-sm" aria-live="polite">
              {!errors.length && !warnings.length && <p className="flex items-center gap-2 text-success"><CheckCircle2 className="size-4" aria-hidden />{t('workflow.ready')}</p>}
              {errors.length > 0 && (
                <div>
                  <p className="mb-1 font-medium text-destructive">{t('workflow.errors')}</p>
                  <ul className="flex flex-col gap-1">{errors.map((e) => <li key={e.code + e.messageEn} className="flex gap-2"><AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />{isAr ? e.messageAr : e.messageEn}</li>)}</ul>
                </div>
              )}
              {warnings.length > 0 && (
                <div>
                  <p className="mb-1 font-medium text-warning">{t('workflow.warnings')}</p>
                  <ul className="flex flex-col gap-1">{warnings.map((e) => <li key={e.code + e.messageEn} className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />{isAr ? e.messageAr : e.messageEn}</li>)}</ul>
                </div>
              )}
            </div>
          )}
          <Field label={t('common.comment')} required={needsComment} hint={needsComment ? t('workflow.commentRequired') : t('workflow.commentOptional')}>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={4000} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button loading={m.isPending} disabled={errors.length > 0 || (needsComment && !comment.trim())} onClick={() => m.mutate()}>{t(`workflow.${action}`)}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function WorkflowHistory({ entityType, id }: { entityType: WorkflowEntityType; id: string }) {
  const { t } = useTranslation();
  const f = useFormat();
  const q = useQuery({ queryKey: workflowKeys.history(entityType, id), queryFn: () => api.get<WorkflowEventDto[]>(`/workflow/${entityType}/${id}/history`) });
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><History className="size-3.5" aria-hidden />{t('common.history')}</h3>
      {q.isLoading ? <Skeleton className="h-16" /> : !q.data?.length ? <p className="text-sm text-muted-foreground">{t('workflow.historyEmpty')}</p> : (
        <ol className="relative flex flex-col gap-3 border-s ps-4">
          {q.data.map((e) => (
            <li key={e.id} className="relative text-sm">
              <span className="absolute -start-[21px] top-1.5 size-2.5 rounded-full border-2 border-card bg-primary" aria-hidden />
              <p className="font-medium">{t(`workflow.${e.action}`)} <span className="font-normal text-muted-foreground">→ {t(`status.${e.toStatus}`)}</span></p>
              <p className="text-xs text-muted-foreground">{e.actorName ?? '—'} · <time dateTime={e.occurredAt}>{f.dateTime(e.occurredAt)}</time></p>
              {e.comment && <p className="mt-1 rounded bg-muted px-2 py-1 text-xs whitespace-pre-line">{e.comment}</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
