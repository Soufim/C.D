import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as AlertPrimitive from '@radix-ui/react-alert-dialog';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { buttonVariants } from './button';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

const overlay = 'fixed inset-0 z-50 bg-black/50';

/**
 * Modal dialog. On phones it becomes a bottom sheet (full width, scrollable).
 * size: sm (confirmations) | md (forms) | lg (complex forms) | xl (pickers/builders)
 */
export function DialogContent({
  className,
  children,
  size = 'md',
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const { t } = useTranslation();
  const width = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl', xl: 'sm:max-w-5xl' }[
    size
  ];
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlay} />
      <DialogPrimitive.Content
        className={cn(
          'fixed z-50 flex max-h-[92dvh] w-full flex-col gap-0 border bg-card shadow-lg inset-x-0 bottom-0 rounded-t-xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg',
          width,
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="absolute end-3 top-3 rounded-md p-1.5 text-muted-foreground hover:bg-muted"
          aria-label={t('common.close')}
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export const DialogHeader = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-1 border-b px-5 py-4 pe-12', className)} {...p} />
);
export const DialogBody = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex-1 overflow-y-auto px-5 py-4', className)} {...p} />
);
export const DialogFooter = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse gap-2 border-t px-5 py-3 sm:flex-row sm:justify-end',
      className,
    )}
    {...p}
  />
);
export const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...p }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('text-lg font-semibold', className)} {...p} />
));
DialogTitle.displayName = 'DialogTitle';
export const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...p }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...p}
  />
));
DialogDescription.displayName = 'DialogDescription';

// Alert dialog — for destructive or irreversible confirmations only.
export const AlertDialog = AlertPrimitive.Root;
export const AlertDialogTrigger = AlertPrimitive.Trigger;
export function AlertDialogContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof AlertPrimitive.Content>) {
  return (
    <AlertPrimitive.Portal>
      <AlertPrimitive.Overlay className={overlay} />
      <AlertPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border bg-card p-5 shadow-lg',
          className,
        )}
        {...props}
      />
    </AlertPrimitive.Portal>
  );
}
export const AlertDialogTitle = (
  p: React.ComponentPropsWithoutRef<typeof AlertPrimitive.Title>,
) => <AlertPrimitive.Title className="text-lg font-semibold" {...p} />;
export const AlertDialogDescription = (
  p: React.ComponentPropsWithoutRef<typeof AlertPrimitive.Description>,
) => <AlertPrimitive.Description className="text-sm text-muted-foreground" {...p} />;
export const AlertDialogCancel = ({
  className,
  ...p
}: React.ComponentPropsWithoutRef<typeof AlertPrimitive.Cancel>) => (
  <AlertPrimitive.Cancel className={cn(buttonVariants({ variant: 'outline' }), className)} {...p} />
);
export const AlertDialogAction = AlertPrimitive.Action;

/** Side sheet (navigation drawer on mobile, secondary panels). Opens from the inline-start edge. */
export function SheetContent({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlay} />
      <DialogPrimitive.Content
        className={cn(
          'fixed inset-y-0 start-0 z-50 flex h-dvh w-72 max-w-[85vw] flex-col shadow-lg outline-none',
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
