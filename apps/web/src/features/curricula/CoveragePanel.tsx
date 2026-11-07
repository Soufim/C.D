import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { CheckCircle2, CircleAlert, Target } from 'lucide-react';
import type { CurriculumDto } from '@cdms/contracts';
import { useBilingual, useFormat } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';
import { Section } from '@/components/patterns/page';
import { EmptyState } from '@/components/patterns/states';
import { useCoverage } from './api';

/** Required competencies of the target occupation vs. competencies covered by the units. */
export function CoveragePanel({ curriculum }: { curriculum: CurriculumDto }) {
  const { t } = useTranslation();
  const { pick } = useBilingual();
  const f = useFormat();
  const q = useCoverage(curriculum.id, !!curriculum.occupationId);
  if (!curriculum.occupationId)
    return (
      <Section title={t('curricula.coverage')}>
        <EmptyState icon={<Target />} title={t('curricula.noOccupation')} />
      </Section>
    );
  if (q.isLoading || !q.data) return <Skeleton className="h-48" />;
  const pct = q.data.coveragePercent;
  return (
    <Section
      title={t('curricula.coverage')}
      description={t('curricula.coveragePercent', { percent: f.number(pct) })}
    >
      <div
        className="mb-4 h-2.5 rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('curricula.coverage')}
      >
        <div
          className={`h-full rounded-full ${pct === 100 ? 'bg-success' : pct >= 60 ? 'bg-warning' : 'bg-destructive'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <h3 className="mb-2 text-sm font-semibold">{t('curricula.required')}</h3>
      <ul className="divide-y rounded-md border">
        {q.data.required.map((c) => (
          <li
            key={c.id}
            className="flex flex-col gap-1 p-3 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="flex min-w-0 gap-2">
              {c.coveredBy.length ? (
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0 text-success"
                  aria-label={t('curricula.covered')}
                />
              ) : (
                <CircleAlert
                  className="mt-0.5 size-4 shrink-0 text-destructive"
                  aria-label={t('curricula.notCovered')}
                />
              )}
              <Link to={`/competencies/${c.id}`} className="text-sm hover:underline">
                <span className="font-mono text-xs text-muted-foreground">{c.code}</span>{' '}
                {pick(c, 'title')}
              </Link>
            </div>
            <div className="flex flex-wrap gap-1 ps-6 sm:ps-0">
              {c.coveredBy.length ? (
                c.coveredBy.map((u) => (
                  <Link
                    key={u.id}
                    to={`/units/${u.id}`}
                    className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs text-secondary-foreground hover:underline"
                  >
                    {u.code}
                  </Link>
                ))
              ) : (
                <span className="text-xs font-medium text-destructive">
                  {t('curricula.notCovered')}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
      {q.data.additional.length > 0 && (
        <>
          <h3 className="mb-2 mt-4 text-sm font-semibold">{t('curricula.additional')}</h3>
          <ul className="flex flex-wrap gap-2">
            {q.data.additional.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/competencies/${c.id}`}
                  className="rounded border px-2 py-1 text-xs hover:bg-muted"
                >
                  <span className="font-mono">{c.code}</span> {pick(c, 'title')}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}
