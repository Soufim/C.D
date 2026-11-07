import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { KeyRound, Pencil, Plus } from 'lucide-react';
import { z } from 'zod';
import { createUserSchema, passwordSchema, PERMISSIONS } from '@cdms/contracts';
import type { UserDto } from '@cdms/contracts';
import { api } from '@/lib/api';
import { useAuth, useCan } from '@/lib/auth';
import { useBilingual, useFormat } from '@/lib/format';
import { useListParams } from '@/hooks/use-list-params';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox, Switch } from '@/components/ui/checkbox';
import { Input, NativeSelect } from '@/components/ui/input';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader } from '@/components/patterns/page';
import { DataTable, ListToolbar, SearchInput, type Column } from '@/components/patterns/data-table';
import { BilingualField, Field, FormGrid, applyServerErrors, useZodForm } from '@/components/patterns/form';
import { RecordSelect } from '@/components/patterns/linking';
import { adminKeys, useRoles, useUsers } from './api';

const editSchema = createUserSchema.omit({ password: true, email: true }).extend({ isActive: z.boolean(), email: z.string() });

function UserDialog({ record, onClose }: { record?: UserDto; onClose: () => void }) {
  const { t } = useTranslation();
  const { pick } = useBilingual();
  const { user: me } = useAuth();
  const roles = useRoles();
  const schema = record ? editSchema : createUserSchema;
  const { register, control, handleSubmit, setError, formState: { errors } } = useForm<Record<string, unknown>>({
    resolver: zodResolver(schema as never),
    defaultValues: record
      ? { email: record.email, fullNameEn: record.fullNameEn, fullNameAr: record.fullNameAr, institutionId: record.institutionId, roleIds: record.roles.map((r) => r.id), locale: record.locale, isActive: record.isActive }
      : { email: '', fullNameEn: '', fullNameAr: '', password: '', institutionId: null, roleIds: [], locale: 'ar' },
  });
  const m = useApiMutation({
    fn: (v: Record<string, unknown>) => {
      if (!record) return api.post('/admin/users', v);
      const { email: _e, locale: _l, ...rest } = v;
      const body: Record<string, unknown> = { ...rest, rowVersion: record.rowVersion };
      if (record.id === me?.id) delete body.roleIds;
      return api.patch(`/admin/users/${record.id}`, body);
    },
    invalidate: [adminKeys.users, adminKeys.roles], success: t('common.save'), toastErrors: false, onSuccess: onClose,
  });
  const e = errors as Record<string, { message?: string }>;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent size="lg">
      <form noValidate className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit((v) => m.mutate(v, { onError: (er) => { if (!applyServerErrors(er, setError)) setError('root', { message: er.message }); } }))}>
        <DialogHeader><DialogTitle>{record ? t('admin.editUser') : t('admin.newUser')}</DialogTitle></DialogHeader>
        <DialogBody><FormGrid>
          {errors.root && <p role="alert" className="sm:col-span-full rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">{errors.root.message}</p>}
          <Field label={t('auth.email')} required error={e.email?.message}><Input type="email" dir="ltr" disabled={!!record} autoComplete="off" {...register('email')} /></Field>
          {!record ? <Field label={t('auth.password')} required error={e.password?.message} hint={t('auth.passwordHint')}><Input type="password" dir="ltr" autoComplete="new-password" {...register('password')} /></Field>
            : <label className="flex items-center gap-2 self-end pb-2 text-sm"><Controller control={control} name="isActive" render={({ field }) => <Switch checked={!!field.value} disabled={record.id === me?.id} onCheckedChange={field.onChange} />} />{t('common.active')}</label>}
          <BilingualField base="fullName" labelEn={t('admin.fullNameEn')} labelAr={t('admin.fullNameAr')} register={register} errors={errors} required />
          <Field label={t('admin.institution')}><Controller control={control} name="institutionId" render={({ field }) => <RecordSelect endpoint="/institutions" value={field.value as string | null} onChange={field.onChange} initial={record?.institutionId ? { id: record.institutionId, code: '', titleEn: record.institutionNameEn ?? '', titleAr: record.institutionNameEn ?? '' } : null} />} /></Field>
          {!record && <Field label={t('common.language')}><NativeSelect {...register('locale')}><option value="ar">العربية</option><option value="en">English</option></NativeSelect></Field>}
          <fieldset className="sm:col-span-full" disabled={record?.id === me?.id}>
            <legend className="mb-2 text-sm font-medium">{t('admin.roles')}</legend>
            <Controller control={control} name="roleIds" render={({ field }) => {
              const val = (field.value as string[]) ?? [];
              return (
                <div className="grid gap-2 sm:grid-cols-2">
                  {roles.data?.map((r) => (
                    <label key={r.id} className="flex items-start gap-2 rounded-md border p-2.5 text-sm has-[:checked]:border-primary">
                      <Checkbox checked={val.includes(r.id)} onCheckedChange={(c) => field.onChange(c ? [...val, r.id] : val.filter((x) => x !== r.id))} />
                      <span><span className="font-medium">{pick(r, 'name')}</span><span className="block font-mono text-xs text-muted-foreground">{r.code}</span></span>
                    </label>
                  ))}
                </div>
              );
            }} />
          </fieldset>
        </FormGrid></DialogBody>
        <DialogFooter><Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button><Button type="submit" loading={m.isPending}>{t('common.save')}</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  );
}

