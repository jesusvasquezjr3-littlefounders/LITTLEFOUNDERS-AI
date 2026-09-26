import { useEffect, useId, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { Button, Copy, InlineNotice, LoadingState, SegmentedControl, TextAreaField, TextField } from '../design/controls';
import type { Bucket, GuardianAction, KidGoal } from './familyHubApi';
import { GoalProgress, type GoalProgressCopy } from './GoalProgress';
import '../design/tokens.css';
import '../design/system.css';
import './familyHub.css';

/*
 * D.5 / OD-21 guardian money flows, rebuilt surface (transport lives in the
 * routes wrapper):
 *  - Correct coins: a verified Tutor adds or removes coins in one pocket with
 *    a REQUIRED reason the child will see (ledger 'manual_adjustment').
 *  - Coins in goals: a Tutor moves coins out of a goal into Spend, or back
 *    into plain Save, again with a required reason ('goal_withdrawal').
 *  - Rewards to deliver: an approved reward is marked delivered
 *    (redemption 'fulfilled').
 *  - Past corrections: every guardian action with its reason, attributed as
 *    "you" or "another Tutor" only.
 * Client validation mirrors the server's (integer 1-1000, 1-240 character
 * reason) so a family learns the rule before a round trip; the server and the
 * database remain the boundary. No celebration: none of these is a milestone.
 */

export interface WalletCorrectionsCopy {
  title: string; close: string; heading: string; loading: string; failed: string; retry: string;
  adjustHeading: string; bucket: string; save: string; spend: string; share: string; direction: string; add: string; remove: string;
  amount: string; reason: string; reasonHint: string; submit: string; saving: string; saved: string; reasonRequired: string; amountInvalid: string;
  insufficient: string; protected: string; saveFailed: string;
  goalsHeading: string; moveOut: string; destination: string; toSpend: string; toSave: string; moved: string; goalShort: string; noGoals: string;
  rewardsHeading: string; deliver: string; delivered: string; notApproved: string; noRewards: string; rewardUntitled: string;
  historyHeading: string; noHistory: string; byYou: string; byOther: string; kindAdjust: string; kindGoal: string;
}

export interface DeliverableReward { id: string; title: string | null; approvedAt: string }
export type Notice = { text: string; error: boolean } | null;

/** A pick-one choice (pocket, direction, destination): the shared SegmentedControl, named by its visible legend. */
function Options<T extends string>({ label, value, options, onChange, disabled }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; disabled: boolean;
}) {
  const name = useId();
  return <SegmentedControl legend={label} name={name} value={value} options={options} disabled={disabled} onValueChange={onChange} />;
}

/**
 * The required reason the child will read: free text of up to 240 characters,
 * so the shared multi-line field. The hint sits above the box as its help; the
 * validation message is the form's own notice, announced on submit.
 */
function ReasonField({ label, hint, value, onChange, disabled }: {
  label: string; hint: string; value: string; onChange: (value: string) => void; disabled: boolean;
}) {
  return <TextAreaField label={label} help={hint} data-copy-role="data" value={value} maxLength={240} required aria-required="true" rows={3}
    disabled={disabled} onChange={(event) => onChange(event.target.value)} />;
}

const parseAmount = (raw: string) => /^\d{1,4}$/.test(raw.trim()) ? Number(raw.trim()) : NaN;
const validAmount = (amount: number) => Number.isInteger(amount) && amount >= 1 && amount <= 1000;

