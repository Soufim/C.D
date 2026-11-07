import { useState } from 'react';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus } from 'lucide-react';
import { institutionSchema, PERMISSIONS } from '@cdms/contracts';
import type { InstitutionDto, InstitutionInput } from '@cdms/contracts';
import { institutions } from '@/lib/resources';
import { useCan } from '@/lib/auth';
import { useBilingual } from '@/lib/format';
import { useListParams } from '@/hooks/use-list-params';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input, Textarea } from '@/components/ui/input';
import { Switch } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/patterns/page';
import { DataTable, ListToolbar, SearchInput, type Column } from '@/components/patterns/data-table';
import {
  BilingualField,
  Field,
  FormGrid,
  applyServerErrors,
  useZodForm,
} from '@/components/patterns/form';
import { ReferenceLabel, ReferenceSelect } from '@/components/patterns/linking';

function InstitutionDialog({ record, onClose }: { record?: InstitutionDto; onClose: () => void }) {
  const { t } = useTranslation();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useZodForm(institutionSchema, {
    defaultValues: record
      ? {
          code: record.code,
          nameEn: record.nameEn,
          nameAr: record.nameAr,
          typeCode: record.typeCode,
          governorateCode: record.governorateCode,
          address: record.address ?? '',
          isActive: record.isActive,
        }
      : { code: '', nameEn: '', nameAr: '', isActive: true },
  });
  const m = useApiMutation({
    fn: (v: InstitutionInput) =>
      record
        ? institutions.update(record.id, { ...v, rowVersion: record.rowVersion })
        : institutions.create(v),
    invalidate: [institutions.keys.all],
    success: t('common.save'),
    toastErrors: false,
    onSuccess: onClose,
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form
          noValidate
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={handleSubmit((v) =>
            m.mutate(v as InstitutionInput, {
              onError: (e) => {
                if (!applyServerErrors(e, setError)) setError('root', { message: e.message });
              },
            }),
          )}
        >
          <DialogHeader>
            <DialogTitle>{record ? t('institutions.edit') : t('institutions.new')}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <FormGrid>
              {errors.root && (
                <p
                  role="alert"
                  className="sm:col-span-full rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive"
                >
                  {errors.root.message}
                </p>
              )}
              <Field label={t('common.code')} required error={errors.code?.message}>
                <Input dir="ltr" className="font-mono" {...register('code')} />
              </Field>
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <Controller
                  control={control}
                  name="isActive"
                  render={({ field }) => (
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
                {t('common.active')}
              </label>
              <BilingualField
                base="name"
                labelEn={t('common.nameEn')}
                labelAr={t('common.nameAr')}
                register={register}
                errors={errors}
                required
              />
              <Field label={t('institutions.type')}>
                <Controller
                  control={control}
                  name="typeCode"
                  render={({ field }) => (
                    <ReferenceSelect
                      listCode="institution_type"
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </Field>
              <Field label={t('institutions.governorate')}>
                <Controller
                  control={control}
                  name="governorateCode"
                  render={({ field }) => (
                    <ReferenceSelect
                      listCode="governorate"
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </Field>
              <Field label={t('institutions.address')} className="sm:col-span-full">
                <Textarea rows={2} {...register('address')} />
              </Field>
            </FormGrid>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
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

export function InstitutionsPage() {
  const { t } = useTranslation();
  const { pick } = useBilingual();
  const can = useCan();
  const canWrite = can(PERMISSIONS.INSTITUTION_WRITE);
  const { params, set, toggleSort } = useListParams({ sort: 'code' });
  const q = institutions.useList(params);
  const [edit, setEdit] = useState<InstitutionDto | 'new' | null>(null);
  const columns: Column<InstitutionDto>[] = [
    {
      key: 'name',
      header: t('common.name'),
      sortKey: 'nameEn',
      cell: (i) => (
        <span className="flex flex-col">
          <span className="font-medium">{pick(i, 'name')}</span>
          <span className="font-mono text-xs text-muted-foreground">{i.code}</span>
        </span>
      ),
    },
    {
      key: 'type',
      header: t('institutions.type'),
      cell: (i) => <ReferenceLabel listCode="institution_type" code={i.typeCode} />,
    },
    {
      key: 'gov',
      header: t('institutions.governorate'),
      cell: (i) => <ReferenceLabel listCode="governorate" code={i.governorateCode} />,
      hideOnMobile: true,
    },
    {
      key: 'active',
      header: t('common.status'),
      cell: (i) => (
        <Badge tone={i.isActive ? 'success' : 'neutral'}>
          {i.isActive ? t('common.active') : t('common.inactive')}
        </Badge>
      ),
    },
    ...(canWrite
      ? [
          {
            key: 'act',
            header: <span className="sr-only">{t('common.actions')}</span>,
            className: 'w-12',
            cell: (i: InstitutionDto) => (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`${t('common.edit')} ${i.code}`}
                onClick={() => setEdit(i)}
              >
                <Pencil />
              </Button>
            ),
          },
        ]
      : []),
  ];
  return (
    <>
      <PageHeader
        title={t('institutions.title')}
        description={t('institutions.subtitle')}
        actions={
          canWrite && (
            <Button onClick={() => setEdit('new')}>
              <Plus />
              {t('institutions.new')}
            </Button>
          )
        }
      />
      <Card>
        <ListToolbar>
          <SearchInput value={params.q} onChange={(v) => set({ q: v })} />
        </ListToolbar>
        <DataTable
          caption={t('institutions.title')}
          columns={columns}
          data={q.data}
          loading={q.isLoading}
          error={q.error}
          rowKey={(i) => i.id}
          sort={{ key: params.sort, order: params.order, onSort: toggleSort }}
          page={{ onPage: (p) => set({ page: p }, false) }}
        />
      </Card>
      {edit && (
        <InstitutionDialog
          record={edit === 'new' ? undefined : edit}
          onClose={() => setEdit(null)}
        />
      )}
    </>
  );
}
