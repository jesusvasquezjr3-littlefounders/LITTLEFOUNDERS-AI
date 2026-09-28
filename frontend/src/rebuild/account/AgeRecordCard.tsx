import { useState, type FormEvent } from 'react';
import { Button, ButtonGroup, Card, Copy, InlineNotice, TextField } from '../design/controls';

/*
 * P3, the age a self-managed account declared (S-04, OD-28; Product 10 E.4).
 *
 * The age screen is asked once and the account it governs can never edit the
 * answer (E.4). The card says what was kept: for a 13-17-year-old, when the
 * account moves to the adult tier (with a birth month, after the month they
 * turn 18; without one, it stays 13 to 17); a teen who has moved says so; an
 * adult sees their group. Shown to nobody else: a child and a guest have
 * nothing to read here.
 *
 * E.4 as amended by OD-3: with no guardian to re-confirm, a correction is a
 * request our staff review. When Core says the account may ask (`correction`),
 * the card offers "Request a correction" (a date, sent once) and then shows
 * the request's status; nothing about the age changes until staff decide.
 * Copy-only, no transport: the route owns the data plane.
 */

export interface AgeRecordCopy {
  title: string; teenMonth: string; teenBand: string; adultByMonth: string; adult: string; locked: string;
  request: string; requestHelp: string; birthDate: string; send: string; sending: string; cancel: string;
  pending: string; approved: string; rejected: string; failed: string; invalid: string; unchanged: string;
}

export type AgeRecordKind = 'teenMonth' | 'teenBand' | 'adultByMonth' | 'adult';

/** GET /auth/age-screen, reduced to what this card says; null = no card. */
export function ageRecordKind(state: unknown): AgeRecordKind | null {
  const value = state as { required?: unknown; ageBand?: unknown; protectedOrigin?: unknown; birthMonthRecorded?: unknown; adultByBirthMonth?: unknown } | null;
  if (!value || value.required !== false || value.protectedOrigin !== false) return null;
  if (value.ageBand === 'adult') return value.adultByBirthMonth === true ? 'adultByMonth' : 'adult';
  if (value.ageBand !== '13_to_17') return null;
  return value.birthMonthRecorded === true ? 'teenMonth' : 'teenBand';
}

export type CorrectionStatus = 'pending' | 'approved' | 'rejected';

/** GET /account/age-correction (E.4): whether the account may ask, and its latest request's status. */
export interface CorrectionState { eligible: boolean; status: CorrectionStatus | null }

/** The failure codes the card explains; anything else reads as "did not send". */
export type CorrectionFailure = 'invalid' | 'unchanged' | 'failed';

export function correctionState(value: unknown): CorrectionState | null {
  const data = value as { eligible?: unknown; request?: { status?: unknown } | null } | null;
  if (!data || typeof data.eligible !== 'boolean') return null;
  const status = data.request?.status;
  return { eligible: data.eligible, status: status === 'pending' || status === 'approved' || status === 'rejected' ? status : null };
}

const BIRTH_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function AgeRecordCard({ copy, kind, correction = null, onRequest }: {
  copy: AgeRecordCopy; kind: AgeRecordKind;
  correction?: CorrectionState | null;
  /** Sends the correction; resolves null when filed, or the failure to explain. */
  onRequest?: (birthDate: string) => Promise<CorrectionFailure | null>;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<CorrectionFailure | null>(null);
  const status = correction?.status ?? null;
  const canAsk = correction?.eligible === true && status !== 'pending' && onRequest !== undefined;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!onRequest || sending) return;
    if (!BIRTH_DATE.test(date)) { setFailure('invalid'); return; }
    setSending(true); setFailure(null);
    const result = await onRequest(date);
    setSending(false);
    if (result) { setFailure(result); return; }
    setOpen(false); setDate('');
  }

  return <Card heading={copy.title}>
    <div className="lf-settings-form" data-setting="age-record" data-age-record={kind} data-correction={status ?? 'none'}>
      <Copy role="body">{copy[kind]}</Copy>
      <Copy role="body">{copy.locked}</Copy>
      {status ? <InlineNotice tone={status === 'approved' ? 'success' : status === 'rejected' ? 'error' : 'info'}>{copy[status]}</InlineNotice> : null}
      {canAsk && !open
        ? <ButtonGroup><Button aria-expanded={false} onClick={() => { setOpen(true); setFailure(null); }}>{copy.request}</Button></ButtonGroup>
        : null}
      {canAsk && open
        ? <form className="lf-settings-form" noValidate onSubmit={(event) => void submit(event)} data-correction-form="">
          <Copy role="body">{copy.requestHelp}</Copy>
          <TextField type="date" label={copy.birthDate} value={date} max={new Date().toISOString().slice(0, 10)} required
            onChange={(event) => setDate(event.target.value)} error={failure === 'invalid' ? copy.invalid : undefined} />
          {failure && failure !== 'invalid' ? <InlineNotice tone="error" live>{copy[failure]}</InlineNotice> : null}
          <ButtonGroup>
            <Button type="submit" variant="accent" disabled={!date} pending={sending} pendingLabel={copy.sending}>{copy.send}</Button>
            <Button disabled={sending} onClick={() => { setOpen(false); setDate(''); setFailure(null); }}>{copy.cancel}</Button>
          </ButtonGroup>
        </form>
        : null}
    </div>
  </Card>;
}
