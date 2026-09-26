import { useId, useState } from 'react';
import { Button, Copy, StatusMark } from '../design/controls';
import { BRIDGE_MOMENTS, splitAmount, type BridgeMoment, type BridgeState } from '../family/governanceApi';
import '../design/tokens.css';
import '../design/system.css';
import '../family/familyHub.css';
import '../family/familyGovernance.css';

/*
 * S07.7 (D.19), the first milestone of the older-teen graduation initiative:
 * "Beyond the app". From 15 (the database decides, by age evidence), a
 * wallet holder sees three real-world moments. When the teen says a moment
 * has arrived, its short checklist opens: education close to the real
 * decision it prepares for (Appendix G §3.1). Only the teen's own ticks are
 * saved. The split tool applies their usual split to a real amount in this
 * browser and sends nothing; no amount, bank or account detail is ever
 * stored, coins never convert, and nothing links to a real account. Teen
 * register; nothing celebrates.
 */

export interface BridgeCopy extends Record<BridgeMoment, string>, Record<`${BridgeMoment}${1 | 2 | 3}`, string> {
  heading: string; intro: string; arrived: string; undo: string; splitHeading: string; amount: string; splitResult: string; splitNote: string; failed: string;
}

const STEPS = [1, 2, 3] as const;
const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

export function MoneyBridge({ copy, locale, dark, state, split, busy, notice, onMark }: {
  copy: BridgeCopy;
  locale: string;
  dark: boolean;
  state: BridgeState | null;
  /** The teen's usual split in percent, for the in-browser tool; null hides the tool. */
  split: { save: number; spend: number; share: number } | null;
  busy: boolean;
  notice: { text: string; error: boolean } | null;
  onMark: (input: { milestone: BridgeMoment; step: 0 | 1 | 2 | 3; done: boolean }) => void;
}) {
  const ids = { heading: useId(), amount: useId(), note: useId() };
  const [amount, setAmount] = useState('');
  if (!state || !state.eligible) return null;
  const number = Number(amount.replace(',', '.'));
  const parts = split && amount.trim() !== '' ? splitAmount(number, split) : null;
  const format = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  return <section className="lf-rebuild lf-family-hub lf-governance" data-governance="bridge" data-theme={dark ? 'dark' : 'light'} lang={locale} aria-labelledby={ids.heading}>
    <h2 id={ids.heading} className="lf-governance-tip-title" data-copy-role="heading">{copy.heading}</h2>
    <Copy role="body">{copy.intro}</Copy>
    {notice && <div className="lf-family-hub-notice" role={notice.error ? 'alert' : 'status'}><StatusMark correct={!notice.error} /><Copy role="body">{notice.text}</Copy></div>}
    {BRIDGE_MOMENTS.map((milestone) => {
      const moment = state.moments.find((m) => m.milestone === milestone)!;
      return <div key={milestone} className="lf-governance-moment" data-moment={milestone} data-arrived={String(moment.arrived)}>
        <div className="lf-governance-head">
          <h3 data-copy-role="heading">{copy[milestone]}</h3>
          <Button variant={moment.arrived ? 'secondary' : 'accent'} disabled={busy} aria-pressed={moment.arrived}
            onClick={() => onMark({ milestone, step: 0, done: !moment.arrived })}>{moment.arrived ? copy.undo : copy.arrived}</Button>
        </div>
        {moment.arrived && <>
          {STEPS.map((step) => {
            const done = moment.steps.includes(step);
            return <label key={step} className="lf-governance-step" data-step={step}>
              <input type="checkbox" checked={done} disabled={busy} onChange={() => onMark({ milestone, step, done: !done })} />
              <span data-copy-role="body">{copy[`${milestone}${step}`]}</span>
            </label>;
          })}
          {milestone === 'first_pay' && split && <div className="lf-governance-split" data-bridge="split">
            <h3 data-copy-role="heading">{copy.splitHeading}</h3>
            <div className="lf-field">
              <label htmlFor={ids.amount} data-copy-role="body">{copy.amount}</label>
              <input id={ids.amount} type="text" inputMode="decimal" autoComplete="off" value={amount} aria-describedby={ids.note}
                onChange={(event) => setAmount(event.target.value)} />
            </div>
            {parts && <output htmlFor={ids.amount} data-copy-role="data">
              {fill(copy.splitResult, { save: format.format(parts.save), spend: format.format(parts.spend), share: format.format(parts.share) })}</output>}
            <p id={ids.note} className="lf-family-hub-muted" data-copy-role="body">{copy.splitNote}</p>
          </div>}
        </>}
      </div>;
    })}
  </section>;
}
