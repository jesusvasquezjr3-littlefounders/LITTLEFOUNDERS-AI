import { useId, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Icon } from './Icon';

/*
 * /DESIGN.md §Components — Checkbox: custom square-rounded control (native
 * appearance suppressed), primary fill when checked, label + optional help
 * text form one large tap target.
 */

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  help?: string;
}

export function Checkbox({ label, help, className, id, checked, ...props }: CheckboxProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const helpId = `${inputId}-help`;

  return (
    <label
      htmlFor={inputId}
      className={cn(
        'group flex cursor-pointer items-start gap-3 rounded-md p-1 -m-1',
        'focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 focus-within:ring-offset-base',
        className,
      )}
    >
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        aria-describedby={help ? helpId : undefined}
        className="peer sr-only"
        {...props}
      />
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border transition-colors duration-150',
          checked ? 'border-primary bg-primary text-on-primary' : 'border-outline bg-surface group-hover:border-primary',
        )}
      >
        {checked && <Icon name="check" className="!text-[18px]" />}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="lf-label text-content">{label}</span>
        {help && (
          <span id={helpId} className="lf-caption text-content-muted">
            {help}
          </span>
        )}
      </span>
    </label>
  );
}
