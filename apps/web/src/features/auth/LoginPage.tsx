import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { GraduationCap, Languages, ShieldCheck } from 'lucide-react';
import { loginSchema } from '@cdms/contracts';
import { useAuth } from '@/lib/auth';
import { applyLocale } from '@/lib/i18n';
import { errorMessage } from '@/hooks/use-api-mutation';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, useZodForm } from '@/components/patterns/form';
import { Notice } from '@/components/patterns/states';

export function LoginPage() {
  const { t, i18n } = useTranslation();
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useZodForm(loginSchema);
  if (status === 'authenticated') return <Navigate to={location.state?.from ?? '/'} replace />;

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      await login(v);
      navigate(location.state?.from ?? '/', { replace: true });
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 401
          ? e.problem.title === 'Invalid email or password'
            ? t('auth.invalid')
            : (e.problem.detail ?? e.problem.title)
          : errorMessage(e, t),
      );
    }
  });

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,560px)]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="size-6" aria-hidden />
          </span>
          <div>
            <p className="font-semibold">{t('app.fullName')}</p>
            <p className="text-sm text-sidebar-muted">{t('app.ministry')}</p>
          </div>
        </div>
        <div className="max-w-lg">
          <p className="text-3xl font-semibold leading-tight text-balance">
            {t('curricula.subtitle')}
          </p>
          <ul className="mt-8 grid gap-3 text-sm text-sidebar-muted">
            <li>• {t('nav.occupations')} · ISCO-08</li>
            <li>
              • {t('nav.competencies')} · {t('nav.units')} · {t('nav.frameworks')}
            </li>
            <li>
              • {t('nav.templates')} · {t('workflow.title')} · {t('nav.audit')}
            </li>
          </ul>
        </div>
        <p className="flex items-center gap-2 text-xs text-sidebar-muted">
          <ShieldCheck className="size-4" aria-hidden />
          {t('auth.secureNotice')}
        </p>
      </div>
      <main className="flex flex-col justify-center px-6 py-10 sm:px-12">
        <div className="mb-8 flex items-center justify-between">
          <span className="flex items-center gap-2 lg:invisible">
            <GraduationCap className="size-6 text-primary" aria-hidden />
            <span className="font-semibold">{t('app.name')}</span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => applyLocale(i18n.language === 'ar' ? 'en' : 'ar')}
          >
            <Languages />
            {i18n.language === 'ar' ? 'English' : 'العربية'}
          </Button>
        </div>
        <div className="mx-auto w-full max-w-sm">
          <h1 className="text-2xl font-semibold">{t('auth.signIn')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('auth.welcome')}</p>
          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
            {error && <Notice tone="danger">{error}</Notice>}
            <Field label={t('auth.email')} required error={errors.email?.message}>
              <Input
                type="email"
                autoComplete="username"
                dir="ltr"
                autoFocus
                {...register('email')}
              />
            </Field>
            <Field label={t('auth.password')} required error={errors.password?.message}>
              <Input
                type="password"
                autoComplete="current-password"
                dir="ltr"
                {...register('password')}
              />
            </Field>
            <Button type="submit" size="lg" loading={isSubmitting}>
              {t('auth.signIn')}
            </Button>
          </form>
          {import.meta.env.DEV && (
            <details className="mt-8 rounded-md border p-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer font-medium">{t('auth.demoAccounts')}</summary>
              <p className="mt-2" dir="ltr">
                admin@cdms.local · manager@ · developer@ · reviewer@ · viewer@cdms.local — see seed
                output.
              </p>
            </details>
          )}
        </div>
      </main>
    </div>
  );
}
