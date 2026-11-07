import { useState } from 'react';

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Plus } from 'lucide-react';
import { PERMISSIONS, RECORD_STATUSES, TEMPLATE_KINDS, templateSchema } from '@cdms/contracts';
import type { TemplateDto, TemplateInput } from '@cdms/contracts';
import { templates } from '@/lib/resources';
import { useCan } from '@/lib/auth';
import { useBilingual, useFormat } from '@/lib/format';
import { useListParams } from '@/hooks/use-list-params';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input, NativeSelect } from '@/components/ui/input';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader } from '@/components/patterns/page';
import { DataTable, FilterSelect, ListToolbar, SearchInput, type Column } from '@/components/patterns/data-table';
import { BilingualField, Field, FormGrid, applyServerErrors, useZodForm } from '@/components/patterns/form';
import { StatusBadge } from '@/components/patterns/status-badge';

export function TemplateFormDialog({ open, onOpenChange, record, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; record?: TemplateDto; onSaved?: (x: TemplateDto) => void }) {
  const { t } = useTranslation();
  const { register, handleSubmit, setError, formState: { errors } } = useZodForm(templateSchema, { values: record ? { code: record.code, nameEn: record.nameEn, nameAr: record.nameAr, descriptionEn: record.descriptionEn ?? '', descriptionAr: record.descriptionAr ?? '', kind: record.kind, sections: record.sections }
      : { code: '', nameEn: '', nameAr: '', kind: 'curriculum' as const, sections: [] },
  });
  const m = useApiMutation({
    fn: (v: TemplateInput) => (record ? templates.update(record.id, { ...v, sections: undefined, rowVersion: record.rowVersion }) : templates.create(v)),
    invalidate: [templates.keys.all], success: t('common.save'), toastErrors: false, onSuccess: (x) => { onOpenChange(false); onSaved?.(x); },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form noValidate className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit((v) => m.mutate(v as TemplateInput, { onError: (e) => { if (!applyServerErrors(e, setError)) setError('root', { message: e.message }); } }))}>
          <DialogHeader><DialogTitle>{record ? t('templates.edit') : t('templates.new')}</DialogTitle></DialogHeader>
          <DialogBody>
            {errors.root && <p role="alert" className="mb-4 rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">{errors.root.message}</p>}
            <FormGrid>
              <Field label={t('common.code')} required error={errors.code?.message}><Input dir="ltr" className="font-mono uppercase" {...register('code')} /></Field>
              <Field label={t('templates.kind')} required><NativeSelect {...register('kind')}>{TEMPLATE_KINDS.map((k) => <option key={k} value={k}>{t(`templates.kinds.${k}`)}</option>)}</NativeSelect></Field>
              <BilingualField base="name" labelEn={t('common.nameEn')} labelAr={t('common.nameAr')} register={register} errors={errors} required />
              <BilingualField base="description" labelEn={t('common.descriptionEn')} labelAr={t('common.descriptionAr')} register={register} errors={errors} multiline rows={2} />
            </FormGrid>
          </DialogBody>
          <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button><Button type="submit" loading={m.isPending}>{t('common.save')}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TemplatesPage() {
  const { t } = useTranslation();
  const { pick } = useBilingual();
  const f = useFormat();
  const can = useCan();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const { params, set, toggleSort } = useListParams({ sort: 'code' });
  const q = templates.useList(params);
  const columns: Column<TemplateDto>[] = [
    { key: 'name', header: t('common.name'), sortKey: 'nameEn', cell: (x) => <span className="flex flex-col"><span>{pick(x, 'name')}</span><span className="font-mono text-xs font-normal text-muted-foreground">{x.code}</span></span> },
    { key: 'kind', header: t('templates.kind'), cell: (x) => <Badge tone="primary">{t(`templates.kinds.${x.kind}`)}</Badge> },
    { key: 'sections', header: t('templates.sections'), cell: (x) => <span className="tabular">{f.number(x.sections.length)}</span> },
    { key: 'usage', header: t('nav.curricula'), cell: (x) => <span className="tabular">{f.number(x.usageCount ?? 0)}</span>, hideOnMobile: true },
    { key: 'status', header: t('common.status'), sortKey: 'status', cell: (x) => <StatusBadge status={x.status} /> },
  ];
  return (
    <>
      <PageHeader title={t('templates.title')} description={t('templates.subtitle')} actions={can(PERMISSIONS.TEMPLATE_WRITE) && <Button onClick={() => setCreating(true)}><Plus />{t('templates.new')}</Button>} />
      <Card>
        <ListToolbar>
          <SearchInput value={params.q} onChange={(v) => set({ q: v })} />
          <FilterSelect label={t('templates.kind')} value={params.kind as string} onChange={(v) => set({ kind: v })} options={TEMPLATE_KINDS.map((k) => ({ value: k, label: t(`templates.kinds.${k}`) }))} />
          <FilterSelect label={t('common.status')} value={params.status as string} onChange={(v) => set({ status: v })} options={RECORD_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))} />
        </ListToolbar>
        <DataTable caption={t('templates.title')} columns={columns} data={q.data} loading={q.isLoading} error={q.error} rowKey={(x) => x.id} rowHref={(x) => `/templates/${x.id}`}
          sort={{ key: params.sort, order: params.order, onSort: toggleSort }} page={{ onPage: (p) => set({ page: p }, false) }} />
      </Card>
      <TemplateFormDialog open={creating} onOpenChange={setCreating} onSaved={(x) => navigate(`/templates/${x.id}`)} />
    </>
  );
}
