import { useId, type ReactNode } from 'react';
import { cloneElement, isValidElement, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import type {
  FieldErrors,
  FieldValues,
  Path,
  UseFormProps,
  UseFormRegister,
  UseFormSetError,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Label } from '@/components/ui/label';
import { Input, Textarea } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Accessible form field: label, control, hint and error are wired with ids so screen readers
 * announce them (WCAG 1.3.1, 3.3.1, 3.3.2). Pass exactly one control element as child.
 */
export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: ReactElement;
  className?: string;
}) {
  const { t } = useTranslation();
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': [hintId, errId].filter(Boolean).join(' ') || undefined,
        'aria-required': required || undefined,
      })
    : children;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden>
            {' '}
            *
          </span>
        ) : (
          <span className="ms-1 text-xs font-normal text-muted-foreground">
            ({t('common.optional')})
          </span>
        )}
      </Label>
      {control}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** Two-column layout for form fields that collapses on mobile. */
export const FormGrid = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('grid gap-4 sm:grid-cols-2', className)}>{children}</div>
);

/**
 * English + Arabic inputs for one bilingual attribute. Arabic input is always RTL and
 * English always LTR, independent of the interface language.
 */
export function BilingualField<T extends FieldValues>({
  base,
  label,
  labelEn,
  labelAr,
  register,
  errors,
  required,
  multiline,
  rows = 3,
}: {
  base: string;
  label?: string;
  labelEn: string;
  labelAr: string;
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
}) {
  const en = `${base}En` as Path<T>;
  const ar = `${base}Ar` as Path<T>;
  const err = (k: string) => (errors as Record<string, { message?: string }>)[k]?.message;
  const C = multiline ? Textarea : Input;
  return (
    <fieldset className="grid gap-4 sm:col-span-full sm:grid-cols-2">
      {label && <legend className="sr-only">{label}</legend>}
      <Field label={labelEn} required={required} error={err(en)}>
        <C dir="ltr" lang="en" rows={rows} {...register(en)} />
      </Field>
      <Field label={labelAr} required={required} error={err(ar)}>
        <C dir="rtl" lang="ar" rows={rows} className="font-arabic" {...register(ar)} />
      </Field>
    </fieldset>
  );
}

/** Copies server-side field errors (422 problem details) into react-hook-form. */
export function applyServerErrors<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>,
): boolean {
  if (!(err instanceof ApiError) || !err.problem.errors?.length) return false;
  for (const e of err.problem.errors)
    setError(e.path as Path<T>, { type: 'server', message: e.message });
  return true;
}

/** Converts '' from inputs to null for optional nullable fields. */
export const emptyToNull = <T extends Record<string, unknown>>(o: T): T =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === '' ? null : v])) as T;

/**
 * react-hook-form bound to a zod schema from @cdms/contracts (the same schema the API
 * validates with). Use this for EVERY form — never hand-write validation rules.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useZodForm<S extends z.ZodType<any, any>>(
  schema: S,
  opts: Omit<UseFormProps<z.input<S>, unknown, z.output<S>>, 'resolver'> = {},
) {
  return useForm<z.input<S>, unknown, z.output<S>>({ ...opts, resolver: zodResolver(schema) });
}
