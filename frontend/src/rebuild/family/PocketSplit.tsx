import type { ReactNode } from 'react';
import { IconButton, Stepper, TextField } from '../design/controls';
import { BUCKETS, type Bucket, type Split } from './moneyHabitsApi';
import './moneyHabits.css';

/*
 * The Save / Spend / Share pocket rows, shared by the Wallet (the payout split
 * chooser and the usual split) and the lesson allocation board (Frontend
 * Bible 05 §7 Money row: "the save/spend/share split reuses the Wallet's own
 * component"; GAP-FIX-R1). One presentational component so the lesson and the
 * real Wallet teach one interaction: each pocket's hue swatch, its name, and a
 * count changed with the shared Stepper (−/+ together, a bound disables its
 * button) or typed with −/+ beside it for large payouts; optionally the
 * remaining-coins line. The caller keeps its own rules (grading and
 * checkpoints for a lesson, payout totals for the Wallet) and only hands the
 * rows their values and bounds.
 */

export type PocketSplitMode = 'stepper' | 'typed' | 'readonly';

export function PocketSplit({ mode, labels, values, max, typedMax, step = 1, disabled = false, valueText, stepLabels, onChange, remaining, rowExtra, className, stepperClassName }: {
  mode: PocketSplitMode;
  labels: Record<Bucket, string>;
  values: Split;
  /** The highest count each pocket may reach now (what it holds plus what is still unplaced). */
  max: (bucket: Bucket) => number;
  /** The largest count a typed field accepts (a payout total); defaults to `max`. */
  typedMax?: number;
  step?: number;
  disabled?: boolean;
  /** The written value of a count (coins, tenths); defaults to the number. */
  valueText?: (bucket: Bucket, value: number) => string;
  stepLabels: (bucket: Bucket) => { decrease: string; increase: string };
  onChange: (bucket: Bucket, next: number) => void;
  /** The live remaining line ("3 coins left"), announced politely. */
  remaining?: string | null;
  /** A line under a row's count (the transition register's "out of 100"). */
  rowExtra?: (bucket: Bucket) => ReactNode;
  className?: string;
  stepperClassName?: string;
}) {
  return <div className={`lf-pocket-split${className ? ` ${className}` : ''}`} data-pocket-split={mode}>
    <ul className="lf-money-habits-pockets">
      {BUCKETS.map((bucket) => <li key={bucket} data-pocket={bucket}>
        <span className="lf-money-habits-swatch" aria-hidden="true" />
        {mode === 'stepper' ? <Stepper className={stepperClassName} valuePlacement="label" label={labels[bucket]} value={values[bucket]}
          valueText={valueText?.(bucket, values[bucket])} min={0} max={Math.max(values[bucket], max(bucket))} step={step} disabled={disabled}
          onValueChange={(next) => onChange(bucket, next)} labels={stepLabels(bucket)} />
          : mode === 'typed' ? <>
            <div className="lf-money-habits-pocket-count">
              <TextField label={labels[bucket]} type="number" inputMode="numeric" min={0} max={typedMax ?? max(bucket)} step={step}
                value={values[bucket]} disabled={disabled} onChange={(event) => {
                  const raw = event.target.value.trim();
                  onChange(bucket, /^\d{1,4}$/.test(raw) ? Math.min(Number(raw), typedMax ?? max(bucket)) : 0);
                }} />
            </div>
            <IconButton glyph="minus" label={stepLabels(bucket).decrease} disabled={disabled || values[bucket] === 0} onClick={() => onChange(bucket, values[bucket] - step)} />
            <IconButton glyph="plus" label={stepLabels(bucket).increase} disabled={disabled || values[bucket] + step > max(bucket)} onClick={() => onChange(bucket, values[bucket] + step)} />
          </> : <>
            <span data-copy-role="option" className="lf-money-habits-pocket-name">{labels[bucket]}</span>
            <span className="lf-money-habits-count" data-copy-role="data">{valueText ? valueText(bucket, values[bucket]) : values[bucket]}</span>
          </>}
        {rowExtra?.(bucket)}
      </li>)}
    </ul>
    {remaining ? <p className="lf-pocket-split-left" data-copy-role="data" aria-live="polite">{remaining}</p> : null}
  </div>;
}
