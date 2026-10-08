import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, ButtonGroup, Card, Copy, InlineNotice, LoadingState } from '../../design/controls';
import type { ConsoleTransport } from '../../family/console/consoleApi';
import { NotYetForm, type NotYetCopy } from '../../family/NotYetForm';
import type { NotYet } from '../../family/familyAutonomyApi';
import { answerAllowanceRequest, DENIAL_CODES, fetchAllowanceRequests, type AllowanceRequest, type AskReason, type DenialCode } from './coinsApi';
import '../../design/tokens.css';
import '../../design/system.css';

/*
 * The Tutor's side of "ask for a bigger allowance": the request in the child's
 * own words (a closed reason, a short note), a yes that sets the new allowance,
 * and a "not yet" that always carries a reason code and a reason that says what
 * the child can do next, with a date when it is "later" (D.18). The same form
 * every other "not yet" in the family uses. Adult band copy.
 */

export interface RequestsCopy {
  heading: string; line: string; every: Record<'weekly' | 'biweekly' | 'monthly', string>; reasons: Record<AskReason, string>; yes: string; notYet: string;
  saved: string; denied: string; failed: string; answeredYes: string; answeredNo: string; none: string; loading: string; retry: string;
}

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
const DENIAL_FORM_CODES = DENIAL_CODES as readonly DenialCode[];

export function AllowanceRequests({ copy, notYetCopy, kidId, kidName, locale, frequency, transport, onAnswered }: {
  copy: RequestsCopy;
  notYetCopy: NotYetCopy;
  kidId: string;
  kidName: string;
  locale: string;
  /** How often the child's allowance is paid, so "asks for 18" reads "asks for 18 each week". */
  frequency: 'weekly' | 'biweekly' | 'monthly';
  transport: ConsoleTransport;
  /** A yes changed the allowance: the setup form re-reads. */
  onAnswered: () => void;
}) {
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const [requests, setRequests] = useState<AllowanceRequest[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);

  const load = useCallback(async () => {
    const current = ++generation.current;
    const result = await fetchAllowanceRequests(transport, kidId);
    if (current !== generation.current) return;
    if (!result.ok) { setFailed(true); return; }
    setFailed(false);
    setRequests(result.data);
  }, [transport, kidId]);

  useEffect(() => { setRequests(null); setNotice(null); setDeclining(false); void load(); }, [load]);

  const open = requests?.find((r) => r.status === 'requested') ?? null;
  const last = requests?.find((r) => r.status === 'approved' || r.status === 'denied') ?? null;
  const every = copy.every[frequency];

  async function answer(body: Parameters<typeof answerAllowanceRequest>[2]) {
    if (!open || busy) return;
    setBusy(true); setNotice(null);
    const result = await answerAllowanceRequest(transport, open.id, body);
    setBusy(false);
    if (!result.ok) { setNotice({ text: copy.failed, error: true }); return; }
    setDeclining(false);
    setNotice({ text: result.data === 'approved' ? fill(copy.saved, { amount: number.format(open.amount) }) : copy.denied, error: false });
    await load();
    if (result.data === 'approved') onAnswered();
  }

  // Nothing to answer and nothing recent to show: the card does not take space on the page.
  if (!failed && requests !== null && !open && !last && !notice) return null;

  return <Card heading={copy.heading}>
    <div className="lf-console-form" data-family-part="allowance-requests">
      {failed ? <InlineNotice tone="error" live>{copy.failed}</InlineNotice> : requests === null ? <LoadingState label={copy.loading} lines={2} /> : <>
        {open ? <>
          <Copy role="body">{fill(copy.line, { name: kidName, amount: number.format(open.amount), every, from: number.format(open.fromAmount) })}</Copy>
          <Copy role="body">{copy.reasons[open.reasonKind]}{open.note ? `: ${open.note}` : ''}</Copy>
          {declining
            ? <NotYetForm copy={notYetCopy} codes={DENIAL_FORM_CODES} busy={busy}
              onCancel={() => setDeclining(false)}
              onSubmit={(notYet: NotYet) => void answer({ approve: false, reasonCode: notYet.reasonCode as DenialCode, reason: notYet.reason, revisitOn: notYet.revisitOn })} />
            : <ButtonGroup>
              <Button variant="success" pending={busy} onClick={() => void answer({ approve: true })}>{copy.yes}</Button>
              <Button disabled={busy} onClick={() => setDeclining(true)}>{copy.notYet}</Button>
            </ButtonGroup>}
        </> : last ? <Copy role="body">
          {last.status === 'approved'
            ? fill(copy.answeredYes, { amount: number.format(last.amount), every })
            : fill(copy.answeredNo, { reason: last.decisionReason ?? '' })}
        </Copy> : <Copy role="body">{copy.none}</Copy>}
        {notice ? <InlineNotice tone={notice.error ? 'error' : 'success'} live>{notice.text}</InlineNotice> : null}
      </>}
    </div>
  </Card>;
}
