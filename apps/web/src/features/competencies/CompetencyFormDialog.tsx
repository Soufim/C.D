import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { COMPETENCY_TYPES, competencySchema } from '@cdms/contracts';
import type { CompetencyDto, CompetencyInput } from '@cdms/contracts';
import { competencies } from '@/lib/resources';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
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
import { LevelSelect } from '@/components/patterns/linking';

export function CompetencyFormDialog({
  open,
  onOpenChange,
  record,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  record?: CompetencyDto;
  onSaved?: (c: CompetencyDto) => void;
}) {
  const { t } = useTranslation();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useZodForm(competencySchema, {
    values: record
      ? {
          code: record.code,
          titleEn: record.titleEn,
          titleAr: record.titleAr,
          descriptionEn: record.descriptionEn ?? '',
          descriptionAr: record.descriptionAr ?? '',
          type: record.type,
          frameworkLevelId: record.frameworkLevelId,
          performanceCriteriaEn: record.performanceCriteriaEn ?? '',
          performanceCriteriaAr: record.performanceCriteriaAr ?? '',
        }
      : { code: '', titleEn: '', titleAr: '', type: 'technical' as const },
  });
  const m = useApiMutation({
    fn: (v: CompetencyInput) =>
      record
        ? competencies.update(record.id, { ...v, rowVersion: record.rowVersion })
        : competencies.create(v),
    invalidate: [competencies.keys.all],
    success: t('common.save'),
    toastErrors: false,
    onSuccess: (c) => {
      onOpenChange(false);
      onSaved?.(c);
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <form
          noValidate
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={handleSubmit((v) =>
            m.mutate(v as CompetencyInput, {
              onError: (e) => {
                if (!applyServerErrors(e, setError)) setError('root', { message: e.message });
              },
            }),
          )}
        >
          <DialogHeader>
            <DialogTitle>{record ? t('competencies.edit') : t('competencies.new')}</DialogTitle>
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
              <Field
                label={t('common.code')}
                required
                error={errors.code?.message}
                hint="CMP-ELEC-01"
              >
                <Input dir="ltr" className="font-mono uppercase" {...register('code')} />
              </Field>
              <Field label={t('common.type')} required error={errors.type?.message}>
                <NativeSelect {...register('type')}>
                  {COMPETENCY_TYPES.map((x) => (
                    <option key={x} value={x}>
                      {t(`competencies.types.${x}`)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <BilingualField
                base="title"
                labelEn={t('common.titleEn')}
                labelAr={t('common.titleAr')}
                register={register}
                errors={errors}
                required
              />
              <Field label={t('curricula.frameworkLevel')} className="sm:col-span-full">
                <Controller
                  control={control}
                  name="frameworkLevelId"
                  render={({ field }) => (
                    <LevelSelect value={field.value} onChange={field.onChange} />
                  )}
                />
              </Field>
              <BilingualField
                base="description"
                labelEn={t('common.descriptionEn')}
                labelAr={t('common.descriptionAr')}
                register={register}
                errors={errors}
                multiline
              />
              <BilingualField
                base="performanceCriteria"
                labelEn={t('competencies.criteriaEn')}
                labelAr={t('competencies.criteriaAr')}
                register={register}
                errors={errors}
                multiline
                rows={5}
              />
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
