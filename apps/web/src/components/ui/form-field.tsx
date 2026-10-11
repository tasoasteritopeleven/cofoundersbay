import * as React from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { bilingualAria } from '@/lib/i18n/format';

export interface FormFieldProps {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: FormFieldProps) {
  const hintId = htmlFor ? `${htmlFor}-hint` : undefined;
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;
  const existingDescribedBy = React.isValidElement(children)
    ? (children.props as { 'aria-describedby'?: string })['aria-describedby']
    : undefined;
  const describedBy = [existingDescribedBy, error ? errorId : null, hint && !error ? hintId : null]
    .filter(Boolean)
    .join(' ') || undefined;

  const control = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        id: htmlFor ?? (children.props as { id?: string }).id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : (children.props as { 'aria-invalid'?: boolean })['aria-invalid'],
        'aria-required': required || (children.props as { 'aria-required'?: boolean })['aria-required'],
      })
    : children;

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor} className="inline-flex items-center gap-1 text-sm font-medium">
        {label}
        {required && (
          <span className="text-destructive-accessible" aria-hidden="true">
            *
          </span>
        )}
        {required && (
          <span className="sr-only">
            {bilingualAria('required', 'υποχρεωτικό')}
          </span>
        )}
      </Label>
      {control}
      {hint && !error && (
        <p id={hintId} className="text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs leading-relaxed text-destructive-accessible" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
