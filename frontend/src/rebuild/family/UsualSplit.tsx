import { useId, useState } from 'react';
import { Button, Copy, StatusMark } from '../design/controls';
import { BUCKETS, sameSplit, type Bucket, type Split, type UsualSplit as Usual } from './moneyHabitsApi';
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
 */

export interface UsualSplitCopy {
  open: string; close: string; heading: string; body: string; tenths: string; suggested: string; submit: string; saving: string; saved: string;
  mustBe10: string; failed: string; loading: string; retry: string; save: string; spend: string; share: string; more: string; less: string;
}

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
const toTenths = (s: Split): Split => ({ save: Math.round(s.save / 10), spend: Math.round(s.spend / 10), share: Math.round(s.share / 10) });

export function UsualSplit({ copy, locale, dark, open, loading, failed, value, busy, notice, onToggle, onRetry, onSave }: {
  copy: UsualSplitCopy;
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

  function step(bucket: Bucket, delta: 1 | -1) {
    if (!tenths) return;
    const next = tenths[bucket] + delta;
    if (next < 0 || next > 10 || (delta > 0 && placed >= 10)) return;
    setDraft({ ...tenths, [bucket]: next });
  }

  return <section className="lf-rebuild lf-family-hub lf-money-habits" data-money-habits="usual-split" data-theme={dark ? 'dark' : 'light'} lang={locale} aria-labelledby={headingId}>
    <Button aria-expanded={open} onClick={() => { setDraft(null); onToggle(); }}>{open ? copy.close : copy.open}</Button>
    {open && <>
      <h2 id={headingId} data-copy-role="heading">{copy.heading}</h2>
      {failed ? <>
        <div className="lf-family-hub-notice" role="alert"><StatusMark correct={false} /><Copy role="body">{copy.failed}</Copy></div>
        <Button onClick={onRetry}>{copy.retry}</Button>
      </> : loading || !tenths || !value ? <div role="status"><Copy role="body">{copy.loading}</Copy></div> : <>
        <Copy role="body">{copy.body}</Copy>
        <ul className="lf-money-habits-pockets">
          {BUCKETS.map((bucket) => <li key={bucket} data-pocket={bucket}>
            <span className="lf-money-habits-swatch" aria-hidden="true" />
            <span data-copy-role="option" className="lf-money-habits-pocket-name">{label[bucket]}</span>
            <Button aria-label={fill(copy.less, { pocket: label[bucket] })} disabled={busy || tenths[bucket] === 0} onClick={() => step(bucket, -1)}>−</Button>
            <span className="lf-money-habits-count" data-copy-role="data" aria-live="polite">{fill(copy.tenths, { count: tenths[bucket] })}</span>
            <Button aria-label={fill(copy.more, { pocket: label[bucket] })} disabled={busy || placed >= 10} onClick={() => step(bucket, 1)}>+</Button>
          </li>)}
        </ul>
        {placed !== 10 && <div className="lf-family-hub-notice" role="alert"><StatusMark correct={false} /><Copy role="body">{copy.mustBe10}</Copy></div>}
        {notice && <div className="lf-family-hub-notice" role={notice.error ? 'alert' : 'status'}><StatusMark correct={!notice.error} /><Copy role="body">{notice.text}</Copy></div>}
        <div className="lf-family-hub-actions">
          <Button variant="success" disabled={busy || placed !== 10 || (draft === null && value.custom) || (draft !== null && sameSplit(draft, toTenths(value.usual)) && value.custom)}
            onClick={() => onSave({ save: tenths.save * 10, spend: tenths.spend * 10, share: tenths.share * 10 })}>{busy ? copy.saving : copy.submit}</Button>
          <Button disabled={busy || sameSplit(tenths, toTenths(value.recommended))} onClick={() => setDraft(toTenths(value.recommended))}>{copy.suggested}</Button>
        </div>
      </>}
    </>}
  </section>;
}
