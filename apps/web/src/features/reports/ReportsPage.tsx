import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { RECORD_STATUSES } from '@cdms/contracts';
import type { LinkedRef, RecordStatus } from '@cdms/contracts';
import { api } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { entityLabelKey } from '@/lib/entities';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { PageHeader, Section } from '@/components/patterns/page';
import { ErrorState, PageLoader } from '@/components/patterns/states';
import { LinkedRecords } from '@/components/patterns/linking';
import { StatusBadge } from '@/components/patterns/status-badge';

interface Report {
  orphanCompetencies: LinkedRef[];
  orphanUnits: LinkedRef[];
  occupationsWithoutProfile: LinkedRef[];
  statusMatrix: { entity: string; status: RecordStatus; n: number }[];
}

export function ReportsPage() {
  const { t } = useTranslation();
  const f = useFormat();
  const q = useQuery({
    queryKey: ['reports', 'standardisation'],
    queryFn: () => api.get<Report>('/reports/standardisation'),
  });
  if (q.isLoading) return <PageLoader />;
  if (!q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const entities = [...new Set(q.data.statusMatrix.map((r) => r.entity))];
  const n = (e: string, s: string) =>
    q.data!.statusMatrix.find((r) => r.entity === e && r.status === s)?.n ?? 0;
  return (
    <>
      <PageHeader title={t('reports.title')} description={t('reports.subtitle')} />
      <div className="flex flex-col gap-5">
        <Section title={t('reports.statusMatrix')}>
          <Table>
            <caption className="sr-only">{t('reports.statusMatrix')}</caption>
            <THead>
              <TR>
                <TH>{t('reports.entity')}</TH>
                {RECORD_STATUSES.map((s) => (
                  <TH key={s} className="text-end">
                    <StatusBadge status={s} />
                  </TH>
                ))}
              </TR>
            </THead>
            <TBody>
              {entities.map((e) => (
                <TR key={e}>
                  <TD className="font-medium">{t(entityLabelKey(e))}</TD>
                  {RECORD_STATUSES.map((s) => (
                    <TD key={s} className="text-end tabular">
                      {f.number(n(e, s))}
                    </TD>
                  ))}
                </TR>
              ))}
            </TBody>
          </Table>
        </Section>
        <div className="grid gap-5 lg:grid-cols-3">
          <Section
            title={`${t('reports.orphanCompetencies')} (${q.data.orphanCompetencies.length})`}
          >
            <LinkedRecords items={q.data.orphanCompetencies} entityType="competency" />
          </Section>
          <Section title={`${t('reports.orphanUnits')} (${q.data.orphanUnits.length})`}>
            <LinkedRecords items={q.data.orphanUnits} entityType="unit" />
          </Section>
          <Section title={`${t('reports.noProfile')} (${q.data.occupationsWithoutProfile.length})`}>
            <LinkedRecords items={q.data.occupationsWithoutProfile} entityType="occupation" />
          </Section>
        </div>
      </div>
    </>
  );
}