export function WalletCorrections({ copy, progressCopy, locale, dark, kidName, open, loading, failed, goals, rewards, history, busy, notice, onToggle, onRetry, onAdjust, onWithdraw, onDeliver }: {
  copy: WalletCorrectionsCopy;
  /** S07.4 (D.16): each goal shows the child's own coins apart from bonus and Tutor coins. */
  progressCopy: GoalProgressCopy;
  locale: string; dark: boolean; kidName: string; open: boolean; loading: boolean; failed: boolean;
  goals: KidGoal[]; rewards: DeliverableReward[]; history: GuardianAction[]; busy: boolean; notice: Notice;
  onToggle: () => void; onRetry: () => void;
  onAdjust: (input: { bucket: Bucket; amount: number; reason: string }) => Promise<boolean>;
  onWithdraw: (goalId: string, input: { amount: number; destination: 'spend' | 'save'; reason: string }) => Promise<boolean>;
  onDeliver: (redemptionId: string) => void;
}) {
  const [bucket, setBucket] = useState<Bucket>('spend');
  const [direction, setDirection] = useState<'add' | 'remove'>('add');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [goalAmount, setGoalAmount] = useState('');
  const [destination, setDestination] = useState<'spend' | 'save'>('spend');
  const [goalReason, setGoalReason] = useState('');
  const [goalError, setGoalError] = useState<string | null>(null);
  const lastAction = useRef<HTMLButtonElement | null>(null);
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!busy && lastAction.current && document.activeElement === document.body) {
      (lastAction.current.isConnected ? lastAction.current : root.current?.querySelector('button'))?.focus();
    }
  }, [busy]);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  const bucketLabel = (b: Bucket) => (b === 'save' ? copy.save : b === 'spend' ? copy.spend : copy.share);
  const heldGoals = goals.filter((g) => g.saved > 0);

  async function submitAdjustment(event: FormEvent) {
    event.preventDefault();
    const value = parseAmount(amount);
    if (!validAmount(value)) return setAdjustError(copy.amountInvalid);
    if (reason.trim().length === 0) return setAdjustError(copy.reasonRequired);
    setAdjustError(null);
    const saved = await onAdjust({ bucket, amount: direction === 'add' ? value : -value, reason: reason.trim() });
    if (saved) { setAmount(''); setReason(''); }
  }

  async function submitWithdrawal(event: FormEvent) {
    event.preventDefault();
    if (!goalId) return;
    const value = parseAmount(goalAmount);
    if (!validAmount(value)) return setGoalError(copy.amountInvalid);
    if (goalReason.trim().length === 0) return setGoalError(copy.reasonRequired);
    setGoalError(null);
    const moved = await onWithdraw(goalId, { amount: value, destination, reason: goalReason.trim() });
    if (moved) { setGoalId(null); setGoalAmount(''); setGoalReason(''); }
  }

  const remember = (event: MouseEvent<HTMLButtonElement>) => { lastAction.current = event.currentTarget; };

  return <section ref={root} className="lf-rebuild lf-family-hub" data-family-hub="wallet-corrections" data-theme={dark ? 'dark' : 'light'} lang={locale} aria-label={copy.heading.replace('{name}', kidName)}>
    <Button aria-expanded={open} onClick={onToggle}>{open ? copy.close : copy.title}</Button>
    {open && <>
      <Copy role="heading" as="h2">{copy.heading.replace('{name}', kidName)}</Copy>
      {notice && <InlineNotice tone={notice.error ? 'error' : 'info'} live>{notice.text}</InlineNotice>}
      {busy && <InlineNotice tone="info" live>{copy.saving}</InlineNotice>}
      {failed ? <>
        <InlineNotice tone="error" live>{copy.failed}</InlineNotice>
        <Button onClick={onRetry}>{copy.retry}</Button>
      </> : loading ? <LoadingState label={copy.loading} lines={2} /> : <>
        <form onSubmit={(event) => void submitAdjustment(event)} noValidate aria-label={copy.adjustHeading}>
          <h3 data-copy-role="heading">{copy.adjustHeading}</h3>
          <Options label={copy.bucket} value={bucket} disabled={busy} onChange={setBucket}
            options={[{ value: 'save', label: copy.save }, { value: 'spend', label: copy.spend }, { value: 'share', label: copy.share }]} />
          <Options label={copy.direction} value={direction} disabled={busy} onChange={setDirection}
            options={[{ value: 'add', label: copy.add }, { value: 'remove', label: copy.remove }]} />
          <TextField label={copy.amount} inputMode="numeric" autoComplete="off" value={amount} disabled={busy} onChange={(event) => setAmount(event.target.value)} />
          <ReasonField label={copy.reason} hint={copy.reasonHint} value={reason} disabled={busy} onChange={setReason} />
          {adjustError && <InlineNotice tone="error" live>{adjustError}</InlineNotice>}
          <Button type="submit" variant="accent" disabled={busy} onClick={remember}>{copy.submit}</Button>
        </form>

        <section aria-label={copy.goalsHeading}>
          <h3 data-copy-role="heading">{copy.goalsHeading}</h3>
          {heldGoals.length === 0 ? <Copy role="body">{copy.noGoals}</Copy> : <ul>{heldGoals.map((goal) => <li key={goal.id}>
            <div className="lf-family-hub-row">
              <span data-copy-role="data" className="ugc">{goal.title}</span>
            </div>
            <GoalProgress copy={progressCopy} title={goal.title} target={goal.target} progress={goal.progress} />
            {goalId === goal.id ? <form onSubmit={(event) => void submitWithdrawal(event)} noValidate aria-label={copy.moveOut}>
              <Options label={copy.destination} value={destination} disabled={busy} onChange={setDestination}
                options={[{ value: 'spend', label: copy.toSpend }, { value: 'save', label: copy.toSave }]} />
              <TextField label={copy.amount} inputMode="numeric" autoComplete="off" value={goalAmount} disabled={busy} onChange={(event) => setGoalAmount(event.target.value)} />
              <ReasonField label={copy.reason} hint={copy.reasonHint} value={goalReason} disabled={busy} onChange={setGoalReason} />
              {goalError && <InlineNotice tone="error" live>{goalError}</InlineNotice>}
              <div className="lf-family-hub-actions">
                <Button type="submit" variant="accent" disabled={busy} onClick={remember}>{copy.moveOut}</Button>
                <Button disabled={busy} onClick={() => { setGoalId(null); setGoalError(null); }}>{copy.close}</Button>
              </div>
            </form> : <Button disabled={busy} onClick={(event) => { remember(event); setGoalId(goal.id); setGoalAmount(''); setGoalReason(''); setGoalError(null); setDestination('spend'); }}>{copy.moveOut}</Button>}
          </li>)}</ul>}
        </section>

        <section aria-label={copy.rewardsHeading}>
          <h3 data-copy-role="heading">{copy.rewardsHeading}</h3>
          {rewards.length === 0 ? <Copy role="body">{copy.noRewards}</Copy> : <ul>{rewards.map((reward) => <li key={reward.id}>
            <div className="lf-family-hub-row">
              <span data-copy-role="data" className="ugc">{reward.title || copy.rewardUntitled}</span>
              <time data-copy-role="data" className="lf-family-hub-muted" dateTime={reward.approvedAt}>{date.format(new Date(reward.approvedAt))}</time>
            </div>
            <Button variant="success" disabled={busy} onClick={(event) => { remember(event); onDeliver(reward.id); }}>{copy.deliver}</Button>
          </li>)}</ul>}
        </section>

        <section aria-label={copy.historyHeading}>
          <h3 data-copy-role="heading">{copy.historyHeading}</h3>
          {history.length === 0 ? <Copy role="body">{copy.noHistory}</Copy> : <ul>{history.map((action) => <li key={action.id} data-action-kind={action.kind}>
            <div className="lf-family-hub-row">
              <Copy role="option">{action.kind === 'manual_adjustment' ? `${copy.kindAdjust}: ${bucketLabel(action.bucket)}` : `${copy.kindGoal}: ${bucketLabel(action.bucket)}`}</Copy>
              <span data-copy-role="data" className={`lf-family-hub-amount${action.kind === 'manual_adjustment' && action.amount > 0 ? ' lf-family-hub-amount--credit' : ''}`}>
                {action.kind === 'manual_adjustment' ? (action.amount > 0 ? `+${action.amount}` : `−${Math.abs(action.amount)}`) : String(action.amount)}
              </span>
            </div>
            <span data-copy-role="data" className="ugc">{action.reason}</span>
            <div className="lf-family-hub-row lf-family-hub-muted">
              <span data-copy-role="option">{action.byMe ? copy.byYou : copy.byOther}</span>
              <time data-copy-role="data" dateTime={action.createdAt}>{date.format(new Date(action.createdAt))}</time>
            </div>
          </li>)}</ul>}
        </section>
      </>}
    </>}
  </section>;
}
