import { useEffect, useMemo, useState } from 'react';
import { Button, Dialog, InlineNotice, RadioGroup, Stepper, TextField } from '../../design/controls';
import type { ConsoleTransport } from '../../family/console/consoleApi';
import {
  ASK_NOTE_MAX, ASK_REASONS, askMoreAllowance, withdrawAllowanceAsk, type Allowance, type AllowanceRequest, type AskReason,
} from './coinsApi';
import '../../design/tokens.css';
import '../../design/system.css';
import '../wallet.css';

/*
 * "Ask for a bigger allowance", the child's side: a kids' bank lets a child say
 * "I would like more", and the answer matters as much as the question. One
 * request waits at a time and can be taken back. The Tutor's answer is shown
 * as it was given: a yes says the new amount; a "not yet" says why in the
 * Tutor's own words and, when it is "later", the day to ask again (D.18).
 * Nothing here celebrates (OD-7): a yes is a line, not confetti.
 */

export interface AskCopy {
  open: string; title: string; amount: string; reason: string; note: string; reasons: Record<AskReason, string>; send: string; sending: string; cancel: string;
  less: string; more: string; waiting: string; withdraw: string; no: string; later: string; yes: string; again: string;
  hint: string; every: Record<Allowance['frequency'], string>; sent: string; withdrawn: string; failed: string; invalid: string; busy: string;
}

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
/** A yes is shown for a week, a "not yet" for two: long enough to be read and acted on, short enough not to nag. */
const SHOW_DAYS = { approved: 7, denied: 14 } as const;
const DAY = 86_400_000;

export function AllowanceAsk({ copy, locale, allowance, request, transport, onChanged }: {
  copy: AskCopy;
  locale: string;
  allowance: Allowance | null;
  request: AllowanceRequest | null;
  transport: ConsoleTransport;
  onChanged: () => void;
}) {
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(2);
  const [reason, setReason] = useState<AskReason | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const current = allowance?.active ? allowance.amount : 0;

  // Each opening starts one coin above what the child gets now, with nothing chosen yet.
  useEffect(() => { if (open) { setAmount(Math.min(current + 1, 1000)); setReason(null); setNote(''); setError(null); } }, [open, current]);

  if (!allowance || !allowance.active) return null;
  const every = copy.every[allowance.frequency];
  const waiting = request?.status === 'requested' ? request : null;
  const answered = request && request.decidedAt && (request.status === 'approved' || request.status === 'denied')
    && Date.now() - Date.parse(request.decidedAt) < SHOW_DAYS[request.status] * DAY ? request : null;
  const day = (iso: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));

  async function send() {
    if (busy) return;
    if (reason === null || amount <= current) { setError(copy.invalid); return; }
    setBusy(true); setError(null);
    const result = await askMoreAllowance(transport, { amount, reasonKind: reason, ...(note.trim() ? { note: note.trim() } : {}) });
    setBusy(false);
    if (!result.ok) { setError(result.code === 'ALLOWANCE_REQUEST_OPEN' ? copy.busy : result.code === 'ALLOWANCE_REQUEST_INVALID' ? copy.invalid : copy.failed); return; }
    setOpen(false); setNotice(copy.sent); onChanged();
  }

  async function withdraw() {
    if (busy) return;
    setBusy(true);
    const result = await withdrawAllowanceAsk(transport);
    setBusy(false);
    setNotice(result.ok ? copy.withdrawn : copy.failed);
    if (result.ok) onChanged();
  }

  return <div className="lf-wallet-ask" data-wallet-ask={waiting ? 'waiting' : answered?.status ?? 'idle'}>
    {waiting ? <>
      <span className="lf-wallet-ask-line" data-copy-role="data">{fill(copy.waiting, { amount: number.format(waiting.amount), every })}</span>
      <Button size="sm" disabled={busy} onClick={() => void withdraw()}>{copy.withdraw}</Button>
    </> : <>
      {answered?.status === 'approved' ? <span className="lf-wallet-ask-line" data-copy-role="data">{fill(copy.yes, { amount: number.format(answered.amount), every })}</span> : null}
      {answered?.status === 'denied' ? <span className="lf-wallet-ask-line" data-copy-role="data">
        {fill(copy.no, { reason: answered.decisionReason ?? '' })}{answered.revisitOn ? ` ${fill(copy.later, { date: day(answered.revisitOn) })}` : ''}</span> : null}
      <Button size="sm" onClick={() => setOpen(true)}>{answered?.status === 'denied' ? copy.again : copy.open}</Button>
    </>}
    {notice ? <InlineNotice tone="success" live>{notice}</InlineNotice> : null}

    <Dialog open={open} onClose={busy ? undefined : () => setOpen(false)} heading={copy.title} description={copy.hint}
      actions={<>
        <Button onClick={() => setOpen(false)} disabled={busy}>{copy.cancel}</Button>
        <Button variant="success" disabled={reason === null || amount <= current} pending={busy} pendingLabel={copy.sending} onClick={() => void send()}>{copy.send}</Button>
      </>}>
      <div className="lf-wallet-move">
        <section className="lf-wallet-move-group">
          <h3 data-copy-role="heading">{copy.amount}</h3>
          <Stepper label={copy.amount} labelHidden value={amount} min={current + 1} max={1000} onValueChange={setAmount} labels={{ decrease: copy.less, increase: copy.more }} disabled={busy} />
          <p className="lf-wallet-caption" data-copy-role="data">{number.format(amount)} {every}</p>
        </section>
        <RadioGroup legend={copy.reason} name="ask-reason" value={reason} disabled={busy}
          options={ASK_REASONS.map((value) => ({ value, label: copy.reasons[value] }))} onValueChange={setReason} />
        <TextField label={copy.note} autoComplete="off" maxLength={ASK_NOTE_MAX} value={note} disabled={busy} onChange={(event) => setNote(event.target.value)} />
        {error ? <InlineNotice tone="error" live>{error}</InlineNotice> : null}
      </div>
    </Dialog>
  </div>;
}
