import { useId, useState } from 'react';
import { Button, Copy, StatusMark } from '../design/controls';
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
  heading: string; practice: string; frozen: string; notFrozen: string; byYou: string; byChild: string; byTutor: string; whileFrozen: string;
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
  const [confirming, setConfirming] = useState(false);
  const card = view?.account ?? null;

  return <section className="lf-rebuild lf-family-hub lf-coin-account" data-coin-account="tutor" data-theme={dark ? 'dark' : 'light'} lang={locale}
    aria-labelledby={headingId}>
    <h2 id={headingId} data-copy-role="heading">{fill(copy.heading, { name })}</h2>
    {failed ? <>
      <div className="lf-family-hub-notice" role="alert"><StatusMark correct={false} /><Copy role="body">{copy.failed}</Copy></div>
      <Button onClick={onRetry}>{copy.retry}</Button>
    </> : loading || !view ? <div role="status"><Copy role="body">{copy.loading}</Copy></div> : <>
      {notice && <div className="lf-family-hub-notice" role={notice.error ? 'alert' : 'status'}><StatusMark correct={!notice.error} /><Copy role="body">{notice.text}</Copy></div>}
      <p data-copy-role="body" data-register={view.register}>{fill(copy.view, { name, band: copy[BAND_KEY[view.register]] })}</p>
      {!card ? <Copy role="body">{copy.noAccount}</Copy> : <>
        <div className="lf-coin-card" data-control="simulation" data-design={card.design} data-frozen={card.freeze.frozen}>
          <span className="lf-coin-card-name" data-copy-role="data">{card.nickname}</span>
          <span className="lf-coin-card-state" data-copy-role="body">{card.freeze.frozen ? copy.frozen : copy.notFrozen}</span>
        </div>
        <Copy role="body">{copy.practice}</Copy>
        <section className="lf-coin-freeze" data-control="freeze" data-frozen={card.freeze.frozen} data-by={card.freeze.by ?? 'none'} aria-labelledby={holdsId}>
          {card.freeze.frozen && <Copy role="body">{card.freeze.by === 'you' ? copy.byYou : card.freeze.by === 'child' ? fill(copy.byChild, { name }) : copy.byTutor}</Copy>}
          <p id={holdsId} data-copy-role="body">{copy.whileFrozen}</p>
          <ul className="lf-coin-holds">
            {card.freeze.holds.map((hold) => <li key={hold} data-hold={hold} data-control={`freeze.${hold}`}><span data-copy-role="body">{copy[HOLD_KEY[hold]]}</span></li>)}
          </ul>
          <Copy role="body">{copy.nothingLost}</Copy>
          <Copy role="body">{copy.noCoinsMoved}</Copy>
          {card.freeze.frozen
            ? <div className="lf-family-hub-actions"><Button variant="success" disabled={busy} data-control="freeze.owner" onClick={() => onFreeze(false)}>{copy.unfreeze}</Button></div>
            : confirming ? <div className="lf-coin-confirm" role="group" aria-label={fill(copy.confirmFreeze, { name })}>
              <Copy role="prompt">{fill(copy.confirmFreeze, { name })}</Copy>
              <div className="lf-family-hub-actions">
                <Button variant="accent" disabled={busy} data-control="freeze.owner" onClick={() => { setConfirming(false); onFreeze(true); }}>{copy.confirm}</Button>
                <Button disabled={busy} onClick={() => setConfirming(false)}>{copy.cancel}</Button>
              </div>
            </div>
            : <div className="lf-family-hub-actions"><Button disabled={busy} onClick={() => setConfirming(true)}>{copy.freeze}</Button></div>}
        </section>
      </>}
    </>}
  </section>;
}
