import { cn } from '@/lib/utils';
import { Icon } from './Icon';

/*
 * /DESIGN.md §Components — OptionGroup: a required-or-skippable single-select
 * survey question, never a native <select>. Unlike Dropdown (which always
 * resolves to a selected value), `value` may be `null` — the whole point for
 * onboarding/placement's optional questions, where no answer is a valid,
 * honest state rather than a silently-defaulted first option.
 */

export interface OptionGroupOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

interface OptionGroupProps<T extends string> {
  value: T | null;
  options: OptionGroupOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}

export function OptionGroup<T extends string>({ value, options, onChange, ariaLabel, className }: OptionGroupProps<T>) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn('flex flex-col gap-2', className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'lf-label motion-safe-press flex min-h-11 w-full items-center justify-between gap-3 rounded-md border px-4 py-3 text-left transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              selected
                ? 'border-primary/60 bg-primary-soft text-primary'
                : 'border-outline/30 bg-surface-sunken text-content hover:border-outline/60',
            )}
          >
            <span className="flex flex-col gap-0.5">
              <span>{option.label}</span>
              {option.description && <span className="lf-caption text-content-muted">{option.description}</span>}
            </span>
            {selected && <Icon name="check_circle" className="shrink-0 text-primary" />}
          </button>
        );
      })}
    </div>
  );
}
