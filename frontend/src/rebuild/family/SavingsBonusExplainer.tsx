import { useId, useRef, useState, type FormEvent } from 'react';
import { Button, Copy, StatusMark } from '../design/controls';
import { previewBonus, type OwnBonus } from './familyMoneyApi';
import '../design/tokens.css';
import '../design/system.css';
import './familyHub.css';
import './familyMoney.css';

/*
 * S07.3 (D.11): the child's own savings bonus, in the framing they can
 * understand (Appendix G §1.5, §2.4):
 *   - under 13 (per_ten): "Keep 10 coins in Save, get 1 more each week",
 *     with the child's own coins drawn as groups of ten, each group earning
 *     one coin. No percentage appears.
 *   - 13-17 (percent): the family's weekly percent, what it means for the
 *     teen's own Save pocket, why it grows (bonus coins count next week), the
 *     honest "not a bank interest rate", and a worked example the teen
 *     completes. The answer is checked by the database at the teen's current
 *     rate; completion feeds Appendix H's Age-Tier Bonus Comprehension Proxy.
 * The numbers shown use the same arithmetic as the weekly credit. Bonus
 * coins are never folded into anything the child earned (D.16). No
 * celebration: a right answer is an informational confirmation (OD-7).
 */

export interface BonusYoungCopy { heading: string; rule: string; mine: string; next: string; groups: string; off: string; loading: string; failed: string; retry: string }
export interface BonusTeenCopy {
  heading: string; rule: string; mine: string; compounding: string; notInterest: string; open: string; heading2: string; question: string; hint: string;
  answer: string; check: string; correct: string; wrong: string; done: string; off: string; loading: string; failed: string; retry: string;
}

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
const MAX_GROUPS_DRAWN = 10;

function YoungBonus({ copy, bonus, scaffold }: { copy: BonusYoungCopy; bonus: OwnBonus; scaffold: string | null }) {
  const groups = Math.floor(bonus.saved / 10);
  const rest = bonus.saved % 10;
  return <>
    <Copy role="body">{copy.rule}</Copy>
    <Copy role="body">{fill(copy.mine, { saved: bonus.saved })}</Copy>
    {bonus.saved > 0 && <ul className="lf-family-money-groups" aria-label={copy.groups}>
      {Array.from({ length: Math.min(groups, MAX_GROUPS_DRAWN) }, (_, i) => <li key={i} data-group="ten" data-copy-role="data">10<small>+1</small></li>)}
      {groups > MAX_GROUPS_DRAWN && <li data-group="more" data-copy-role="data">+{(groups - MAX_GROUPS_DRAWN) * 10}<small>+{groups - MAX_GROUPS_DRAWN}</small></li>}
      {rest > 0 && <li data-group="rest" data-copy-role="data">{rest}</li>}
    </ul>}
    <Copy role="body">{fill(copy.next, { bonus: bonus.nextBonus })}</Copy>
    {scaffold && <Copy role="body">{scaffold}</Copy>}
  </>;
}

