import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Icon } from './Icon';

/*
 * /DESIGN.md §Components — Dropdown: our own listbox, never a native
 * <select>/browser-default picker. Pill trigger + frosted glass panel.
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
  /** Trigger shows only the prefix (e.g. a flag) — full label stays in the open panel. */
  compact?: boolean;
  /** Controls if the dropdown opens downwards (default) or upwards */
  placement?: 'top' | 'bottom';
  /** Controls horizontal alignment of the panel relative to the trigger. Defaults to right. */
  align?: 'left' | 'right';
}

interface FloatingPosition {
  top: number;
  left?: number;
  right?: number;
  minWidth: number;
  placement: 'top' | 'bottom';
}

export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
  compact = false,
  placement = 'bottom',
  align = 'right',
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const [position, setPosition] = useState<FloatingPosition | null>(null);
  const selected = options.find((o) => o.value === value) ?? options[0];

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;

    const updatePosition = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const gap = 8;
      const panelHeight = Math.min(240, window.innerHeight - gap * 2);
      const spaceBelow = window.innerHeight - rect.bottom - gap;
      const spaceAbove = rect.top - gap;
      const resolvedPlacement = placement === 'top'
        ? (spaceAbove >= Math.min(panelHeight, 240) || spaceAbove > spaceBelow ? 'top' : 'bottom')
        : (spaceBelow >= Math.min(panelHeight, 240) || spaceBelow >= spaceAbove ? 'bottom' : 'top');

      setPosition({
        top: resolvedPlacement === 'top' ? rect.top - gap : rect.bottom + gap,
        ...(align === 'left' ? { left: Math.max(gap, rect.left) } : { right: Math.max(gap, window.innerWidth - rect.right) }),
        minWidth: rect.width,
        placement: resolvedPlacement,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [align, open, placement]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
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
        aria-label={selected ? `${ariaLabel}: ${selected.label}` : ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'lf-label motion-safe-press flex items-center rounded-full bg-surface-sunken text-content transition-all duration-150 hover:bg-outline/60 lf-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          compact ? 'h-11 px-3 gap-1' : 'min-h-11 px-4 py-2 gap-1.5',
        )}
      >
        {selected?.prefix}
        {!compact && <span>{selected?.label}</span>}
        <Icon name="expand_more" className={cn('text-[16px] transition-all', open && 'rotate-180')} />
      </button>

      {open && position && createPortal(
        <ul
          ref={panelRef}
          role="listbox"
          aria-label={ariaLabel}
          style={{
            top: position.top,
            left: position.left,
            right: position.right,
            minWidth: position.minWidth,
            maxHeight: Math.min(240, window.innerHeight - 16),
            transform: position.placement === 'top' ? 'translateY(-100%)' : undefined,
          }}
          className="lf-pop lf-glass fixed z-[100] max-w-[calc(100vw-1rem)] overflow-y-auto rounded-md py-1 shadow-pop"
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
        </ul>,
        document.body,
      )}
    </div>
  );
}
