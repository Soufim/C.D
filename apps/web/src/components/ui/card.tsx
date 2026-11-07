import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Card = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('rounded-lg border bg-card text-card-foreground shadow-sm', className)}
    {...p}
  />
);
export const CardHeader = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-1 p-4 sm:p-5 pb-0 sm:pb-0', className)} {...p} />
);
export const CardTitle = ({ className, children, ...p }: HTMLAttributes<HTMLHeadingElement>) => (
  <h2 className={cn('text-base font-semibold leading-tight', className)} {...p}>
    {children}
  </h2>
);
export const CardDescription = ({ className, ...p }: HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn('text-sm text-muted-foreground', className)} {...p} />
);
export const CardContent = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('p-4 sm:p-5', className)} {...p} />
);
export const CardFooter = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex items-center gap-2 border-t p-4 sm:px-5', className)} {...p} />
);
