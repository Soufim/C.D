import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ChevronDown } from 'lucide-react';
import type { AuditEntryDto } from '@cdms/contracts';
import { useFormat } from '@/lib/format';
import { entityPath, entityLabelKey } from '@/lib/entities';
import { useListParams } from '@/hooks/use-list-params';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { PageHeader } from '@/components/patterns/page';
import { FilterSelect, ListToolbar, Pagination } from '@/components/patterns/data-table';
import { ErrorState } from '@/components/patterns/states';
import { useAudit } from './api';

const fmt = (v: unknown) => (v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

function Changes({ entry }: { entry: AuditEntryDto }) {
  const { t } = useTranslation();
  const rows = Object.entries(entry.changes ?? {});
  return (
    <div className="flex flex-col gap-2 text-xs">
      {rows.length > 0 && (
        <table className="w-full">
          <thead><tr className="text-muted-foreground"><th className="py-1 text-start">{t('admin.field')}</th><th className="text-start">{t('admin.before')}</th><th className="text-start">{t('admin.after')}</th></tr></thead>
          <tbody>{rows.map(([k, v]) => <tr key={k} className="border-t align-top"><td className="py-1 pe-3 font-mono">{k}</td><td className="max-w-xs break-all pe-3 text-destructive">{fmt(v.from)}</td><td className="max-w-xs break-all text-success">{fmt(v.to)}</td></tr>)}</tbody>
        </table>
      )}
      {entry.metadata && <pre className="overflow-x-auto rounded bg-muted p-2" dir="ltr">{JSON.stringify(entry.metadata, null, 2)}</pre>}
    </div>
  );
}

/** Append-only audit trail viewer with filters and field-level diffs. */
export function AuditPage() {
  const { t } = useTranslation();
  const f = useFormat();
  const { params, set } = useListParams({ pageSize: 50 });
  const q = useAudit(params);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <PageHeader title={t('admin.audit')} description={t('admin.auditSubtitle')} />
      <Card>
        <ListToolbar>
          <FilterSelect label={t('admin.entity')} value={params.entityType as string} onChange={(v) => set({ entityType: v })}
            options={['curriculum', 'unit', 'competency', 'occupation', 'framework', 'template', 'institution', 'user', 'role', 'reference_item', 'file'].map((e) => ({ value: e, label: t(entityLabelKey(e)) }))} />
          <Input aria-label={t('admin.action')} placeholder={`${t('admin.action')} (auth.login…)`} className="h-9 sm:w-56" defaultValue={params.action as string} onKeyDown={(e) => e.key === 'Enter' && set({ action: (e.target as HTMLInputElement).value || undefined })} dir="ltr" />
        </ListToolbar>
        {q.error ? <ErrorState error={q.error} /> : (
          <Table>
            <caption className="sr-only">{t('admin.audit')}</caption>
            <THead><TR><TH>{t('admin.when')}</TH><TH>{t('admin.actor')}</TH><TH>{t('admin.action')}</TH><TH>{t('admin.entity')}</TH><TH>{t('admin.outcome')}</TH><TH><span className="sr-only">{t('admin.changes')}</span></TH></TR></THead>
            <TBody>
              {q.data?.items.map((e) => {
                const to = entityPath(e.entityType, e.entityId);
                const expandable = !!(e.changes && Object.keys(e.changes).length) || !!e.metadata;
                return (
                  <Fragment key={e.id}>
                    <TR>
                      <TD className="whitespace-nowrap text-xs tabular"><time dateTime={e.occurredAt}>{f.dateTime(e.occurredAt)}</time></TD>
                      <TD className="text-sm">{e.actorName ?? '—'}{e.ip && <span className="block font-mono text-[11px] text-muted-foreground">{e.ip}</span>}</TD>
                      <TD><code className="text-xs">{e.action}</code></TD>
                      <TD className="text-sm">{e.entityType ? (to ? <Link to={to} className="text-primary hover:underline">{t(entityLabelKey(e.entityType))}</Link> : t(entityLabelKey(e.entityType))) : '—'}</TD>
                      <TD><Badge tone={e.outcome === 'success' ? 'success' : 'danger'}>{t(`admin.${e.outcome}`)}</Badge></TD>
                      <TD>{expandable && <button type="button" aria-expanded={open === e.id} aria-label={t('admin.changes')} onClick={() => setOpen(open === e.id ? null : e.id)} className="rounded p-1 hover:bg-muted"><ChevronDown className={cn('size-4 transition-transform', open === e.id && 'rotate-180')} /></button>}</TD>
                    </TR>
                    {open === e.id && <TR className="bg-muted/30 hover:bg-muted/30"><TD colSpan={6}><Changes entry={e} /></TD></TR>}
                  </Fragment>
                );
              })}
            </TBody>
          </Table>
        )}
        {q.data && <Pagination data={q.data} onPage={(p) => set({ page: p }, false)} />}
      </Card>
    </>
  );
}
