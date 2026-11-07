import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus } from 'lucide-react';
import { PERMISSIONS } from '@cdms/contracts';
import type { RoleDto } from '@cdms/contracts';
import { api } from '@/lib/api';
import { useCan } from '@/lib/auth';
import { useBilingual } from '@/lib/format';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader, Section } from '@/components/patterns/page';
import { Field, FormGrid } from '@/components/patterns/form';
import { ErrorState, PageLoader } from '@/components/patterns/states';
import { adminKeys, usePermissionCatalog, useRoles } from './api';

function RoleDialog({ record, onClose }: { record?: RoleDto; onClose: () => void }) {
  const { t } = useTranslation();
  const catalog = usePermissionCatalog();
  const [form, setForm] = useState({
    code: record?.code ?? '',
    nameEn: record?.nameEn ?? '',
    nameAr: record?.nameAr ?? '',
    permissions: record?.permissions ?? [],
  });
  const m = useApiMutation({
    fn: () =>
      record
        ? api.patch(`/admin/roles/${record.id}`, { ...form, rowVersion: record.rowVersion })
        : api.post('/admin/roles', form),
    invalidate: [adminKeys.roles],
    success: t('common.save'),
    onSuccess: onClose,
  });
  const groups = Object.entries(
    (catalog.data ?? []).reduce<Record<string, string[]>>((acc, p) => {
      const g = p.split('.')[0] ?? p;
      (acc[g] ??= []).push(p);
      return acc;
    }, {}),
  );
  const toggle = (p: string, on: boolean) =>
    setForm((f) => ({
      ...f,
      permissions: on ? [...f.permissions, p] : f.permissions.filter((x) => x !== p),
    }));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{record ? t('admin.editRole') : t('admin.newRole')}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-5">
          <FormGrid>
            <Field label={t('common.code')} required>
              <Input
                dir="ltr"
                className="font-mono"
                disabled={record?.isSystem}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </Field>
            <div />
            <Field label={t('common.nameEn')} required>
              <Input
                dir="ltr"
                value={form.nameEn}
                onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
              />
            </Field>
            <Field label={t('common.nameAr')} required>
              <Input
                dir="rtl"
                value={form.nameAr}
                onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
              />
            </Field>
          </FormGrid>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">{t('admin.permissions')}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {groups.map(([g, ps]) => (
                <div key={g} className="rounded-md border p-3">
                  <p className="mb-2 font-mono text-xs font-semibold uppercase text-muted-foreground">
                    {g}
                  </p>
                  {ps.map((p) => (
                    <label key={p} className="flex items-center gap-2 py-0.5 text-sm">
                      <Checkbox
                        checked={form.permissions.includes(p)}
                        onCheckedChange={(c) => toggle(p, !!c)}
                      />
                      <code className="text-xs">{p}</code>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </fieldset>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            loading={m.isPending}
            disabled={!form.code || !form.nameEn || !form.nameAr}
            onClick={() => m.mutate()}
          >
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RolesPage() {
  const { t } = useTranslation();
  const { pick } = useBilingual();
  const can = useCan();
  const q = useRoles();
  const [edit, setEdit] = useState<RoleDto | 'new' | null>(null);
  if (q.isLoading) return <PageLoader />;
  if (!q.data) return <ErrorState error={q.error} />;
  return (
    <>
      <PageHeader
        title={t('admin.rolesTitle')}
        description={t('admin.rolesSubtitle')}
        actions={
          can(PERMISSIONS.ROLE_WRITE) && (
            <Button onClick={() => setEdit('new')}>
              <Plus />
              {t('admin.newRole')}
            </Button>
          )
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {q.data.map((r) => (
          <Section
            key={r.id}
            title={pick(r, 'name')}
            description={<span className="font-mono">{r.code}</span>}
            actions={
              can(PERMISSIONS.ROLE_WRITE) && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${t('common.edit')} ${r.code}`}
                  onClick={() => setEdit(r)}
                >
                  <Pencil />
                </Button>
              )
            }
          >
            <p className="mb-3 flex gap-2 text-xs text-muted-foreground">
              {t('admin.usersCount', { count: r.userCount ?? 0 })}
              {r.isSystem && <Badge>{t('admin.systemRole')}</Badge>}
            </p>
            <ul className="flex flex-wrap gap-1">
              {r.permissions.map((p) => (
                <li key={p}>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{p}</code>
                </li>
              ))}
            </ul>
          </Section>
        ))}
      </div>
      {edit && (
        <RoleDialog record={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />
      )}
    </>
  );
}
