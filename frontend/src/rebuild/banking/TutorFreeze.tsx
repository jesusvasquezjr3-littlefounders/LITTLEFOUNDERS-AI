import { useId, useState } from 'react';
import { Button, Copy, InlineNotice, LoadingState } from '../design/controls';
import type { MoneyRegister } from '../family/moneyRegister';
import type { FreezeHold, TutorFreezeView } from './bankingApi';
import '../design/tokens.css';
import '../design/system.css';
import '../family/familyHub.css';
import './coinAccount.css';

/*
 * S07.6 (D.7), the Tutor's freeze card. It states what a freeze really holds
 * (from the server, never from copy), that it moves no coins, who set the
 * current freeze, and which age view the child reads (D.12), so the Tutor
 * knows what their child sees. Freezing asks once; unfreezing does not. The
 * new state is re-read from Core after every change, never assumed.
 */

export interface TutorFreezeCopy {
  heading: string; practice: string; frozen: string; notFrozen: string; byYou: string; byChild: string; byTutor: string; whileFrozen: string; whatHolds: string;
  holdRewards: string; holdSplits: string; holdCredits: string; holdShare: string; nothingLost: string; noCoinsMoved: string; freeze: string;
  unfreeze: string; confirmFreeze: string; confirm: string; cancel: string; view: string; bandYoung: string; bandTransition: string; bandTeen: string;
  noAccount: string; loading: string; failed: string; retry: string; frozenNotice: string; unfrozenNotice: string; changeFailed: string;
}

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
const HOLD_KEY: Record<FreezeHold, 'holdRewards' | 'holdSplits' | 'holdCredits' | 'holdShare'> = {
  rewards: 'holdRewards', splits: 'holdSplits', credits: 'holdCredits', share: 'holdShare',
};
const BAND_KEY: Record<MoneyRegister, 'bandYoung' | 'bandTransition' | 'bandTeen'> = { young: 'bandYoung', transition: 'bandTransition', teen: 'bandTeen' };

export function TutorFreeze({ copy, name, locale, dark, view, loading, failed, busy, notice, onRetry, onFreeze }: {
  copy: TutorFreezeCopy;
  /** The child's display name, as the Tutor already sees it. */
  name: string;
  locale: string;
  dark: boolean;
  view: TutorFreezeView | null;
  loading: boolean;
  failed: boolean;
  busy: boolean;
  notice: { text: string; error: boolean } | null;
  onRetry: () => void;
  onFreeze: (frozen: boolean) => void;
}) {
  const headingId = useId();
  const holdsId = useId();
  const listId = useId();
  const [confirming, setConfirming] = useState(false);
  const [holdsOpen, setHoldsOpen] = useState(false);
  const card = view?.account ?? null;

  return <section className="lf-rebuild lf-family-hub lf-coin-account" data-coin-account="tutor" data-theme={dark ? 'dark' : 'light'} lang={locale}
    aria-labelledby={headingId}>
    <h2 id={headingId} data-copy-role="heading">{fill(copy.heading, { name })}</h2>
    {failed ? <>
      <InlineNotice tone="error" live>{copy.failed}</InlineNotice>
      <Button onClick={onRetry}>{copy.retry}</Button>
    </> : loading || !view ? <LoadingState label={copy.loading} lines={2} /> : <>
      {notice && <InlineNotice tone={notice.error ? 'error' : 'success'} live>{notice.text}</InlineNotice>}
      <p data-copy-role="body" data-register={view.register}>{fill(copy.view, { name, band: copy[BAND_KEY[view.register]] })}</p>
      {!card ? <Copy role="body">{copy.noAccount}</Copy> : <>
        <div className="lf-coin-card" data-control="simulation" data-design={card.design} data-frozen={card.freeze.frozen}>
          <span className="lf-coin-card-name" data-copy-role="data">{card.nickname}</span>
          <span className="lf-coin-card-state" data-copy-role="body">{card.freeze.frozen ? copy.frozen : copy.notFrozen}</span>
        </div>
        <Copy role="body">{copy.practice}</Copy>
        <section className="lf-coin-freeze" data-control="freeze" data-frozen={card.freeze.frozen} data-by={card.freeze.by ?? 'none'} aria-labelledby={holdsId}>
          {card.freeze.frozen && <Copy role="body">{card.freeze.by === 'you' ? copy.byYou : card.freeze.by === 'child' ? fill(copy.byChild, { name }) : copy.byTutor}</Copy>}
          {/* W2F.2 (06 §4 layering): what a freeze holds is always shown at the point of action (the confirmation), and one press
              away otherwise, so the page's first view stays within budget. GAP-FIX-R5: one press away while frozen too (the audited
              frozen first view read 57 words against 40); the first view keeps the state, who froze it and Unfreeze. The list is the
              server's, never copy's (D.7). */}
          {!confirming && <div className="lf-family-hub-actions"><Button size="sm" aria-expanded={holdsOpen} aria-controls={listId}
            data-freeze-control="holds" onClick={() => setHoldsOpen((open) => !open)}>{copy.whatHolds}</Button></div>}
          <div id={listId} hidden={!confirming && !holdsOpen}>
            <p id={holdsId} data-copy-role="body">{copy.whileFrozen}</p>
            <ul className="lf-coin-holds">
              {card.freeze.holds.map((hold) => <li key={hold} data-hold={hold} data-control={`freeze.${hold}`}><span data-copy-role="body">{copy[HOLD_KEY[hold]]}</span></li>)}
            </ul>
            <Copy role="body">{copy.nothingLost}</Copy>
            <Copy role="body">{copy.noCoinsMoved}</Copy>
          </div>
          {card.freeze.frozen
            ? <div className="lf-family-hub-actions"><Button variant="success" disabled={busy} data-control="freeze.owner" onClick={() => onFreeze(false)}>{copy.unfreeze}</Button></div>
            : confirming ? <div className="lf-coin-confirm" role="group" aria-label={fill(copy.confirmFreeze, { name })}>
              <Copy role="prompt">{fill(copy.confirmFreeze, { name })}</Copy>
              <div className="lf-family-hub-actions">
                <Button variant="accent" disabled={busy} data-control="freeze.owner" onClick={() => { setConfirming(false); onFreeze(true); }}>{copy.confirm}</Button>
                <Button disabled={busy} onClick={() => setConfirming(false)}>{copy.cancel}</Button>
              </div>
            </div>
            : <div className="lf-family-hub-actions"><Button data-freeze-control="ask" disabled={busy} onClick={() => setConfirming(true)}>{copy.freeze}</Button></div>}
        </section>
      </>}
    </>}
  </section>;
}
