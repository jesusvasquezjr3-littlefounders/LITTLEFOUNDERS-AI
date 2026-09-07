import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui';
import { cn } from '@/lib/utils';

/*
 * Day picker for the custom analytics range.
 *
 * Purpose-built because `<input type="date">` is prohibited as a choice
 * control (frontend/AGENTS.md): the browser default ignores our tokens, our
 * dark mode and our locale, and looks like nothing else in the console.
 *
 * Pill trigger, month grid, keyboard reachable, no future days (a window that
 * ends in the future would report a partial period as a complete one).
 */

const WEEK_START = 1; // Monday, matching es-MX and pt-BR conventions

function iso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseIso(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** Days of `month`, padded with leading blanks so the first row lines up. */
function monthGrid(month: Date): (Date | null)[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const lead = (first.getDay() - WEEK_START + 7) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];
}

export function DateField({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: string;
  /** Latest selectable day, inclusive. */
  max: string;
  onChange: (value: string) => void;
}) {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => parseIso(value));
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selected = value;
  const maxDate = parseIso(max);
  const dayFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  const monthFmt = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
  const weekdayFmt = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
  /*
   * Anchored on a known SUNDAY (2024-01-07) and walked forward, so column i
   * always names the same weekday the grid puts there. Anchoring on a Monday
   * and adding `WEEK_START + i` shifted the header one column off the days.
   */
  const weekdays = Array.from({ length: 7 }, (_, i) => weekdayFmt.format(new Date(2024, 0, 7 + ((WEEK_START + i) % 7))));

  return (
    <div ref={rootRef} className="relative flex min-w-0 flex-col gap-1">
      <span className="lf-caption text-content-muted">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}, ${dayFmt.format(parseIso(value))}`}
        className="flex min-h-11 items-center justify-between gap-2 rounded-full border border-outline bg-surface px-4 py-2 text-left font-bold text-content transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span className="truncate">{dayFmt.format(parseIso(value))}</span>
        <Icon name="calendar_month" className="!text-[18px] shrink-0 text-content-muted" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={label}
          className="lf-glass absolute top-full z-30 mt-2 w-[17.5rem] rounded-md border border-outline/50 p-3 shadow-pop"
        >
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label={monthFmt.format(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              className="flex h-11 w-11 items-center justify-center rounded-full text-content-muted transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Icon name="chevron_left" className="!text-[20px]" />
            </button>
            <span className="lf-label font-bold capitalize text-content">{monthFmt.format(month)}</span>
            <button
              type="button"
              aria-label={monthFmt.format(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              className="flex h-11 w-11 items-center justify-center rounded-full text-content-muted transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Icon name="chevron_right" className="!text-[20px]" />
            </button>
          </div>

          <div className="mt-2 grid grid-cols-7 gap-0.5">
            {weekdays.map((day, index) => (
              <span key={`${day}-${index}`} className="lf-caption py-1 text-center uppercase text-content-faint">
                {day}
              </span>
            ))}
            {monthGrid(month).map((day, index) => {
              if (!day) return <span key={`pad-${index}`} />;
              const key = iso(day);
              const disabled = day > maxDate;
              const isSelected = key === selected;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={disabled}
                  aria-current={isSelected ? 'date' : undefined}
                  onClick={() => {
                    onChange(key);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex h-9 items-center justify-center rounded-full text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    disabled && 'cursor-not-allowed text-content-faint/50',
                    !disabled && !isSelected && 'text-content hover:bg-surface-sunken',
                    isSelected && 'bg-accent font-bold text-on-accent',
                  )}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
