import { useId, useState, type FormEvent } from 'react';
import { Button, Copy, StatusMark } from '../design/controls';
import { REASON_MAX_CHARS, reasonActionable, revisitInRange, type NotYet, type ReasonCode } from './familyAutonomyApi';
import '../design/tokens.css';
import '../design/system.css';
import './familyHub.css';
import './familyAutonomy.css';

/*
 * S07.5 (D.18), the Tutor's side of every "not yet": a reason from the
 * subject's own vocabulary, what the child can do next (checked for
 * actionability before anything is sent, and again by the server), and a
 * date when the answer is "later". Nothing is preselected. Adult band copy.
 */

export interface NotYetCopy {
  why: string; reason: string; hint: string; tooVague: string; pickCode: string; revisit: string; revisitInvalid: string;
  send: string; sending: string; cancel: string;
  not_finished: string; redo: string; save_more: string; later_date: string; not_suitable: string; talk_first: string; practice_more: string;
}

export function NotYetForm({ copy, codes, busy, heading, initialReason, onSubmit, onCancel }: {
  copy: NotYetCopy;
  codes: readonly ReasonCode[];
  busy: boolean;
  /** A short line naming what is being answered (the chore or reward title). */
  heading?: string;
  /** S07.7 (D.23): the Tutor's own reflection, when they chose to use it as the reason. */
  initialReason?: string;
  onSubmit: (notYet: NotYet) => void;
  onCancel: () => void;
}) {
  const ids = { legend: useId(), reason: useId(), hint: useId(), date: useId() };
  const [code, setCode] = useState<ReasonCode | null>(null);
  const [reason, setReason] = useState(initialReason ?? '');
  const [date, setDate] = useState('');
  const [problem, setProblem] = useState<'code' | 'vague' | 'date' | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!code) { setProblem('code'); return; }
    if (!reasonActionable(reason)) { setProblem('vague'); return; }
    if (code === 'later_date' && !revisitInRange(date)) { setProblem('date'); return; }
    setProblem(null);
    onSubmit({ reasonCode: code, reason: reason.trim(), revisitOn: code === 'later_date' ? date : null });
  }

  const message = problem === 'code' ? copy.pickCode : problem === 'vague' ? copy.tooVague : problem === 'date' ? copy.revisitInvalid : null;
  return <form className="lf-autonomy-not-yet" onSubmit={submit} noValidate data-not-yet="form">
    {heading ? <span className="ugc lf-family-hub-muted" data-copy-role="data">{heading}</span> : null}
    <fieldset>
      <legend id={ids.legend} data-copy-role="prompt">{copy.why}</legend>
      <div className="lf-family-hub-options" role="group" aria-labelledby={ids.legend}>
        {codes.map((c) => <Button key={c} aria-pressed={code === c} disabled={busy} data-reason-code={c} onClick={() => { setCode(c); setProblem(null); }}>
          {code === c && <StatusMark correct />}{copy[c]}</Button>)}
      </div>
    </fieldset>
    <div className="lf-field">
      <label htmlFor={ids.reason} data-copy-role="prompt">{copy.reason}</label>
      <textarea data-copy-role="data" id={ids.reason} maxLength={REASON_MAX_CHARS} value={reason} disabled={busy} aria-describedby={ids.hint}
        aria-invalid={problem === 'vague' ? true : undefined} onChange={(event) => setReason(event.target.value)} />
      <p id={ids.hint} className="lf-family-hub-muted" data-copy-role="body">{copy.hint}</p>
    </div>
    {code === 'later_date' && <div className="lf-field">
      <label htmlFor={ids.date} data-copy-role="body">{copy.revisit}</label>
      <input id={ids.date} type="date" value={date} disabled={busy} aria-invalid={problem === 'date' ? true : undefined}
        onChange={(event) => setDate(event.target.value)} />
    </div>}
    {message && <div className="lf-family-hub-notice" role="alert"><StatusMark correct={false} /><Copy role="body">{message}</Copy></div>}
    <div className="lf-family-hub-actions">
      <Button type="submit" variant="accent" disabled={busy}>{busy ? copy.sending : copy.send}</Button>
      <Button disabled={busy} onClick={onCancel}>{copy.cancel}</Button>
    </div>
  </form>;
}