function ResetPasswordDialog({ user, onClose }: { user: UserDto; onClose: () => void }) {
  const { t } = useTranslation();
  const { register, handleSubmit, formState: { errors } } = useZodForm(z.object({ newPassword: passwordSchema }));
  const m = useApiMutation({ fn: (v: { newPassword: string }) => api.post(`/admin/users/${user.id}/reset-password`, v), success: t('admin.passwordReset'), onSuccess: onClose });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent size="sm">
      <form noValidate className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit((v) => m.mutate(v))}>
        <DialogHeader><DialogTitle>{t('admin.resetPassword')}</DialogTitle></DialogHeader>
        <DialogBody><p className="mb-3 text-sm" dir="ltr">{user.email}</p>
          <Field label={t('auth.newPassword')} required error={errors.newPassword?.message} hint={t('auth.passwordHint')}><Input type="password" dir="ltr" autoComplete="new-password" {...register('newPassword')} /></Field>
        </DialogBody>
        <DialogFooter><Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button><Button type="submit" loading={m.isPending}>{t('admin.resetPassword')}</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  );
}

export function UsersPage() {
  const { t } = useTranslation();
  const { pick, t2 } = useBilingual();
  const f = useFormat();
  const can = useCan();
  const canWrite = can(PERMISSIONS.USER_WRITE);
  const { params, set, toggleSort } = useListParams({ sort: 'email' });
  const q = useUsers(params);
  const [edit, setEdit] = useState<UserDto | 'new' | null>(null);
  const [reset, setReset] = useState<UserDto | null>(null);
  const columns: Column<UserDto>[] = [
    { key: 'name', header: t('common.name'), sortKey: 'fullNameEn', cell: (u) => <span className="flex flex-col"><span className="font-medium">{t2(u.fullNameEn, u.fullNameAr)}</span><span className="text-xs text-muted-foreground" dir="ltr">{u.email}</span></span> },
    { key: 'roles', header: t('admin.roles'), cell: (u) => <span className="flex flex-wrap gap-1">{u.roles.map((r) => <Badge key={r.id} tone="primary">{pick(r, 'name')}</Badge>)}</span> },
    { key: 'inst', header: t('admin.institution'), cell: (u) => u.institutionNameEn ?? '—', hideOnMobile: true },
    { key: 'login', header: t('admin.lastLogin'), sortKey: 'lastLoginAt', cell: (u) => (u.lastLoginAt ? f.relative(u.lastLoginAt) : t('admin.never')), hideOnMobile: true },
    { key: 'active', header: t('common.status'), cell: (u) => <Badge tone={u.isActive ? 'success' : 'neutral'}>{u.isActive ? t('common.active') : t('common.inactive')}</Badge> },
    ...(canWrite ? [{ key: 'act', header: <span className="sr-only">{t('common.actions')}</span>, className: 'w-24', cell: (u: UserDto) => <span className="flex">
      <Button variant="ghost" size="icon-sm" aria-label={`${t('common.edit')} ${u.email}`} onClick={() => setEdit(u)}><Pencil /></Button>
      <Button variant="ghost" size="icon-sm" aria-label={`${t('admin.resetPassword')} ${u.email}`} onClick={() => setReset(u)}><KeyRound /></Button></span> }] : []),
  ];
  return (
    <>
      <PageHeader title={t('admin.users')} description={t('admin.usersSubtitle')} actions={canWrite && <Button onClick={() => setEdit('new')}><Plus />{t('admin.newUser')}</Button>} />
      <Card>
        <ListToolbar><SearchInput value={params.q} onChange={(v) => set({ q: v })} /></ListToolbar>
        <DataTable caption={t('admin.users')} columns={columns} data={q.data} loading={q.isLoading} error={q.error} rowKey={(u) => u.id}
          sort={{ key: params.sort, order: params.order, onSort: toggleSort }} page={{ onPage: (p) => set({ page: p }, false), onPageSize: (s) => set({ pageSize: s }) }} />
      </Card>
      {edit && <UserDialog record={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
      {reset && <ResetPasswordDialog user={reset} onClose={() => setReset(null)} />}
    </>
  );
}
