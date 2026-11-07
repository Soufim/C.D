import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import {
  BookOpenCheck,
  Building2,
  ClipboardCheck,
  FileStack,
  ListTree,
  PencilLine,
  Plus,
  Puzzle,
  Target,
} from 'lucide-react';
import { PERMISSIONS, RECORD_STATUSES } from '@cdms/contracts';
import type { DashboardStats } from '@cdms/contracts';
import { api } from '@/lib/api';
import { useAuth, useCan } from '@/lib/auth';
import { useBilingual, useFormat } from '@/lib/format';
import { entityPath } from '@/lib/entities';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader, Section } from '@/components/patterns/page';
import { ErrorState, PageLoader } from '@/components/patterns/states';
import { StatusBadge } from '@/components/patterns/status-badge';

const BAR = {
  draft: 'bg-muted-foreground/40',
  in_review: 'bg-info',
  approved: 'bg-warning',
  published: 'bg-success',
  archived: 'bg-border',
} as const;

export function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { t2 } = useBilingual();
  const f = useFormat();
  const can = useCan();
  const q = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardStats>('/dashboard'),
  });
  if (q.isLoading) return <PageLoader />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  const max = Math.max(1, ...Object.values(d.curriculaByStatus));

  const stats = [
    { label: t('nav.curricula'), value: d.counts.curricula, icon: BookOpenCheck, to: '/curricula' },
    { label: t('nav.units'), value: d.counts.units, icon: Puzzle, to: '/units' },
    {
      label: t('nav.competencies'),
      value: d.counts.competencies,
      icon: Target,
      to: '/competencies',
    },
    {
      label: t('nav.occupations'),
      value: d.counts.occupations,
      icon: ListTree,
      to: '/occupations',
    },
    { label: t('nav.templates'), value: d.counts.templates, icon: FileStack, to: '/templates' },
    {
      label: t('nav.institutions'),
      value: d.counts.institutions,
      icon: Building2,
      to: '/institutions',
    },
  ];

  return (
    <>
      <PageHeader
        title={t('dashboard.greeting', { name: t2(user?.fullNameEn, user?.fullNameAr) })}
        description={t('dashboard.subtitle')}
        actions={
          can(PERMISSIONS.CURRICULUM_WRITE) && (
            <Button asChild>
              <Link to="/curricula?new=1">
                <Plus />
                {t('dashboard.newCurriculum')}
              </Link>
            </Button>
          )
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Link to="/reviews" className="group">
          <Card className="flex items-center gap-4 p-5 transition-shadow group-hover:shadow-md">
            <span className="grid size-11 place-items-center rounded-lg bg-info-soft text-info">
              <ClipboardCheck className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">{t('dashboard.pendingReviews')}</p>
              <p className="text-2xl font-semibold tabular">{f.number(d.pendingReviews)}</p>
            </div>
          </Card>
        </Link>
        <Link to="/curricula?mine=1&status=draft" className="group">
          <Card className="flex items-center gap-4 p-5 transition-shadow group-hover:shadow-md">
            <span className="grid size-11 place-items-center rounded-lg bg-accent text-accent-foreground">
              <PencilLine className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">{t('dashboard.myDrafts')}</p>
              <p className="text-2xl font-semibold tabular">{f.number(d.myDrafts)}</p>
            </div>
          </Card>
        </Link>
      </div>

      <h2 className="mb-3 mt-6 text-sm font-semibold text-muted-foreground">
        {t('dashboard.catalogue')}
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <li key={s.to}>
            <Link
              to={s.to}
              className="flex flex-col gap-2 rounded-lg border bg-card p-4 shadow-sm hover:shadow-md"
            >
              <s.icon className="size-4 text-muted-foreground" aria-hidden />
              <span className="text-2xl font-semibold tabular">{f.number(s.value)}</span>
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Section title={t('dashboard.curriculaByStatus')}>
          <ul className="flex flex-col gap-3">
            {RECORD_STATUSES.map((s) => (
              <li key={s} className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-3 text-sm">
                <Link to={`/curricula?status=${s}`} className="hover:underline">
                  <StatusBadge status={s} />
                </Link>
                <div className="h-2.5 rounded-full bg-muted" role="presentation">
                  <div
                    className={`h-full rounded-full ${BAR[s]}`}
                    style={{ width: `${(d.curriculaByStatus[s] / max) * 100}%` }}
                  />
                </div>
                <span className="text-end tabular">{f.number(d.curriculaByStatus[s])}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title={t('dashboard.recentActivity')}>
          {!d.recentActivity.length ? (
            <p className="text-sm text-muted-foreground">{t('dashboard.noActivity')}</p>
          ) : (
            <ol className="flex flex-col divide-y">
              {d.recentActivity.map((a) => {
                const to = entityPath(a.entityType, a.entityId);
                return (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      {to ? (
                        <Link to={to} className="font-mono text-xs text-primary hover:underline">
                          {a.action}
                        </Link>
                      ) : (
                        <span className="font-mono text-xs">{a.action}</span>
                      )}
                      <p className="truncate text-xs text-muted-foreground">{a.actorName ?? '—'}</p>
                    </div>
                    <time
                      className="shrink-0 text-xs text-muted-foreground"
                      dateTime={a.occurredAt}
                    >
                      {f.relative(a.occurredAt)}
                    </time>
                  </li>
                );
              })}
            </ol>
          )}
        </Section>
      </div>
    </>
  );
}
