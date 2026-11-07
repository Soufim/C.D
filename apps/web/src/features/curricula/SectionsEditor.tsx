import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { FileStack } from 'lucide-react';
import type { CurriculumDto, TemplateDto } from '@cdms/contracts';
import { api } from '@/lib/api';
import { useBilingual } from '@/lib/format';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Section } from '@/components/patterns/page';
import { EmptyState } from '@/components/patterns/states';
import { Field } from '@/components/patterns/form';
import { curriculaApi, curriculaKeys } from './api';

/** Writes the curriculum document following the sections defined by its template. */
export function SectionsEditor({
  curriculum,
  editable,
}: {
  curriculum: CurriculumDto;
  editable: boolean;
}) {
  const { t } = useTranslation();
  const { pick, isAr } = useBilingual();
  const tpl = useQuery({
    queryKey: ['templates', curriculum.templateId],
    queryFn: () => api.get<TemplateDto>(`/templates/${curriculum.templateId}`),
    enabled: !!curriculum.templateId,
  });
  const [values, setValues] = useState(curriculum.sections);
  const [editing, setEditing] = useState(false);
  const save = useApiMutation({
    fn: () =>
      curriculaApi.update(curriculum.id, { sections: values, rowVersion: curriculum.rowVersion }),
    invalidate: [curriculaKeys.detail(curriculum.id)],
    success: t('curricula.saved'),
    onSuccess: () => setEditing(false),
  });
  if (!curriculum.templateId)
    return (
      <Section title={t('curricula.sections')}>
        <EmptyState icon={<FileStack />} title={t('curricula.noTemplate')} />
      </Section>
    );
  if (tpl.isLoading) return <Skeleton className="h-60" />;
  const sections = tpl.data?.sections ?? [];
  const set = (key: string, lang: 'en' | 'ar', v: string) =>
    setValues((s) => ({ ...s, [key]: { en: s[key]?.en ?? '', ar: s[key]?.ar ?? '', [lang]: v } }));

  return (
    <Section
      title={t('curricula.sections')}
      description={pick(tpl.data as never, 'name')}
      actions={
        editable &&
        (editing ? (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setValues(curriculum.sections);
                setEditing(false);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button size="sm" loading={save.isPending} onClick={() => save.mutate()}>
              {t('common.saveChanges')}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            {t('curricula.editSections')}
          </Button>
        ))
      }
    >
      <div className="flex flex-col gap-6">
        {sections.map((s, i) => {
          const v = values[s.key] ?? { en: '', ar: '' };
          return (
            <article key={s.key} aria-labelledby={`sec-${s.key}`}>
              <h3 id={`sec-${s.key}`} className="flex items-center gap-2 text-sm font-semibold">
                <span className="text-muted-foreground tabular">{i + 1}.</span>
                {isAr ? s.titleAr : s.titleEn}
                {s.required && <Badge tone="warning">{t('common.required')}</Badge>}
              </h3>
              {(s.guidanceEn || s.guidanceAr) && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {isAr ? s.guidanceAr || s.guidanceEn : s.guidanceEn || s.guidanceAr}
                </p>
              )}
              {editing ? (
                <div className="mt-2 grid gap-3 md:grid-cols-2">
                  <Field label={t('common.english')}>
                    <Textarea
                      dir="ltr"
                      lang="en"
                      rows={5}
                      value={v.en}
                      onChange={(e) => set(s.key, 'en', e.target.value)}
                    />
                  </Field>
                  <Field label={t('common.arabic')}>
                    <Textarea
                      dir="rtl"
                      lang="ar"
                      rows={5}
                      className="font-arabic"
                      value={v.ar}
                      onChange={(e) => set(s.key, 'ar', e.target.value)}
                    />
                  </Field>
                </div>
              ) : (
                <div className="mt-2 grid gap-3 md:grid-cols-2">
                  <p
                    dir="ltr"
                    lang="en"
                    className="whitespace-pre-line rounded-md bg-muted/50 p-3 text-sm"
                  >
                    {v.en || (
                      <span className="text-muted-foreground italic">
                        {t('curricula.sectionEmpty')}
                      </span>
                    )}
                  </p>
                  <p
                    dir="rtl"
                    lang="ar"
                    className="font-arabic whitespace-pre-line rounded-md bg-muted/50 p-3 text-sm"
                  >
                    {v.ar || (
                      <span className="text-muted-foreground italic">
                        {t('curricula.sectionEmpty')}
                      </span>
                    )}
                  </p>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </Section>
  );
}
