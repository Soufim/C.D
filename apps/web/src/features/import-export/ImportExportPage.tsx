import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, Download, FileUp } from 'lucide-react';
import { toast } from 'sonner';
import { IMPORTABLE_ENTITIES, PERMISSIONS } from '@cdms/contracts';
import type { ImportableEntity, ImportResult, Paginated, ReferenceListDto } from '@cdms/contracts';
import { api } from '@/lib/api';
import { useCan } from '@/lib/auth';
import { useBilingual, useFormat } from '@/lib/format';
import { errorMessage } from '@/hooks/use-api-mutation';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/input';
import { PageHeader, Section } from '@/components/patterns/page';
import { Field, FormGrid } from '@/components/patterns/form';
import { Notice } from '@/components/patterns/states';

/** Guided import: choose type → download template → validate (dry run) → import. All-or-nothing. */
export function ImportExportPage() {
  const { t } = useTranslation();
  const { pick } = useBilingual();
  const f = useFormat();
  const can = useCan();
  const qc = useQueryClient();
  const [entity, setEntity] = useState<ImportableEntity>('competency');
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [mode, setMode] = useState<'create' | 'upsert'>('create');
  const [listCode, setListCode] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const lists = useQuery({
    queryKey: ['reference', 'lists'],
    queryFn: () => api.get<Paginated<ReferenceListDto>>('/reference-data/lists?pageSize=200'),
  });

  const run = async (dryRun: boolean) => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      Object.entries({ entity, format, mode, dryRun: dryRun ? 'true' : 'false', listCode }).forEach(
        ([k, v]) => v && fd.append(k, v),
      );
      const r = await api.upload<ImportResult>('/import', fd);
      setResult(r);
      if (!dryRun && !r.errors.length) {
        toast.success(t('import.done'));
        void qc.invalidateQueries();
      }
    } catch (e) {
      toast.error(errorMessage(e, t));
    } finally {
      setBusy(false);
    }
  };
  const dl = (path: string, name: string) =>
    api.download(path, name).catch((e) => toast.error(errorMessage(e, t)));

  return (
    <>
      <PageHeader title={t('import.title')} description={t('import.subtitle')} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {can(PERMISSIONS.IMPORT_RUN) && (
          <Section title={t('common.import')}>
            <div className="flex flex-col gap-4">
              <Notice>{t('import.draftsNote')}</Notice>
              <FormGrid>
                <Field label={t('import.entity')} required>
                  <NativeSelect
                    value={entity}
                    onChange={(e) => {
                      setEntity(e.target.value as ImportableEntity);
                      setResult(null);
                    }}
                  >
                    {IMPORTABLE_ENTITIES.map((x) => (
                      <option key={x} value={x}>
                        {t(`import.entities.${x}`)}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label={t('import.format')} required>
                  <NativeSelect
                    value={format}
                    onChange={(e) => setFormat(e.target.value as 'csv' | 'json')}
                  >
                    <option value="csv">CSV (UTF-8)</option>
                    <option value="json">JSON</option>
                  </NativeSelect>
                </Field>
                {entity === 'reference_item' && (
                  <Field label={t('import.listCode')} required>
                    <NativeSelect value={listCode} onChange={(e) => setListCode(e.target.value)}>
                      <option value="">{t('common.select')}</option>
                      {lists.data?.items.map((l) => (
                        <option key={l.id} value={l.code}>
                          {pick(l, 'name')}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                )}
                <Field label={t('import.mode')}>
                  <NativeSelect
                    value={mode}
                    onChange={(e) => setMode(e.target.value as 'create' | 'upsert')}
                  >
                    <option value="create">{t('import.modeCreate')}</option>
                    <option value="upsert">{t('import.modeUpsert')}</option>
                  </NativeSelect>
                </Field>
              </FormGrid>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" onClick={() => input.current?.click()}>
                  <FileUp />
                  {file ? file.name : t('files.choose')}
                </Button>
                <input
                  ref={input}
                  type="file"
                  accept={format === 'csv' ? '.csv,text/csv' : '.json,application/json'}
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    setResult(null);
                  }}
                />
                <Button
                  variant="link"
                  onClick={() => dl(`/import/template/${entity}`, `${entity}-template.csv`)}
                >
                  <Download />
                  {t('import.template')}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  disabled={!file || (entity === 'reference_item' && !listCode)}
                  loading={busy}
                  onClick={() => run(true)}
                >
                  {t('import.validate')}
                </Button>
                <Button
                  disabled={!file || !result?.dryRun || result.errors.length > 0}
                  loading={busy}
                  onClick={() => run(false)}
                >
                  {t('import.run')}
                </Button>
              </div>
              {result && (
                <div aria-live="polite" className="flex flex-col gap-3 rounded-md border p-4">
                  <p className="flex items-center gap-2 font-medium">
                    {result.errors.length ? (
                      <AlertCircle className="size-4 text-destructive" aria-hidden />
                    ) : (
                      <CheckCircle2 className="size-4 text-success" aria-hidden />
                    )}
                    {result.errors.length
                      ? t('import.failed')
                      : result.dryRun
                        ? t('import.dryRunOk')
                        : t('import.done')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('import.rows', { count: result.totalRows })} ·{' '}
                    {t('import.createdN', { count: result.created })} ·{' '}
                    {t('import.updatedN', { count: result.updated })} ·{' '}
                    {t('import.skippedN', { count: result.skipped })} ·{' '}
                    {t('import.errorsN', { count: result.errors.length })}
                  </p>
                  {result.errors.length > 0 && (
                    <ul className="max-h-64 overflow-y-auto text-sm">
                      {result.errors.map((e, i) => (
                        <li key={i} className="border-t py-1.5">
                          <strong>{t('import.rowError', { row: f.number(e.row) })}</strong>
                          {e.field && <code className="mx-1 text-xs">{e.field}</code>}: {e.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </Section>
        )}
        <Section title={t('import.exportTitle')}>
          <ul className="flex flex-col gap-2">
            {IMPORTABLE_ENTITIES.filter((x) => x !== 'reference_item').map((x) => (
              <li key={x} className="flex items-center justify-between gap-2 text-sm">
                <span>{t(`import.entities.${x}`)}</span>
                <span className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => dl(`/export/${x}?format=csv`, `${x}.csv`)}
                  >
                    CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => dl(`/export/${x}?format=json`, `${x}.json`)}
                  >
                    JSON
                  </Button>
                </span>
              </li>
            ))}
            <li className="mt-2 border-t pt-3">
              <Button className="w-full" onClick={() => dl('/export/full', 'cdms-catalogue.json')}>
                <Download />
                {t('import.exportFull')}
              </Button>
            </li>
          </ul>
        </Section>
      </div>
    </>
  );
}