function TeenBonus({ copy, bonus, onExampleShown, onAnswer }: {
  copy: BonusTeenCopy; bonus: OwnBonus; onExampleShown: () => void; onAnswer: (input: { exampleSaved: number; answer: number }) => Promise<boolean | null>;
}) {
  const answerId = useId();
  const rate = (bonus.rule?.rateBp ?? 0) / 100;
  const exampleSaved = bonus.saved === 200 ? 300 : 200;
  const expected = previewBonus('percent', exampleSaved, bonus.rule?.rateBp ?? 0);
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<'right' | 'wrong' | 'failed' | null>(null);
  const completed = bonus.example?.completed === true || result === 'right';
  const shownOnce = useRef(false);

  function openExample() {
    setOpen(true);
    if (!shownOnce.current) { shownOnce.current = true; onExampleShown(); }
  }

  async function check(event: FormEvent) {
    event.preventDefault();
    if (busy || !/^\d{1,5}$/.test(answer.trim())) return setResult('wrong');
    setBusy(true);
    const verdict = await onAnswer({ exampleSaved, answer: Number(answer.trim()) });
    setBusy(false);
    setResult(verdict === null ? 'failed' : verdict ? 'right' : 'wrong');
  }

  return <>
    <Copy role="body">{fill(copy.rule, { rate })}</Copy>
    <span data-copy-role="data">{fill(copy.mine, { saved: bonus.saved, bonus: bonus.nextBonus })}</span>
    <Copy role="body">{copy.compounding}</Copy>
    <Copy role="body">{copy.notInterest}</Copy>
    {completed && !open && <div className="lf-family-hub-notice" role="status"><StatusMark correct /><Copy role="body">{copy.done}</Copy></div>}
    {!open ? <Button onClick={openExample}>{copy.open}</Button> : <form onSubmit={(event) => void check(event)} noValidate aria-label={copy.heading2}>
      <h3 data-copy-role="heading">{copy.heading2}</h3>
      <Copy role="prompt">{fill(copy.question, { saved: exampleSaved, rate })}</Copy>
      <Copy role="body">{fill(copy.hint, { rate })}</Copy>
      <div className="lf-family-money-row">
        <div className="lf-field">
          <label htmlFor={answerId} data-copy-role="body">{copy.answer}</label>
          <input id={answerId} type="number" inputMode="numeric" min={0} step={1} value={answer} disabled={busy}
            aria-invalid={result === 'wrong' || undefined} onChange={(event) => { setAnswer(event.target.value); setResult(null); }} />
        </div>
        <Button type="submit" variant="accent" disabled={busy}>{copy.check}</Button>
      </div>
      {result === 'right' && <div className="lf-family-hub-notice" role="status"><StatusMark correct />
        <span data-copy-role="data">{fill(copy.correct, { saved: exampleSaved, rate, bonus: expected })}</span></div>}
      {result === 'wrong' && <div className="lf-family-hub-notice" role="alert"><StatusMark correct={false} /><Copy role="body">{copy.wrong}</Copy></div>}
      {result === 'failed' && <div className="lf-family-hub-notice" role="alert"><StatusMark correct={false} /><Copy role="body">{copy.failed}</Copy></div>}
    </form>}
  </>;
}

export function SavingsBonusExplainer({ young, teen, locale, dark, bonus, loading, failed, onRetry, onExampleShown, onAnswer, scaffold = null }: {
  young: BonusYoungCopy;
  teen: BonusTeenCopy;
  locale: string;
  dark: boolean;
  bonus: OwnBonus | null;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  onExampleShown: () => void;
  onAnswer: (input: { exampleSaved: number; answer: number }) => Promise<boolean | null>;
  /**
   * S07.6 (D.12): the transition register's bridge from "1 for every 10" toward a
   * rate ("that is like 10 out of every 100"); Appendix G §1.5 places a
   * percentage of a balance within reach at 10-12 with concrete scaffolding.
   */
  scaffold?: string | null;
}) {
  const copy = bonus?.framing === 'percent' ? teen : young;
  const active = bonus?.rule?.active === true && (bonus.framing === 'per_ten' || (bonus.rule?.rateBp ?? 0) > 0);

  return <section className="lf-rebuild lf-family-hub lf-family-money-hub" data-family-money="bonus-explainer" data-theme={dark ? 'dark' : 'light'} lang={locale}
    aria-label={copy.heading} data-framing={bonus?.framing ?? 'unknown'}>
    <Copy role="heading" as="h2">{copy.heading}</Copy>
    {failed ? <>
      <div className="lf-family-hub-notice" role="alert"><StatusMark correct={false} /><Copy role="body">{copy.failed}</Copy></div>
      <Button onClick={onRetry}>{copy.retry}</Button>
    </> : loading || !bonus ? <div role="status"><Copy role="body">{copy.loading}</Copy></div>
      : !active ? <Copy role="body">{copy.off}</Copy>
        : bonus.framing === 'per_ten' ? <YoungBonus copy={young} bonus={bonus} scaffold={scaffold} />
          : <TeenBonus copy={teen} bonus={bonus} onExampleShown={onExampleShown} onAnswer={onAnswer} />}
  </section>;
}
