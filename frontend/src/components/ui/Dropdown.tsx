import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Icon } from './Icon';

/*
 * /DESIGN.md §Components — Dropdown: our own listbox, never a native
 * <select>/browser-default picker. Clay trigger + clay-sm floating panel.
 */

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
  prefix?: ReactNode; // e.g. a flag emoji
}

interface DropdownProps<T extends string> {
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}

export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className="lf-label motion-safe-press flex min-h-11 items-center gap-1.5 rounded-md bg-surface-sunken px-3 py-2 text-content shadow-clay-sunken transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {selected?.prefix}
        <span>{selected?.label}</span>
        <Icon name="expand_more" className={cn('text-base transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          className="lf-pop absolute right-0 z-50 mt-2 min-w-full overflow-hidden rounded-md border border-white bg-surface py-1 shadow-clay dark:border-white/10"
        >
          {options.map((option) => (
            <li key={option.value} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  'lf-label flex min-h-11 w-full items-center gap-2 whitespace-nowrap px-4 py-2 text-left transition-colors',
                  option.value === value
                    ? 'bg-primary-soft text-primary'
                    : 'text-content hover:bg-surface-sunken',
                )}
              >
                {option.prefix}
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
