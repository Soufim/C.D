import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, FileQuestion, Inbox, Lock } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { errorMessage } from '@/hooks/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function EmptyState({
  title,
  body,
  action,
  icon,
  className,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 px-4 py-10 text-center',
        className,
      )}
    >
      <div
        className="mb-1 rounded-full bg-muted p-3 text-muted-foreground [&_svg]:size-6"
        aria-hidden
      >
        {icon ?? <Inbox />}
      </div>
      <p className="font-medium">{title}</p>
      {body && <p className="max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Renders any query error. 404s and 403s get specific copy. */
export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const status = error instanceof ApiError ? error.status : 0;
  if (status === 404)
    return (
      <EmptyState
        className={className}
        icon={<FileQuestion />}
        title={t('errors.notFound')}
        body={t('errors.notFoundBody')}
      />
    );
  if (status === 403)
    return <EmptyState className={className} icon={<Lock />} title={t('errors.forbidden')} />;
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center gap-2 px-4 py-10 text-center', className)}
    >
      <AlertTriangle className="size-6 text-destructive" aria-hidden />
      <p className="font-medium">{t('errors.generic')}</p>
      <p className="max-w-md text-sm text-muted-foreground">{errorMessage(error, t)}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
}

export function PageLoader() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">{t('common.loading')}</span>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-40 lg:col-span-2" />
        <Skeleton className="h-40" />
      </div>
    </div>
  );
}

/** Inline alert for record-level messages (locked record, conflict, info). */
export function Notice({
  tone = 'info',
  children,
  action,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  children: ReactNode;
  action?: ReactNode;
}) {
  const tones = {
    info: 'bg-info-soft text-info',
    warning: 'bg-warning-soft text-warning',
    danger: 'bg-destructive-soft text-destructive',
    success: 'bg-success-soft text-success',
  };
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex flex-col gap-2 rounded-md px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between',
        tones[tone],
      )}
    >
      <div className="text-foreground/90 [&_strong]:text-foreground">{children}</div>
      {action}
    </div>
  );
}
