import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/*
 * /DESIGN.md §Components — Field: labeled text input. rounded-md container
 * radius (inputs are containers, not pills), surface fill, hairline outline,
 * primary focus ring, error state on the error token. Both themes via
 * semantic tokens.
 */

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  trailing?: ReactNode;
}

export function Field({ label, hint, error, trailing, className, id, ...props }: FieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={inputId} className="lf-label text-content">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={cn(
            'lf-body min-h-12 w-full rounded-md border bg-surface px-4 text-content placeholder:text-content-muted',
            'transition-[border-color,box-shadow] duration-150',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 focus:ring-offset-base',
            error ? 'border-error' : 'border-outline hover:border-content-faint focus:border-primary',
            trailing && 'pr-12',
          )}
          {...props}
        />
        {trailing && <div className="absolute inset-y-0 right-2 flex items-center">{trailing}</div>}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="lf-caption text-error-strong">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="lf-caption text-content-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
