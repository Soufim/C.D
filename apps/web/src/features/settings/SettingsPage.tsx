import { useTranslation } from 'react-i18next';
import { changePasswordSchema, updateProfileSchema } from '@cdms/contracts';
import type { ChangePasswordInput, SessionUser, UpdateProfileInput } from '@cdms/contracts';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { applyLocale } from '@/lib/i18n';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { useTheme } from '@/app/AppShell';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { Switch } from '@/components/ui/checkbox';
import { PageHeader, Section } from '@/components/patterns/page';
import {
  BilingualField,
  Field,
  FormGrid,
  applyServerErrors,
  useZodForm,
} from '@/components/patterns/form';

export function SettingsPage() {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();
  const theme = useTheme();
  const profile = useZodForm(updateProfileSchema, {
    defaultValues: {
      fullNameEn: user?.fullNameEn,
      fullNameAr: user?.fullNameAr,
      locale: user?.locale,
    },
  });
  const pw = useZodForm(changePasswordSchema, {
    defaultValues: { currentPassword: '', newPassword: '' },
  });
  const saveProfile = useApiMutation({
    fn: (v: UpdateProfileInput) => api.patch<SessionUser>('/auth/me', v),
    success: t('settings.saved'),
    onSuccess: (u) => {
      setUser(u);
      applyLocale(u.locale);
    },
  });
  const changePw = useApiMutation({
    fn: (v: ChangePasswordInput) => api.post('/auth/change-password', v),
    success: t('auth.passwordChanged'),
    toastErrors: false,
    onSuccess: () => pw.reset(),
  });
  return (
    <>
      <PageHeader title={t('settings.title')} description={t('settings.subtitle')} />
      <div className="grid max-w-4xl gap-5">
        <Section title={t('settings.profile')}>
          <form
            noValidate
            onSubmit={profile.handleSubmit((v) => saveProfile.mutate(v))}
            className="flex flex-col gap-4"
          >
            <FormGrid>
              <Field label={t('auth.email')}>
                <Input value={user?.email} disabled dir="ltr" />
              </Field>
              <Field label={t('common.language')} hint={t('settings.languageHint')}>
                <NativeSelect {...profile.register('locale')}>
                  <option value="ar">العربية</option>
                  <option value="en">English</option>
                </NativeSelect>
              </Field>
              <BilingualField
                base="fullName"
                labelEn={t('admin.fullNameEn')}
                labelAr={t('admin.fullNameAr')}
                register={profile.register}
                errors={profile.formState.errors}
                required
              />
            </FormGrid>
            <div>
              <Button type="submit" loading={saveProfile.isPending}>
                {t('common.saveChanges')}
              </Button>
            </div>
          </form>
        </Section>
        <Section title={t('settings.preferences')}>
          <label className="flex items-center gap-3 text-sm">
            <Switch checked={theme.dark} onCheckedChange={theme.toggle} />
            {t('common.dark')}
          </label>
        </Section>
        <Section title={t('auth.changePassword')}>
          <form
            noValidate
            onSubmit={pw.handleSubmit((v) =>
              changePw.mutate(v, {
                onError: (e) => {
                  if (!applyServerErrors(e, pw.setError))
                    pw.setError('root', { message: e.message });
                },
              }),
            )}
            className="flex flex-col gap-4"
          >
            {pw.formState.errors.root && (
              <p
                role="alert"
                className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive"
              >
                {pw.formState.errors.root.message}
              </p>
            )}
            <FormGrid>
              <Field
                label={t('auth.currentPassword')}
                required
                error={pw.formState.errors.currentPassword?.message}
              >
                <Input
                  type="password"
                  dir="ltr"
                  autoComplete="current-password"
                  {...pw.register('currentPassword')}
                />
              </Field>
              <Field
                label={t('auth.newPassword')}
                required
                error={pw.formState.errors.newPassword?.message}
                hint={t('auth.passwordHint')}
              >
                <Input
                  type="password"
                  dir="ltr"
                  autoComplete="new-password"
                  {...pw.register('newPassword')}
                />
              </Field>
            </FormGrid>
            <div>
              <Button type="submit" loading={changePw.isPending}>
                {t('auth.changePassword')}
              </Button>
            </div>
          </form>
        </Section>
      </div>
    </>
  );
}
