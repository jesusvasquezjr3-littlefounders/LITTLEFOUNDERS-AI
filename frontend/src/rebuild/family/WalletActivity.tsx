import { Button, Copy, StatusMark } from '../design/controls';
import type { Bucket, LedgerEntry, RedemptionStatus } from './familyHubApi';
import '../design/tokens.css';
import '../design/system.css';
import './familyHub.css';

/*
 * The child's own coin history (D.5 / OD-21 consumer). Every guardian
 * correction and every move out of a goal shows the Tutor's reason; a reward
 * shows its whole lifecycle, including "You got it" once a Tutor marks it
 * delivered. Plain informational text: no celebration, no lives, coins
 * never called money.
 */

export interface WalletActivityCopy {
  open: string; close: string; heading: string; loading: string; failed: string; retry: string; empty: string;
  earned: string; allowance: string; bonus: string; spent: string; correction: string; fromGoal: string; note: string;
  rewardsHeading: string; requested: string; approved: string; denied: string; fulfilled: string; rewardUntitled: string;
  save: string; spend: string; share: string;
}

export interface RewardLine { id: string; title: string | null; status: RedemptionStatus; at: string }

export function WalletActivity({ copy, locale, dark, open, loading, failed, entries, rewards, onToggle, onRetry }: {
  copy: WalletActivityCopy; locale: string; dark: boolean; open: boolean; loading: boolean; failed: boolean;
  entries: LedgerEntry[]; rewards: RewardLine[]; onToggle: () => void; onRetry: () => void;
}) {
  const date = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
  const bucketLabel = (b: Bucket) => (b === 'save' ? copy.save : b === 'spend' ? copy.spend : copy.share);
  const label = (e: LedgerEntry) => ({
    task_approved: copy.earned, allowance: copy.allowance, savings_bonus: copy.bonus, redemption: copy.spent,
    manual_adjustment: copy.correction, goal_withdrawal: copy.fromGoal,
  })[e.reason];
  const status = (s: RedemptionStatus) => ({ requested: copy.requested, approved: copy.approved, denied: copy.denied, fulfilled: copy.fulfilled })[s];

  return <section className="lf-rebuild lf-family-hub" data-family-hub="wallet-activity" data-theme={dark ? 'dark' : 'light'} lang={locale} aria-label={copy.heading}>
    <Button aria-expanded={open} onClick={onToggle}>{open ? copy.close : copy.open}</Button>
    {open && <>
      <Copy role="heading" as="h2">{copy.heading}</Copy>
      {failed ? <>
        <div className="lf-family-hub-notice" role="alert"><StatusMark correct={false} /><Copy role="body">{copy.failed}</Copy></div>
        <Button onClick={onRetry}>{copy.retry}</Button>
      </> : loading ? <div role="status"><Copy role="body">{copy.loading}</Copy></div> : <>
        {entries.length === 0 ? <Copy role="body">{copy.empty}</Copy> : <ul>{entries.map((e) => <li key={e.id} data-ledger-reason={e.reason}>
          <div className="lf-family-hub-row">
            <Copy role="option">{label(e)}</Copy>
            <span data-copy-role="data" className={`lf-family-hub-amount${e.amount > 0 ? ' lf-family-hub-amount--credit' : ''}`}>
              {e.amount > 0 ? `+${e.amount}` : `−${Math.abs(e.amount)}`} {bucketLabel(e.bucket)}
            </span>
          </div>
          {e.note && <span data-copy-role="data" className="ugc">{copy.note.replace('{note}', e.note)}</span>}
          <time data-copy-role="data" className="lf-family-hub-muted" dateTime={e.createdAt}>{date.format(new Date(e.createdAt))}</time>
        </li>)}</ul>}
        {rewards.length > 0 && <section aria-label={copy.rewardsHeading}>
          <h3 data-copy-role="heading">{copy.rewardsHeading}</h3>
          <ul>{rewards.map((r) => <li key={r.id} data-redemption-status={r.status}>
            <div className="lf-family-hub-row">
              <span data-copy-role="data" className="ugc">{r.title || copy.rewardUntitled}</span>
              <span data-copy-role="option" className="lf-family-hub-muted">{status(r.status)}</span>
            </div>
          </li>)}</ul>
        </section>}
      </>}
    </>}
  </section>;
}
