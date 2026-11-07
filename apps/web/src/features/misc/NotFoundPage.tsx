import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/patterns/states';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={<FileQuestion />}
      title={t('errors.pageNotFound')}
      action={
        <Button asChild>
          <Link to="/">{t('errors.goHome')}</Link>
        </Button>
      }
    />
  );
}
