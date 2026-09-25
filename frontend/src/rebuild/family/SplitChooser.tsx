import { useId, useState, type FormEvent } from 'react';
import { Button, Copy, StatusMark } from '../design/controls';
import { BUCKETS, sameSplit, splitCoins, type Bucket, type HabitGoal, type Split } from './moneyHabitsApi';
import '../design/tokens.css';
import '../design/system.css';
import './familyHub.css';
import './moneyHabits.css';

/*
 * S07.4 (D.13): a payout arrives already split by the child's own usual split
 * (Appendix G §2.1: mental accounting works because the categories are
 * self-imposed, so the default is the child's, not a rule). Keeping it is one
 * tap. "Change it" opens a per-pocket stepper; any split that places every
 * coin is accepted, including everything in one pocket. The Save part may go
 * to a goal. The server records the default and the choice; this surface
 * only offers them. Confirming a split gets a confirmation, never confetti
 * (OD-7). Copy is checked against the youngest band (6-9).
 */

export interface SplitChooserCopy {
  heading: string; usual: string; use: string; change: string; save: string; spend: string; share: string; more: string; less: string;
  left: string; placed: string; toGoal: string; noGoal: string; submit: string; saving: string; cancel: string; mismatch: string;
}

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

export function SplitChooser({ copy, locale, dark, amount, usual, goals, busy, notice, onSubmit, onCancel }: {
  copy: SplitChooserCopy;
  locale: string;
  dark: boolean;
  amount: number;
  /** The holder's usual split, in percent (the server's). */
  usual: Split;
  goals: HabitGoal[];
  busy: boolean;
  notice: { text: string; error: boolean } | null;
  onSubmit: (split: Split, goalId: string | null) => void;
  onCancel?: () => void;
}) {
  const ids = { heading: useId(), goal: useId() };
  const suggested = splitCoins(amount, usual);
  const [split, setSplit] = useState<Split>(suggested);
  const [editing, setEditing] = useState(false);
  const [goalId, setGoalId] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const placed = split.save + split.spend + split.share;
  const left = amount - placed;
  const label: Record<Bucket, string> = { save: copy.save, spend: copy.spend, share: copy.share };
  const active = goals.filter((g) => g.status === 'active');

  function step(bucket: Bucket, delta: 1 | -1) {
    setMismatch(false);
    setSplit((current) => {
      const next = current[bucket] + delta;
      if (next < 0 || (delta > 0 && current.save + current.spend + current.share >= amount)) return current;
      return { ...current, [bucket]: next };
    });
  }

  /** A typed count: whole coins, never more than the payout. */
  function set(bucket: Bucket, raw: string) {
    setMismatch(false);
    const n = /^\d{1,4}$/.test(raw.trim()) ? Number(raw.trim()) : 0;
    setSplit((current) => ({ ...current, [bucket]: Math.min(n, amount) }));
  }

  function submit(event: FormEvent, chosen: Split) {
    event.preventDefault();
    if (chosen.save + chosen.spend + chosen.share !== amount) { setMismatch(true); return; }
    onSubmit(chosen, chosen.save > 0 && goalId ? goalId : null);
  }

  return <section className="lf-rebuild lf-family-hub lf-money-habits" data-money-habits="split-chooser" data-theme={dark ? 'dark' : 'light'} lang={locale} aria-labelledby={ids.heading}
    data-split-state={editing ? 'editing' : 'usual'} data-kept-default={sameSplit(split, suggested) ? 'true' : 'false'}>
    <h2 id={ids.heading} data-copy-role="heading">{fill(copy.heading, { count: amount })}</h2>
    {!editing && <Copy role="body">{copy.usual}</Copy>}
    <form onSubmit={(event) => submit(event, editing ? split : suggested)} noValidate>
      <ul className="lf-money-habits-pockets">
        {BUCKETS.map((bucket) => <li key={bucket} data-pocket={bucket}>
          <span className="lf-money-habits-swatch" aria-hidden="true" />
          {editing ? <>
            <label htmlFor={`${ids.heading}-${bucket}`} data-copy-role="option" className="lf-money-habits-pocket-name">{label[bucket]}</label>
            <Button aria-label={fill(copy.less, { pocket: label[bucket] })} disabled={busy || split[bucket] === 0} onClick={() => step(bucket, -1)}>−</Button>
            <input id={`${ids.heading}-${bucket}`} className="lf-money-habits-input" type="number" inputMode="numeric" min={0} max={amount} step={1}
              value={split[bucket]} disabled={busy} onChange={(event) => set(bucket, event.target.value)} />
            <Button aria-label={fill(copy.more, { pocket: label[bucket] })} disabled={busy || left <= 0} onClick={() => step(bucket, 1)}>+</Button>
          </> : <>
            <span data-copy-role="option" className="lf-money-habits-pocket-name">{label[bucket]}</span>
            <span className="lf-money-habits-count" data-copy-role="data">{suggested[bucket]}</span>
          </>}
        </li>)}
      </ul>
      {editing && <p data-copy-role="data" aria-live="polite">{left === 0 ? copy.placed : fill(copy.left, { count: left })}</p>}
      {active.length > 0 && (editing ? split : suggested).save > 0 && <div className="lf-field">
        <label htmlFor={ids.goal} data-copy-role="body">{copy.toGoal}</label>
        <select id={ids.goal} value={goalId} disabled={busy} onChange={(event) => setGoalId(event.target.value)}>
          <option value="" data-copy-role="option">{copy.noGoal}</option>
          {active.map((g) => <option key={g.id} value={g.id} data-copy-role="data">{g.title}</option>)}
        </select>
      </div>}
      {mismatch && <div className="lf-family-hub-notice" role="alert"><StatusMark correct={false} /><Copy role="body">{fill(copy.mismatch, { count: amount })}</Copy></div>}
      {notice && <div className="lf-family-hub-notice" role={notice.error ? 'alert' : 'status'}><StatusMark correct={!notice.error} /><Copy role="body">{notice.text}</Copy></div>}
      <div className="lf-family-hub-actions">
        <Button type="submit" variant="success" disabled={busy}>{busy ? copy.saving : editing ? copy.submit : copy.use}</Button>
        {!editing && <Button disabled={busy} onClick={() => { setEditing(true); setSplit(suggested); }}>{copy.change}</Button>}
        {onCancel && <Button disabled={busy} onClick={onCancel}>{copy.cancel}</Button>}
      </div>
    </form>
  </section>;
}
