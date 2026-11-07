import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { OCCUPATION_LEVELS, occupationSchema } from '@cdms/contracts';
import type { OccupationDto, OccupationInput } from '@cdms/contracts';
import { occupations } from '@/lib/resources';
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
import { RecordSelect, ReferenceSelect } from '@/components/patterns/linking';

export function OccupationFormDialog({
  open,
  onOpenChange,
  record,
  parent,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  record?: OccupationDto;
  parent?: OccupationDto;
  onSaved?: (o: OccupationDto) => void;
}) {
  const { t } = useTranslation();
  const nextLevel = parent
    ? (OCCUPATION_LEVELS[
        Math.min(OCCUPATION_LEVELS.indexOf(parent.level) + 1, OCCUPATION_LEVELS.length - 1)
      ] ?? 'occupation')
    : 'major_group';
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useZodForm(occupationSchema, {
    values: record
      ? {
          code: record.code,
          titleEn: record.titleEn,
          titleAr: record.titleAr,
          descriptionEn: record.descriptionEn ?? '',
          descriptionAr: record.descriptionAr ?? '',
          level: record.level,
          parentId: record.parentId,
          iscoCode: record.iscoCode ?? '',
          sectorCode: record.sectorCode,
        }
      : {
          code: '',
          titleEn: '',
          titleAr: '',
          level: nextLevel,
          parentId: parent?.id ?? null,
          sectorCode: parent?.sectorCode ?? null,
          iscoCode: '',
        },
  });
  const m = useApiMutation({
    fn: (v: OccupationInput) =>
      record
        ? occupations.update(record.id, { ...v, rowVersion: record.rowVersion })
        : occupations.create(v),
    invalidate: [occupations.keys.all],
    success: t('common.save'),
    toastErrors: false,
    onSuccess: (o) => {
      onOpenChange(false);
      onSaved?.(o);
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <form
          noValidate
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={handleSubmit((v) =>
            m.mutate(v as OccupationInput, {
              onError: (e) => {
                if (!applyServerErrors(e, setError)) setError('root', { message: e.message });
              },
            }),
          )}
        >
          <DialogHeader>
            <DialogTitle>{record ? t('occupations.edit') : t('occupations.new')}</DialogTitle>
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
              <Field label={t('common.level')} required error={errors.level?.message}>
                <NativeSelect {...register('level')}>
                  {OCCUPATION_LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {t(`occupations.levels.${l}`)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field
                label={t('occupations.parent')}
                error={errors.parentId?.message}
                className="sm:col-span-full"
              >
                <Controller
                  control={control}
                  name="parentId"
                  render={({ field }) => (
                    <RecordSelect
                      endpoint="/occupations"
                      value={field.value}
                      onChange={field.onChange}
                      initial={
                        record?.parent ??
                        (parent
                          ? {
                              id: parent.id,
                              code: parent.code,
                              titleEn: parent.titleEn,
                              titleAr: parent.titleAr,
                            }
                          : null)
                      }
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
              <Field label={t('occupations.isco')} error={errors.iscoCode?.message}>
                <Input
                  dir="ltr"
                  inputMode="numeric"
                  className="font-mono"
                  {...register('iscoCode')}
                />
              </Field>
              <Field label={t('occupations.sector')}>
                <Controller
                  control={control}
                  name="sectorCode"
                  render={({ field }) => (
                    <ReferenceSelect
                      listCode="sector"
                      value={field.value}
                      onChange={field.onChange}
                    />
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
