import { useId, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

/*
 * A date, entered as three numbers.
 *
 * WHY NOT `<input type="date">`. /DESIGN.md forbids native pickers outright
 * ("never `<select>`, `<input type="date">`, etc. as a choice control"), and
 * for good reasons beyond consistency: the native control renders in the
 * BROWSER's locale rather than the one the visitor chose, its calendar opens on
 * the current month when the answer is thirty years earlier, and on Android it
 * is a full-screen takeover in the middle of an identity form.
 *
 * WHY NOT A SINGLE TEXT BOX EITHER. That is what shipped: one field, a
 * `^\d{4}-\d{2}-\d{2}$` regex and the placeholder "1988-02-14". It asks a
 * parent to know an internal format, offers no help while they type, and fails
 * them only after the fact - at the most expensive moment in the funnel, on a
 * phone keyboard.
 *
 * Three segments, each `inputMode="numeric"`, advancing on their own. The value
 * that leaves this component is still the ISO string every caller and every
 * Zod schema already expects, so nothing downstream changes.
 *
 * The ORDER of the segments is fixed at day / month / year on purpose. All
 * three of our locales (es-MX, pt-BR, en-US as we write it) read a date that
 * way in ordinary prose, and a component whose field order moved with the
 * language would make a mistyped date impossible to spot in a screenshot.
 */

export interface DateFieldProps {
  label: string;
  hint?: string;
  error?: string;
  /** ISO `YYYY-MM-DD`, or '' when incomplete. */
  value: string;
  onChange: (isoDate: string) => void;
  required?: boolean;
  /** Accessible names for the three segments. */
  dayLabel: string;
  monthLabel: string;
  yearLabel: string;
  /*
   * A plausible year FOR THIS SURFACE. It is only a format hint, but "2016" on
   * an adult signup page reads as a suggestion about who the form is for, and
   * "1988" on a child form reads as a mistake.
   */
  yearPlaceholder?: string;
  className?: string;
}

function split(iso: string): { day: string; month: string; year: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return { day: '', month: '', year: '' };
  return { year: m[1]!, month: m[2]!, day: m[3]! };
}

/*
 * A REAL calendar date, not merely three numbers in range. Round-tripping
 * through Date is what rejects 31 February: the constructor rolls it forward to
 * 3 March, so the parts coming back out no longer match the parts that went in.
 */
function toIso(day: string, month: string, year: string): string {
  if (day.length === 0 || month.length === 0 || year.length !== 4) return '';
  const d = Number(day);
  const mo = Number(month);
  const y = Number(year);
  if (!Number.isInteger(d) || !Number.isInteger(mo) || !Number.isInteger(y)) return '';
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900) return '';
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) return '';
  return `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const SEGMENT =
  'lf-body min-h-12 rounded-md border bg-surface-sunken px-3 text-center text-content placeholder:text-content-faint ' +
  'transition-[border-color,box-shadow] duration-150 ' +
  'focus:border-primary/60 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30';

export function DateField({
  label,
  hint,
  error,
  value,
  onChange,
  required,
  dayLabel,
  monthLabel,
  yearLabel,
  yearPlaceholder = '1990',
  className,
}: DateFieldProps) {
  const groupId = useId();
  const hintId = `${groupId}-hint`;
  const errorId = `${groupId}-error`;
  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);

  /*
   * STATE, not a ref. The segments have to survive a render in which the
   * OUTGOING value has not changed - typing a day emits '' because the date is
   * still incomplete, so the parent re-sets the same '' and React bails out of
   * re-rendering. Held in a ref, the typed digits were then never painted: the
   * first version of this component did exactly that and showed an empty box
   * after every keystroke until the third segment completed.
   *
   * `value` remains the source of truth whenever it is a complete date, so a
   * caller resetting the form to '' or loading a saved date still wins.
   */
  const [parts, setParts] = useState(() => split(value));
  const fromValue = value ? split(value) : null;
  const current = fromValue && toIso(parts.day, parts.month, parts.year) !== value ? fromValue : parts;

  function update(next: { day?: string; month?: string; year?: string }) {
    const merged = { ...current, ...next };
    setParts(merged);
    onChange(toIso(merged.day, merged.month, merged.year));
  }

  function digits(e: ChangeEvent<HTMLInputElement>, max: number): string {
    return e.target.value.replace(/\D/g, '').slice(0, max);
  }

  /* Backspace at the start of a segment steps back into the previous one -
     otherwise a mistyped month traps the caret and the only way out is a tap. */
  function onKeyDown(e: KeyboardEvent<HTMLInputElement>, previous: HTMLInputElement | null) {
    if (e.key !== 'Backspace' || e.currentTarget.value.length > 0 || !previous) return;
    previous.focus();
    previous.setSelectionRange(previous.value.length, previous.value.length);
  }

  return (
    <fieldset className={cn('flex flex-col gap-1.5 border-0 p-0', className)}>
      <legend className="lf-label text-content">{label}</legend>
      <div className="flex items-center gap-2" role="group" aria-describedby={error ? errorId : hint ? hintId : undefined}>
        <input
          aria-label={dayLabel}
          aria-invalid={error ? true : undefined}
          inputMode="numeric"
          autoComplete="bday-day"
          placeholder="09"
          required={required}
          value={current.day}
          onChange={(e) => {
            const day = digits(e, 2);
            update({ day });
            if (day.length === 2) monthRef.current?.focus();
          }}
          className={cn(SEGMENT, 'w-16', error ? 'border-error/60' : 'border-outline/30 hover:border-outline/60')}
        />
        <span aria-hidden="true" className="lf-body text-content-faint">
          /
        </span>
        <input
          ref={monthRef}
          aria-label={monthLabel}
          aria-invalid={error ? true : undefined}
          inputMode="numeric"
          autoComplete="bday-month"
          placeholder="04"
          required={required}
          value={current.month}
          onChange={(e) => {
            const month = digits(e, 2);
            update({ month });
            if (month.length === 2) yearRef.current?.focus();
          }}
          onKeyDown={(e) => onKeyDown(e, e.currentTarget.parentElement?.querySelector('input') ?? null)}
          className={cn(SEGMENT, 'w-16', error ? 'border-error/60' : 'border-outline/30 hover:border-outline/60')}
        />
        <span aria-hidden="true" className="lf-body text-content-faint">
          /
        </span>
        <input
          ref={yearRef}
          aria-label={yearLabel}
          aria-invalid={error ? true : undefined}
          inputMode="numeric"
          autoComplete="bday-year"
          placeholder={yearPlaceholder}
          required={required}
          value={current.year}
          onChange={(e) => update({ year: digits(e, 4) })}
          onKeyDown={(e) => onKeyDown(e, monthRef.current)}
          className={cn(SEGMENT, 'w-24', error ? 'border-error/60' : 'border-outline/30 hover:border-outline/60')}
        />
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
    </fieldset>
  );
}
