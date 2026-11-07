import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useTranslation } from 'react-i18next';
import { Pencil, Plus } from 'lucide-react';
import { PERMISSIONS, referenceItemSchema, referenceListSchema } from '@cdms/contracts';
import type { Paginated, ReferenceItemDto, ReferenceItemInput, ReferenceListDto, ReferenceListInput } from '@cdms/contracts';
import { api } from '@/lib/api';
import { useCan } from '@/lib/auth';
import { useBilingual } from '@/lib/format';
import { useListParams } from '@/hooks/use-list-params';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/checkbox';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader, Section } from '@/components/patterns/page';
import { DataTable, type Column } from '@/components/patterns/data-table';
import { BilingualField, Field, FormGrid, applyServerErrors, useZodForm } from '@/components/patterns/form';
import { EmptyState } from '@/components/patterns/states';
import { Controller } from 'react-hook-form';

function ListDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const { register, handleSubmit, setError, formState: { errors } } = useZodForm(referenceListSchema, { defaultValues: { code: '', nameEn: '', nameAr: '' } });
  const m = useApiMutation({ fn: (v: ReferenceListInput) => api.post('/reference-data/lists', v), invalidate: [['reference']], success: t('common.save'), toastErrors: false, onSuccess: () => onOpenChange(false) });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}><DialogContent size="sm">
      <form noValidate className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit((v) => m.mutate(v as ReferenceListInput, { onError: (e) => applyServerErrors(e, setError) }))}>
        <DialogHeader><DialogTitle>{t('reference.newList')}</DialogTitle></DialogHeader>
        <DialogBody><FormGrid>
          <Field label={t('common.code')} required error={errors.code?.message} className="sm:col-span-full"><Input dir="ltr" className="font-mono" {...register('code')} /></Field>
          <BilingualField base="name" labelEn={t('common.nameEn')} labelAr={t('common.nameAr')} register={register} errors={errors} required />
        </FormGrid></DialogBody>
        <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button><Button type="submit" loading={m.isPending}>{t('common.create')}</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  );
}

function ItemDialog({ listId, record, onClose }: { listId: string; record?: ReferenceItemDto; onClose: () => void }) {
  const { t } = useTranslation();
  const { register, control, handleSubmit, setError, formState: { errors } } = useZodForm(referenceItemSchema, { defaultValues: record ? { code: record.code, labelEn: record.labelEn, labelAr: record.labelAr, sortOrder: record.sortOrder, isActive: record.isActive } : { code: '', labelEn: '', labelAr: '', sortOrder: 0, isActive: true },
  });
  const m = useApiMutation({
    fn: (v: ReferenceItemInput) => (record ? api.patch(`/reference-data/items/${record.id}`, { ...v, code: undefined, rowVersion: record.rowVersion }) : api.post(`/reference-data/lists/${listId}/items`, v)),
    invalidate: [['reference']], success: t('common.save'), toastErrors: false, onSuccess: onClose,
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent size="sm">
      <form noValidate className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit((v) => m.mutate(v as ReferenceItemInput, { onError: (e) => { if (!applyServerErrors(e, setError)) setError('root', { message: e.message }); } }))}>
        <DialogHeader><DialogTitle>{record ? t('common.edit') : t('reference.newItem')}</DialogTitle></DialogHeader>
        <DialogBody><FormGrid>
          {errors.root && <p role="alert" className="sm:col-span-full rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">{errors.root.message}</p>}
          <Field label={t('common.code')} required error={errors.code?.message} hint={record ? t('reference.subtitle') : undefined}><Input dir="ltr" className="font-mono" disabled={!!record} {...register('code')} /></Field>
          <Field label={t('reference.sortOrder')}><Input type="number" min={0} {...register('sortOrder', { valueAsNumber: true })} /></Field>
          <BilingualField base="label" labelEn={t('reference.labelEn')} labelAr={t('reference.labelAr')} register={register} errors={errors} required />
          <label className="flex items-center gap-2 text-sm"><Controller control={control} name="isActive" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />{t('common.active')}</label>
        </FormGrid></DialogBody>
        <DialogFooter><Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button><Button type="submit" loading={m.isPending}>{t('common.save')}</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  );
}

