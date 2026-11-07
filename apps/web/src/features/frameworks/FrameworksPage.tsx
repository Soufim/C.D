import { useState } from 'react';

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Plus } from 'lucide-react';
import { frameworkSchema, PERMISSIONS } from '@cdms/contracts';
import type { FrameworkDto, FrameworkInput } from '@cdms/contracts';
import { frameworks } from '@/lib/resources';
import { useCan } from '@/lib/auth';
import { useBilingual } from '@/lib/format';
import { useListParams } from '@/hooks/use-list-params';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
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
import { StatusBadge } from '@/components/patterns/status-badge';

export function FrameworkFormDialog({
  open,
  onOpenChange,
  record,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  record?: FrameworkDto;
  onSaved?: (f: FrameworkDto) => void;
}) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useZodForm(frameworkSchema, {
    values: record
      ? {
          code: record.code,
          nameEn: record.nameEn,
          nameAr: record.nameAr,
          description: record.description ?? '',
          versionLabel: record.versionLabel,
        }
      : { code: '', nameEn: '', nameAr: '', versionLabel: '1.0' },
  });
  const m = useApiMutation({
    fn: (v: FrameworkInput) =>
      record
        ? frameworks.update(record.id, { ...v, rowVersion: record.rowVersion })
        : frameworks.create(v),
    invalidate: [frameworks.keys.all],
    success: t('common.save'),
    toastErrors: false,
    onSuccess: (f) => {
      onOpenChange(false);
      onSaved?.(f);
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          noValidate
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={handleSubmit((v) =>
            m.mutate(v as FrameworkInput, {
              onError: (e) => {
                if (!applyServerErrors(e, setError)) setError('root', { message: e.message });
              },
            }),
          )}
        >
          <DialogHeader>
            <DialogTitle>{record ? t('common.edit') : t('frameworks.new')}</DialogTitle>
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
              <Field label={t('common.code')} required error={errors.code?.message}>
                <Input dir="ltr" className="font-mono uppercase" {...register('code')} />
              </Field>
              <Field
                label={t('frameworks.versionLabel')}
                required
                error={errors.versionLabel?.message}
              >
                <Input dir="ltr" {...register('versionLabel')} />
              </Field>
              <BilingualField
                base="name"
                labelEn={t('common.nameEn')}
                labelAr={t('common.nameAr')}
                register={register}
                errors={errors}
                required
              />
              <Field label={t('common.description')} className="sm:col-span-full">
                <Textarea rows={3} {...register('description')} />
              </Field>
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

export function FrameworksPage() {
  const { t } = useTranslation();
  const { pick } = useBilingual();
  const can = useCan();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const { params, set, toggleSort } = useListParams({ sort: 'code' });
  const q = frameworks.useList(params);
  const columns: Column<FrameworkDto>[] = [
    {
      key: 'name',
      header: t('common.name'),
      sortKey: 'nameEn',
      cell: (f) => (
        <span className="flex flex-col">
          <span>{pick(f, 'name')}</span>
          <span className="font-mono text-xs font-normal text-muted-foreground">{f.code}</span>
        </span>
      ),
    },
    { key: 'ver', header: t('frameworks.versionLabel'), cell: (f) => f.versionLabel },
    { key: 'status', header: t('common.status'), cell: (f) => <StatusBadge status={f.status} /> },
  ];
  return (
    <>
      <PageHeader
        title={t('frameworks.title')}
        description={t('frameworks.subtitle')}
        actions={
          can(PERMISSIONS.CATALOG_WRITE) && (
            <Button onClick={() => setCreating(true)}>
              <Plus />
              {t('frameworks.new')}
            </Button>
          )
        }
      />
      <Card>
        <ListToolbar>
          <SearchInput value={params.q} onChange={(v) => set({ q: v })} />
        </ListToolbar>
        <DataTable
          caption={t('frameworks.title')}
          columns={columns}
          data={q.data}
          loading={q.isLoading}
          error={q.error}
          rowKey={(f) => f.id}
          rowHref={(f) => `/frameworks/${f.id}`}
          sort={{ key: params.sort, order: params.order, onSort: toggleSort }}
          page={{ onPage: (p) => set({ page: p }, false) }}
        />
      </Card>
      <FrameworkFormDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(f) => navigate(`/frameworks/${f.id}`)}
      />
    </>
  );
}
