import { useId, useState, type FormEvent } from 'react';
import { Button, InlineNotice, RadioGroup, TextAreaField, TextField } from '../design/controls';
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
 *
 * S03.6: the reason codes are the shared RadioGroup (pick one, nothing
 * chosen at first), the fields are TextAreaField and TextField, and a
 * missing or vague answer is a retry notice, never the error hue (SH-02).
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
  const ids = { name: useId(), problem: useId() };
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
    <RadioGroup legend={copy.why} name={ids.name} value={code} disabled={busy}
      options={codes.map((c) => ({ value: c, label: copy[c] }))} onValueChange={(c) => { setCode(c); setProblem(null); }} />
    <TextAreaField data-copy-role="data" label={copy.reason} help={copy.hint} maxLength={REASON_MAX_CHARS} value={reason} disabled={busy}
      aria-describedby={problem === 'vague' ? ids.problem : undefined} onChange={(event) => setReason(event.target.value)} />
    {code === 'later_date' && <TextField type="date" label={copy.revisit} value={date} disabled={busy}
      aria-describedby={problem === 'date' ? ids.problem : undefined} onChange={(event) => setDate(event.target.value)} />}
    {message && <div id={ids.problem}><InlineNotice tone="retry" live>{message}</InlineNotice></div>}
    <div className="lf-family-hub-actions">
      <Button type="submit" variant="accent" pending={busy} pendingLabel={copy.sending}>{copy.send}</Button>
      <Button disabled={busy} onClick={onCancel}>{copy.cancel}</Button>
    </div>
  </form>;
}
