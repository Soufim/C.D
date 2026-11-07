import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/** Confirmation for destructive/irreversible actions. Never use window.confirm(). */
export function ConfirmDialog({ trigger, title, body, confirmLabel, onConfirm, destructive = true }: {
  trigger: ReactNode; title: string; body?: ReactNode; confirmLabel?: string; onConfirm: () => Promise<unknown> | void; destructive?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        {body && <AlertDialogDescription>{body}</AlertDialogDescription>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant={destructive ? 'destructive' : 'default'} loading={busy} onClick={async (e) => {
              e.preventDefault();
              setBusy(true);
              try { await onConfirm(); setOpen(false); } finally { setBusy(false); }
            }}>{confirmLabel ?? t('common.confirm')}</Button>
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
