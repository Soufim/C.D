import { Controller, useFieldArray } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { unitSchema } from '@cdms/contracts';
import type { UnitDto, UnitInput } from '@cdms/contracts';
import { units } from '@/lib/resources';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BilingualField, Field, FormGrid, applyServerErrors, useZodForm } from '@/components/patterns/form';
import { LevelSelect } from '@/components/patterns/linking';

export function UnitFormDialog({ open, onOpenChange, record, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; record?: UnitDto; onSaved?: (u: UnitDto) => void }) {
  const { t } = useTranslation();
  const { register, control, handleSubmit, setError, formState: { errors } } = useZodForm(unitSchema, { values: record ? {
      code: record.code, titleEn: record.titleEn, titleAr: record.titleAr, descriptionEn: record.descriptionEn ?? '', descriptionAr: record.descriptionAr ?? '',
      frameworkLevelId: record.frameworkLevelId, creditHours: record.creditHours, theoryHours: record.theoryHours, practicalHours: record.practicalHours,
      assessmentEn: record.assessmentEn ?? '', assessmentAr: record.assessmentAr ?? '',
      learningOutcomes: (record.learningOutcomes ?? []).map((l) => ({ code: l.code, textEn: l.textEn, textAr: l.textAr })),
    } : { code: '', titleEn: '', titleAr: '', creditHours: 0, theoryHours: 0, practicalHours: 0, learningOutcomes: [] },
  });
  const los = useFieldArray({ control, name: 'learningOutcomes' });
  const m = useApiMutation({
    fn: (v: UnitInput) => (record ? units.update(record.id, { ...v, rowVersion: record.rowVersion }) : units.create(v)),
    invalidate: [units.keys.all], success: t('common.save'), toastErrors: false,
    onSuccess: (u) => { onOpenChange(false); onSaved?.(u); },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <form noValidate className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit((v) => m.mutate(v as UnitInput, { onError: (e) => { if (!applyServerErrors(e, setError)) setError('root', { message: e.message }); } }))}>
          <DialogHeader><DialogTitle>{record ? t('units.edit') : t('units.new')}</DialogTitle></DialogHeader>
          <DialogBody className="flex flex-col gap-6">
            {errors.root && <p role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">{errors.root.message}</p>}
            <FormGrid>
              <Field label={t('common.code')} required error={errors.code?.message} hint="UNT-ELEC-120"><Input dir="ltr" className="font-mono uppercase" {...register('code')} /></Field>
              <Field label={t('curricula.frameworkLevel')}><Controller control={control} name="frameworkLevelId" render={({ field }) => <LevelSelect value={field.value} onChange={field.onChange} />} /></Field>
              <BilingualField base="title" labelEn={t('common.titleEn')} labelAr={t('common.titleAr')} register={register} errors={errors} required />
              <div className="grid grid-cols-3 gap-3 sm:col-span-full">
                <Field label={t('units.theoryHours')} error={errors.theoryHours?.message}><Input type="number" min={0} inputMode="numeric" {...register('theoryHours', { valueAsNumber: true })} /></Field>
                <Field label={t('units.practicalHours')} error={errors.practicalHours?.message}><Input type="number" min={0} inputMode="numeric" {...register('practicalHours', { valueAsNumber: true })} /></Field>
                <Field label={t('units.creditHours')} error={errors.creditHours?.message}><Input type="number" min={0} step={0.5} inputMode="decimal" {...register('creditHours', { valueAsNumber: true })} /></Field>
              </div>
              <BilingualField base="description" labelEn={t('common.descriptionEn')} labelAr={t('common.descriptionAr')} register={register} errors={errors} multiline />
              <BilingualField base="assessment" labelEn={t('units.assessmentEn')} labelAr={t('units.assessmentAr')} register={register} errors={errors} multiline rows={2} />
            </FormGrid>
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-2 flex w-full items-center justify-between text-sm font-semibold">
                {t('units.learningOutcomes')}
                <Button type="button" size="sm" variant="outline" onClick={() => los.append({ code: `LO${los.fields.length + 1}`, textEn: '', textAr: '' })}><Plus />{t('units.addOutcome')}</Button>
              </legend>
              {!los.fields.length && <p className="text-sm text-muted-foreground">{t('units.noOutcomes')}</p>}
              {los.fields.map((f, i) => (
                <div key={f.id} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[6rem_1fr_1fr_auto]">
                  <Field label={t('common.code')} required error={errors.learningOutcomes?.[i]?.code?.message}><Input dir="ltr" className="font-mono" {...register(`learningOutcomes.${i}.code`)} /></Field>
                  <Field label={t('units.outcomeEn')} required error={errors.learningOutcomes?.[i]?.textEn?.message}><Textarea dir="ltr" rows={2} {...register(`learningOutcomes.${i}.textEn`)} /></Field>
                  <Field label={t('units.outcomeAr')} required error={errors.learningOutcomes?.[i]?.textAr?.message}><Textarea dir="rtl" rows={2} className="font-arabic" {...register(`learningOutcomes.${i}.textAr`)} /></Field>
                  <Button type="button" variant="ghost" size="icon-sm" className="self-end" aria-label={`${t('common.remove')} ${i + 1}`} onClick={() => los.remove(i)}><Trash2 /></Button>
                </div>
              ))}
            </fieldset>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
            <Button type="submit" loading={m.isPending}>{record ? t('common.saveChanges') : t('common.create')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
