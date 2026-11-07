import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { Printer } from 'lucide-react';
import type { TemplateDto } from '@cdms/contracts';
import { api } from '@/lib/api';
import { useBilingual, useFormat } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { ErrorState, PageLoader } from '@/components/patterns/states';
import { useCurriculum, useCoverage } from './api';

/**
 * Print-optimised document (browser "Save as PDF" produces the official PDF — no server-side
 * PDF engine or paid service required).
 */
export function CurriculumPrintPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const { pick, isAr } = useBilingual();
  const f = useFormat();
  const q = useCurriculum(id);
  const cov = useCoverage(id, !!q.data?.occupationId);
  const tpl = useQuery({
    queryKey: ['templates', q.data?.templateId],
    queryFn: () => api.get<TemplateDto>(`/templates/${q.data!.templateId}`),
    enabled: !!q.data?.templateId,
  });
  if (q.isLoading)
    return (
      <div className="p-8">
        <PageLoader />
      </div>
    );
  if (!q.data) return <ErrorState error={q.error} />;
  const c = q.data;
  const lang = isAr ? 'ar' : 'en';
  return (
    <div className="mx-auto max-w-4xl bg-card p-8 text-[15px] leading-relaxed print:max-w-none print:p-0">
      <div className="no-print mb-6 flex justify-end">
        <Button onClick={() => window.print()}>
          <Printer />
          {t('common.print')}
        </Button>
      </div>
      <header className="border-b-2 border-primary pb-4">
        <p className="text-sm text-muted-foreground">
          {t('app.fullName')} — {t('app.ministry')}
        </p>
        <h1 className="mt-2 text-2xl font-bold">{pick(c, 'title')}</h1>
        <p className="mt-1 font-mono text-sm">
          {c.code} · v{c.version} · {t(`status.${c.status}`)} · {c.frameworkLevelLabel ?? ''}
        </p>
      </header>
      <section className="mt-6">
        <h2 className="text-lg font-semibold">{t('common.overview')}</h2>
        <p className="mt-2 whitespace-pre-line">{pick(c, 'summary')}</p>
        <p className="mt-2 text-sm">
          {t('curricula.occupation')}:{' '}
          {c.occupation ? `${c.occupation.code} — ${pick(c.occupation, 'title')}` : '—'} ·{' '}
          {t('curricula.duration')}: {f.number(c.durationMonths)} · {t('curricula.effectiveFrom')}:{' '}
          {f.date(c.effectiveFrom)}
        </p>
      </section>
      {tpl.data?.sections.map((s, i) => (
        <section key={s.key} className="mt-6 break-inside-avoid">
          <h2 className="text-lg font-semibold">
            {i + 1}. {isAr ? s.titleAr : s.titleEn}
          </h2>
          <p className="mt-2 whitespace-pre-line">
            {c.sections[s.key]?.[lang] || c.sections[s.key]?.[isAr ? 'en' : 'ar'] || '—'}
          </p>
        </section>
      ))}
      <section className="mt-6">
        <h2 className="text-lg font-semibold">{t('curricula.structure')}</h2>
        <table className="mt-2 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2">
              {[
                t('common.term'),
                t('common.code'),
                t('common.title'),
                t('curricula.theory'),
                t('curricula.practical'),
                t('common.credits'),
              ].map((h) => (
                <th key={h} className="p-2 text-start">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {c.units?.map((u) => (
              <tr key={u.unitId} className="border-b">
                <td className="p-2">{u.term}</td>
                <td className="p-2 font-mono">{u.code}</td>
                <td className="p-2">
                  {pick(u, 'title')}
                  {!u.isMandatory && ` (${t('curricula.elective')})`}
                </td>
                <td className="p-2 tabular">{u.theoryHours}</td>
                <td className="p-2 tabular">{u.practicalHours}</td>
                <td className="p-2 tabular">{u.creditHours}</td>
              </tr>
            ))}
          </tbody>
          {c.totals && (
            <tfoot>
              <tr className="font-semibold">
                <td colSpan={3} className="p-2">
                  {t('curricula.totalHours')}
                </td>
                <td className="p-2">{c.totals.theoryHours}</td>
                <td className="p-2">{c.totals.practicalHours}</td>
                <td className="p-2">{c.totals.creditHours}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </section>
      {cov.data && (
        <section className="mt-6 break-inside-avoid">
          <h2 className="text-lg font-semibold">
            {t('curricula.coverage')} — {cov.data.coveragePercent}%
          </h2>
          <ul className="mt-2 list-disc ps-6 text-sm">
            {cov.data.required.map((r) => (
              <li key={r.id}>
                {r.code} — {pick(r, 'title')}:{' '}
                {r.coveredBy.length
                  ? r.coveredBy.map((u) => u.code).join(', ')
                  : t('curricula.notCovered')}
              </li>
            ))}
          </ul>
        </section>
      )}
      <footer className="mt-10 border-t pt-3 text-xs text-muted-foreground">
        {t('common.updated')}: {f.dateTime(c.updatedAt)}
      </footer>
    </div>
  );
}
