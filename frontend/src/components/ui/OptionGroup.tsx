import { cn } from '@/lib/utils';
import { Icon } from './Icon';

/*
 * /DESIGN.md §Components — OptionGroup: a required-or-skippable single-select
 * survey question, never a native <select>. Unlike Dropdown (which always
 * resolves to a selected value), `value` may be `null` — the whole point for
 * onboarding/placement's optional questions, where no answer is a valid,
 * honest state rather than a silently-defaulted first option.
 *
 * IT IS THE STUDY'S CHOOSABLE CARD (2026-09-07, /DESIGN.md §The study's
 * component set). "Any grid where one of N is chosen" is the definition of
 * `.lf-pick-card`, and this component is the platform's only generic one of
 * those — so selection is signalled the four ways the study signals it (fill,
 * 2px border, outer glow, corner check disc) rather than by a tinted border
 * and a trailing tick. The trailing tick is gone because the disc replaces it:
 * two checks for one state is the state saying it twice.
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
              'lf-pick-card lf-label motion-safe-press flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left text-content',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              selected && 'lf-pick-card-on',
            )}
          >
            {selected && (
              <span className="lf-pick-check" aria-hidden>
                <Icon name="check" className="!text-[12px]" />
              </span>
            )}
            <span className="flex flex-col gap-0.5">
              <span>{option.label}</span>
              {option.description && <span className="lf-caption text-content-muted">{option.description}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
