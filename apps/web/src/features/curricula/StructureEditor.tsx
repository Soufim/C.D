import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ArrowDown, ArrowUp, Plus, Puzzle, Trash2 } from 'lucide-react';
import type { CurriculumDto, CurriculumUnitDto } from '@cdms/contracts';
import { useBilingual, useFormat } from '@/lib/format';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/input';
import { Switch } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Section } from '@/components/patterns/page';
import { EmptyState } from '@/components/patterns/states';
import { StatusBadge } from '@/components/patterns/status-badge';
import { LinkPicker } from '@/components/patterns/linking';
import type { UnitDto } from '@cdms/contracts';
import { curriculaApi, curriculaKeys } from './api';

type Row = CurriculumUnitDto;

/**
 * Builds the programme structure: units per term, mandatory/elective, ordering.
 * Local draft state is initialised from props; the parent re-mounts it (key=rowVersion) after saves.
 */
export function StructureEditor({
  curriculum,
  editable,
}: {
  curriculum: CurriculumDto;
  editable: boolean;
}) {
  const { t } = useTranslation();
  const { pick } = useBilingual();
  const f = useFormat();
  const [rows, setRows] = useState<Row[]>(curriculum.units ?? []);
  const [picker, setPicker] = useState(false);
  const dirty =
    JSON.stringify(rows.map((r) => [r.unitId, r.term, r.isMandatory])) !==
    JSON.stringify((curriculum.units ?? []).map((r) => [r.unitId, r.term, r.isMandatory]));
  const save = useApiMutation({
    fn: () =>
      curriculaApi.setUnits(curriculum.id, {
        rowVersion: curriculum.rowVersion,
        units: rows.map((r) => ({ unitId: r.unitId, term: r.term, isMandatory: r.isMandatory })),
      }),
    invalidate: [curriculaKeys.detail(curriculum.id), curriculaKeys.coverage(curriculum.id)],
    success: t('curricula.saved'),
  });
  const terms = useMemo(() => [...new Set(rows.map((r) => r.term))].sort((a, b) => a - b), [rows]);
  const maxTerm = Math.max(1, ...rows.map((r) => r.term));
  const update = (id: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.unitId === id ? { ...r, ...patch } : r)));
  const move = (id: string, dir: -1 | 1) =>
    setRows((rs) => {
      const i = rs.findIndex((r) => r.unitId === id);
      const j = i + dir;
      if (j < 0 || j >= rs.length) return rs;
      const copy = [...rs];
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
      return copy;
    });
  const total = (k: 'theoryHours' | 'practicalHours' | 'creditHours') =>
    rows.reduce((a, r) => a + r[k], 0);

  const addUnits = async (ids: string[]) => {
    const units = await Promise.all(ids.map((id) => api.get<UnitDto>(`/units/${id}`)));
    setRows((rs) => [
      ...rs,
      ...units.map((u) => ({
        unitId: u.id,
        code: u.code,
        titleEn: u.titleEn,
        titleAr: u.titleAr,
        status: u.status,
        term: maxTerm,
        sortOrder: rs.length,
        isMandatory: true,
        creditHours: u.creditHours,
        theoryHours: u.theoryHours,
        practicalHours: u.practicalHours,
      })),
    ]);
  };

  return (
    <Section
      title={t('curricula.structure')}
      description={`${f.number(rows.length)} ${t('curricula.units')} · ${t('curricula.theory')} ${f.number(total('theoryHours'))} · ${t('curricula.practical')} ${f.number(total('practicalHours'))} · ${t('common.credits')} ${f.number(total('creditHours'), 1)}`}
      actions={
        editable && (
          <>
            <Button size="sm" variant="outline" onClick={() => setPicker(true)}>
              <Plus />
              {t('curricula.addUnits')}
            </Button>
            <Button
              size="sm"
              disabled={!dirty}
              loading={save.isPending}
              onClick={() => save.mutate()}
            >
              {t('common.saveChanges')}
            </Button>
          </>
        )
      }
    >
      {!rows.length ? (
        <EmptyState
          icon={<Puzzle />}
          title={t('curricula.noUnits')}
          body={t('curricula.noUnitsBody')}
          action={
            editable && (
              <Button size="sm" onClick={() => setPicker(true)}>
                <Plus />
                {t('curricula.addUnits')}
              </Button>
            )
          }
        />
      ) : (
        <div className="flex flex-col gap-5">
          {dirty && (
            <p className="text-sm font-medium text-warning" role="status">
              {t('common.unsavedChanges')}
            </p>
          )}
          {terms.map((term) => (
            <div key={term}>
              <h3 className="mb-2 text-sm font-semibold">
                {t('curricula.termN', { n: f.number(term) })}
              </h3>
              <ul className="divide-y rounded-md border">
                {rows
                  .filter((r) => r.term === term)
                  .map((r) => (
                    <li
                      key={r.unitId}
                      className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/units/${r.unitId}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {pick(r, 'title')}
                        </Link>
                        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-mono">{r.code}</span>
                          <span className="tabular">
                            {f.number(r.theoryHours)}+{f.number(r.practicalHours)}{' '}
                            {t('common.hours')} · {f.number(r.creditHours, 1)} {t('common.credits')}
                          </span>
                          <StatusBadge status={r.status} />
                          {!editable && (
                            <Badge tone={r.isMandatory ? 'primary' : 'neutral'}>
                              {r.isMandatory ? t('curricula.mandatory') : t('curricula.elective')}
                            </Badge>
                          )}
                        </p>
                      </div>
                      {editable && (
                        <div className="flex items-center gap-2">
                          <NativeSelect
                            aria-label={`${t('common.term')} — ${r.code}`}
                            className="h-8 w-24"
                            value={r.term}
                            onChange={(e) => update(r.unitId, { term: Number(e.target.value) })}
                          >
                            {Array.from({ length: Math.min(20, maxTerm + 1) }, (_, i) => i + 1).map(
                              (n) => (
                                <option key={n} value={n}>
                                  {t('curricula.termN', { n })}
                                </option>
                              ),
                            )}
                          </NativeSelect>
                          <label className="flex items-center gap-1.5 text-xs">
                            <Switch
                              checked={r.isMandatory}
                              onCheckedChange={(v) => update(r.unitId, { isMandatory: v })}
                            />
                            {t('curricula.mandatory')}
                          </label>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`${t('templates.moveUp')} ${r.code}`}
                            onClick={() => move(r.unitId, -1)}
                          >
                            <ArrowUp />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`${t('templates.moveDown')} ${r.code}`}
                            onClick={() => move(r.unitId, 1)}
                          >
                            <ArrowDown />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`${t('common.remove')} ${r.code}`}
                            onClick={() => setRows((rs) => rs.filter((x) => x.unitId !== r.unitId))}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <LinkPicker
        open={picker}
        onOpenChange={setPicker}
        title={t('curricula.addUnits')}
        endpoint="/units"
        exclude={rows.map((r) => r.unitId)}
        onConfirm={addUnits}
      />
    </Section>
  );
}
