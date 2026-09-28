import { useId, useState } from 'react';
import { Button, Copy, ErrorState, InlineNotice, LoadingState } from '../design/controls';
import { PocketSplit } from './PocketSplit';
import { sameSplit, type Bucket, type Split, type UsualSplit as Usual } from './moneyHabitsApi';
import { DEFAULT_REGISTER, type MoneyRegister } from './moneyRegister';
import '../design/tokens.css';
import '../design/system.css';
import './familyHub.css';
import './moneyHabits.css';

/*
 * S07.4 (D.13): the child's own usual split, the default every payout starts
 * from. It is shown "out of every 10 coins", never as a percentage (D.11: a
 * percentage is not a number a young child can use), and only the child sets
 * it. The platform's suggestion (5 / 4 / 1) is one tap away. Copy is checked
 * against the youngest band (6-9).
 *
 * S07.6 (D.12): the count line is the reader's register (moneyRegister.ts):
 * "5 of 10" (young), "5 of 10" with "so 50 of 100" under it (transition), "50%" (teen). The
 * steps stay tenths at every age, so the teen's percent is always a whole ten.
 * Each pocket is one shared Stepper row (S03.6): the count sits under the
 * pocket's name, − and + together at the end, and a bound disables its button
 * instead of clamping a press.
 */

export interface UsualSplitCopy {
  open: string; close: string; heading: string; body: string; tenths: string; suggested: string; submit: string; saving: string; saved: string;
  mustBe10: string; failed: string; loading: string; retry: string; save: string; spend: string; share: string; more: string; less: string;
  /** S07.6 (D.12): the transition register's "out of 100" line under each count. */
  scale?: string;
}

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
const toTenths = (s: Split): Split => ({ save: Math.round(s.save / 10), spend: Math.round(s.spend / 10), share: Math.round(s.share / 10) });

export function UsualSplit({ copy, locale, dark, open, loading, failed, value, busy, notice, onToggle, onRetry, onSave, register = DEFAULT_REGISTER }: {
  copy: UsualSplitCopy;
  /** S07.6 (D.12): the reader's register; only the count line changes with it. */
  register?: MoneyRegister;
  locale: string;
  dark: boolean;
  open: boolean;
  loading: boolean;
  failed: boolean;
  value: Usual | null;
  busy: boolean;
  notice: { text: string; error: boolean } | null;
  onToggle: () => void;
  onRetry: () => void;
  /** Percentages, multiples of 10, adding up to 100. */
  onSave: (split: Split) => void;
}) {
  const headingId = useId();
  const [draft, setDraft] = useState<Split | null>(null);
  const tenths = draft ?? (value ? toTenths(value.usual) : null);
  const placed = tenths ? tenths.save + tenths.spend + tenths.share : 0;
  const label: Record<Bucket, string> = { save: copy.save, spend: copy.spend, share: copy.share };

  function step(bucket: Bucket, next: number) {
    if (!tenths) return;
    const delta = next - tenths[bucket];
    if (next < 0 || next > 10 || (delta > 0 && placed >= 10)) return;
    setDraft({ ...tenths, [bucket]: next });
  }

  return <section className="lf-rebuild lf-family-hub lf-money-habits" data-money-habits="usual-split" data-register={register} data-theme={dark ? 'dark' : 'light'} lang={locale} aria-labelledby={headingId}>
    <Button aria-expanded={open} onClick={() => { setDraft(null); onToggle(); }}>{open ? copy.close : copy.open}</Button>
    {open && <>
      <h2 id={headingId} data-copy-role="heading">{copy.heading}</h2>
      {failed ? <ErrorState heading={copy.failed} retryLabel={copy.retry} retryingLabel={copy.loading} onRetry={onRetry} />
        : loading || !tenths || !value ? <LoadingState label={copy.loading} lines={2} /> : <>
        <Copy role="body">{copy.body}</Copy>
        {/* Bible 05 §7: the same pocket rows the lesson's allocation board uses. The + bound is what is still unplaced. */}
        <PocketSplit mode="stepper" stepperClassName="lf-money-habits-stepper" labels={label} values={tenths} disabled={busy}
          max={(bucket) => Math.min(10, tenths[bucket] + Math.max(0, 10 - placed))}
          valueText={(bucket, count) => fill(copy.tenths, { count, pct: count * 10 })}
          stepLabels={(bucket) => ({ decrease: fill(copy.less, { pocket: label[bucket] }), increase: fill(copy.more, { pocket: label[bucket] }) })}
          onChange={step}
          rowExtra={copy.scale ? (bucket) => <span className="lf-money-habits-scale" data-copy-role="data">{fill(copy.scale!, { count: tenths[bucket], pct: tenths[bucket] * 10 })}</span> : undefined} />
        {placed !== 10 && <InlineNotice tone="error" live>{copy.mustBe10}</InlineNotice>}
        {notice && <InlineNotice tone={notice.error ? 'error' : 'success'} live>{notice.text}</InlineNotice>}
        <div className="lf-family-hub-actions">
          <Button variant="success" pending={busy} pendingLabel={copy.saving}
            disabled={placed !== 10 || (draft === null && value.custom) || (draft !== null && sameSplit(draft, toTenths(value.usual)) && value.custom)}
            onClick={() => onSave({ save: tenths.save * 10, spend: tenths.spend * 10, share: tenths.share * 10 })}>{copy.submit}</Button>
          <Button disabled={busy || sameSplit(tenths, toTenths(value.recommended))} onClick={() => setDraft(toTenths(value.recommended))}>{copy.suggested}</Button>
        </div>
      </>}
    </>}
  </section>;
}