/** Master–detail management of controlled vocabularies. */
export function ReferenceDataPage() {
  const { t } = useTranslation();
  const { pick } = useBilingual();
  const can = useCan();
  const canWrite = can(PERMISSIONS.REFERENCE_WRITE);
  const { params, set } = useListParams();
  const [newList, setNewList] = useState(false);
  const [item, setItem] = useState<ReferenceItemDto | 'new' | null>(null);
  const lists = useQuery({ queryKey: ['reference', 'lists'], queryFn: () => api.get<Paginated<ReferenceListDto>>('/reference-data/lists?pageSize=200') });
  const selected = (params.list as string) ?? lists.data?.items[0]?.id;
  const items = useQuery({ queryKey: ['reference', 'items', selected], queryFn: () => api.get<ReferenceItemDto[]>(`/reference-data/lists/${selected}/items`), enabled: !!selected });
  const current = lists.data?.items.find((l) => l.id === selected);
  const columns: Column<ReferenceItemDto>[] = [
    { key: 'code', header: t('common.code'), cell: (i) => <span className="font-mono">{i.code}</span> },
    { key: 'en', header: t('reference.labelEn'), cell: (i) => <span dir="ltr">{i.labelEn}</span> },
    { key: 'ar', header: t('reference.labelAr'), cell: (i) => <span dir="rtl" className="font-arabic">{i.labelAr}</span> },
    { key: 'active', header: t('common.status'), cell: (i) => <Badge tone={i.isActive ? 'success' : 'neutral'}>{i.isActive ? t('common.active') : t('common.inactive')}</Badge> },
    ...(canWrite ? [{ key: 'act', header: <span className="sr-only">{t('common.actions')}</span>, cell: (i: ReferenceItemDto) => <Button variant="ghost" size="icon-sm" aria-label={`${t('common.edit')} ${i.code}`} onClick={() => setItem(i)}><Pencil /></Button>, className: 'w-12' }] : []),
  ];
  return (
    <>
      <PageHeader title={t('reference.title')} description={t('reference.subtitle')} actions={canWrite && <Button variant="outline" onClick={() => setNewList(true)}><Plus />{t('reference.newList')}</Button>} />
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <Section title={t('reference.lists')}>
          <ul className="-mx-2 flex flex-col gap-0.5" role="listbox" aria-label={t('reference.lists')}>
            {lists.data?.items.map((l) => (
              <li key={l.id} role="option" aria-selected={l.id === selected}>
                <button type="button" onClick={() => set({ list: l.id })} className={cn('flex w-full items-center justify-between rounded-md px-2 py-2 text-start text-sm hover:bg-muted', l.id === selected && 'bg-secondary font-medium')}>
                  <span>{pick(l, 'name')}<span className="block font-mono text-xs text-muted-foreground">{l.code}</span></span>
                  <Badge>{l.itemCount}</Badge>
                </button>
              </li>
            ))}
          </ul>
        </Section>
        <Card>
          {current ? (<>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
              <div><h2 className="font-semibold">{pick(current, 'name')}</h2><p className="font-mono text-xs text-muted-foreground">{current.code}{current.isSystem && ` · ${t('reference.system')}`}</p></div>
              {canWrite && <Button size="sm" onClick={() => setItem('new')}><Plus />{t('reference.newItem')}</Button>}
            </div>
            <DataTable caption={pick(current, 'name')} columns={columns} data={items.data} loading={items.isLoading} error={items.error} rowKey={(i) => i.id} />
          </>) : <EmptyState title={t('reference.selectList')} />}
        </Card>
      </div>
      <ListDialog open={newList} onOpenChange={setNewList} />
      {item && selected && <ItemDialog listId={selected} record={item === 'new' ? undefined : item} onClose={() => setItem(null)} />}
    </>
  );
}
