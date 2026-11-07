import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { PERMISSIONS, curriculumSchema } from '@cdms/contracts';
import type { CurriculumDto, CurriculumInput } from '@cdms/contracts';
import { useCan } from '@/lib/auth';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  BilingualField,
  Field,
  FormGrid,
  applyServerErrors,
  useZodForm,
} from '@/components/patterns/form';
import { LevelSelect, RecordSelect, ReferenceSelect } from '@/components/patterns/linking';
import { curriculaApi, curriculaKeys } from './api';

/** Create / edit curriculum metadata. Structure and sections are edited on the detail page. */
export function CurriculumFormDialog({
  open,
  onOpenChange,
  record,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  record?: CurriculumDto;
  onSaved?: (c: CurriculumDto) => void;
}) {
  const { t } = useTranslation();
  const can = useCan();
  const form = useZodForm(curriculumSchema, {
    values: record
      ? {
          code: record.code,
          titleEn: record.titleEn,
          titleAr: record.titleAr,
          summaryEn: record.summaryEn ?? '',
          summaryAr: record.summaryAr ?? '',
          occupationId: record.occupationId,
          frameworkLevelId: record.frameworkLevelId,
          institutionId: record.institutionId,
          templateId: record.templateId,
          programTypeCode: record.programTypeCode,
          durationMonths: record.durationMonths,
          effectiveFrom: record.effectiveFrom,
          sections: record.sections,
        }
      : { code: '', titleEn: '', titleAr: '', durationMonths: 0, sections: {} },
  });
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = form;
  const m = useApiMutation({
    fn: (v: CurriculumInput) =>
      record
        ? curriculaApi.update(record.id, { ...v, rowVersion: record.rowVersion })
        : curriculaApi.create(v),
    invalidate: [curriculaKeys.all, ['dashboard']],
    success: record ? t('curricula.saved') : t('curricula.created'),
    toastErrors: false,
    onSuccess: (c) => {
      onOpenChange(false);
      onSaved?.(c);
    },
  });
  const submit = handleSubmit((v) =>
    m.mutate({ ...v, effectiveFrom: v.effectiveFrom || null } as CurriculumInput, {
      onError: (e) => {
        if (!applyServerErrors(e, setError)) setError('root', { message: e.message });
      },
    }),
  );
  const err = (k: keyof typeof errors) => errors[k]?.message as string | undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>{record ? t('curricula.edit') : t('curricula.new')}</DialogTitle>
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
              <Field label={t('common.code')} required error={err('code')} hint="CUR-ELEC-BLD">
                <Input
                  dir="ltr"
                  className="font-mono uppercase"
                  disabled={!!record && record.version > 1}
                  {...register('code')}
                />
              </Field>
              <Field label={t('curricula.programType')} error={err('programTypeCode')}>
                <Controller
                  control={control}
                  name="programTypeCode"
                  render={({ field }) => (
                    <ReferenceSelect
                      listCode="program_type"
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </Field>
              <BilingualField
                base="title"
                labelEn={t('common.titleEn')}
                labelAr={t('common.titleAr')}
                register={register}
                errors={errors}
                required
              />
              <BilingualField
                base="summary"
                labelEn={t('curricula.summaryEn')}
                labelAr={t('curricula.summaryAr')}
                register={register}
                errors={errors}
                multiline
              />
              <Field label={t('curricula.occupation')} error={err('occupationId')}>
                <Controller
                  control={control}
                  name="occupationId"
                  render={({ field }) => (
                    <RecordSelect
                      endpoint="/occupations"
                      extraQuery={{ level: 'occupation' }}
                      value={field.value}
                      onChange={field.onChange}
                      initial={record?.occupation}
                    />
                  )}
                />
              </Field>
              <Field label={t('curricula.frameworkLevel')} error={err('frameworkLevelId')}>
                <Controller
                  control={control}
                  name="frameworkLevelId"
                  render={({ field }) => (
                    <LevelSelect value={field.value} onChange={field.onChange} />
                  )}
                />
              </Field>
              <Field label={t('curricula.template')} error={err('templateId')}>
                <Controller
                  control={control}
                  name="templateId"
                  render={({ field }) => (
                    <RecordSelect
                      endpoint="/templates"
                      extraQuery={{ kind: 'curriculum' }}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </Field>
              {can(PERMISSIONS.CURRICULUM_ALL_INSTITUTIONS) && (
                <Field label={t('curricula.institution')} error={err('institutionId')}>
                  <Controller
                    control={control}
                    name="institutionId"
                    render={({ field }) => (
                      <RecordSelect
                        endpoint="/institutions"
                        value={field.value}
                        onChange={field.onChange}
                        initial={
                          record?.institutionId
                            ? {
                                id: record.institutionId,
                                code: '',
                                titleEn: record.institutionNameEn ?? '',
                                titleAr: record.institutionNameAr ?? '',
                              }
                            : null
                        }
                      />
                    )}
                  />
                </Field>
              )}
              <Field label={t('curricula.duration')} error={err('durationMonths')}>
                <Input
                  type="number"
                  min={0}
                  max={120}
                  inputMode="numeric"
                  {...register('durationMonths', { valueAsNumber: true })}
                />
              </Field>
              <Field label={t('curricula.effectiveFrom')} error={err('effectiveFrom')}>
                <Input type="date" {...register('effectiveFrom')} />
              </Field>
            </FormGrid>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={m.isPending}>
              {record ? t('common.saveChanges') : t('common.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
