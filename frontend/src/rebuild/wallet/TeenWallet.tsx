import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  Button, ButtonLink, CoinAmount, Copy, DashboardLayout, EmptyState, ErrorState, InlineNotice, LoadingState, SegmentedControl, SelectField, TextField,
} from '../design/controls';
import {
  archiveGoal, archiveReward, claimReward, createGoal, createParentInvite, createReward, decideParent, fetchBalances,
  fetchHistory, fetchParents, fetchRewards, fetchWalletAccess, logIncome, releaseGoal,
  type Balances, type IncomeSource, type ParentLink, type PersonalReward, type Session, type WalletAccess, type WalletEntry,
} from './walletApi';
import {
  archiveOwnDestination, createHabitGoal, createOwnDestination, declineNextStep, fetchHabitGoals, fetchShare, fetchUsualSplit, markNextStepSeen,
  nextStepDue, pledgeGift, saveUsualSplit, settleOwnGift, splitCoins, type HabitGoal, type ShareView, type UsualSplit as Usual,
} from '../family/moneyHabitsApi';
import { GoalProgress, type GoalProgressCopy } from '../family/GoalProgress';
import { GoalNextStep, type GoalNextStepCopy } from '../family/GoalNextStep';
import { ShareGiving, type ShareGivingCopy, type ShareTeenCopy } from '../family/ShareGiving';
import { UsualSplit, type UsualSplitCopy } from '../family/UsualSplit';
import type { TeenWalletScreenCopy } from '../family/tasks/taskParts';
import '../design/tokens.css';
import '../design/system.css';
import './teenWallet.css';

/*
 * S07.2 — D.3 (OD-3 Option B): the self-registered teen's personal wallet,
 * rebuilt surface. The teen logs income and splits it across Save, Spend and
 * Share in one step, keeps savings goals, keeps a personal reward list and
 * marks a reward for themselves, reads their history, and may invite a
 * parent later. There is no approval step anywhere. Tasks stay locked until
 * a parent is linked (guardian-only, Option B); once linked, the family
 * mechanics use this same wallet.
 *
 * Composition: the balance is always visible; every section opens on demand
 * so the first view stays inside the Copy Budget. The coins are labelled as
 * simulated once, in one chip (Bible 06 §5 rule 3). No lives, no streak, no
 * variable reward. Mentor characters do not appear.
 *
 * S07.4: income is offered pre-split by the teen's own usual split (D.13; any
 * other split is accepted), every goal bar shows its provenance (D.16), a
 * reached goal celebrates once (the OD-7 milestone) with "what's your next
 * goal?" (D.15), and the Share pocket has real places the teen chooses and
 * logs (D.14).
 * Client validation mirrors the server's (integers, 1–1000 income, 1–500
 * reward cost, 1–60 character names); Core and the database remain the
 * boundary.
 *
 * W2F.2 (the /wallet screen): with `screen`, a failed read is one of the
 * design system's page states: offline says so, a refusal (Core does not
 * classify this account as a self-registered teen's) explains itself and
 * offers the way back, anything else is ours to fix, with a retry. `aside`
 * holds the page's companions beside the wallet (Beyond the app, what the
 * practice covers, the teen's own research answer).
 */

type Group<K extends string> = Record<K, string>;
export interface TeenWalletCopy {
  page: Group<'title' | 'sub' | 'simulation' | 'loading' | 'failed' | 'retry' | 'total' | 'save' | 'spend' | 'share' | 'sections' | 'close'>;
  income: Group<'open' | 'heading' | 'amount' | 'source' | 'allowance' | 'gift' | 'earned' | 'split' | 'left' | 'done' | 'toGoal' | 'noGoal'
    | 'submit' | 'saving' | 'added' | 'goalReached' | 'invalidAmount' | 'splitMismatch' | 'frozen' | 'failed' | 'useUsual' | 'usualNote'>;
  goals: Group<'open' | 'heading' | 'empty' | 'name' | 'target' | 'create' | 'created' | 'invalid' | 'progress' | 'reached' | 'archived' | 'move'
    | 'moveAmount' | 'destination' | 'toSpend' | 'toSave' | 'confirmMove' | 'moved' | 'moveTooMany' | 'archive' | 'archivedNotice' | 'failed'>;
  rewards: Group<'open' | 'heading' | 'empty' | 'name' | 'cost' | 'create' | 'created' | 'invalid' | 'price' | 'use' | 'used' | 'notEnough' | 'limit'
    | 'full' | 'archive' | 'archivedNotice' | 'failed'>;
  history: Group<'open' | 'heading' | 'empty' | 'income' | 'allowance' | 'gift' | 'earned' | 'reward' | 'goalMove' | 'task' | 'familyReward'
    | 'tutorCorrection' | 'tutorGoalMove' | 'familyAllowance' | 'bonus' | 'note' | 'shared' | 'shareBack'>;
  parents: Group<'open' | 'heading' | 'tasksLocked' | 'optional' | 'invite' | 'inviting' | 'linkReady' | 'linkLabel' | 'copy' | 'copied' | 'copyFailed'
    | 'tooMany' | 'waiting' | 'unnamed' | 'confirm' | 'reject' | 'confirmed' | 'rejectedNotice' | 'verified' | 'rejected' | 'revoked' | 'pendingOther'
    | 'tasksOn' | 'openTasks' | 'failed'>;
}

/** S07.4: the shared money-habit copy (moneyHabits.json) the teen wallet reuses. */
export interface TeenHabitsCopy {
  usualSplit: Omit<UsualSplitCopy, 'save' | 'spend' | 'share' | 'more' | 'less'>;
  split: { more: string; less: string };
  goalProgress: GoalProgressCopy;
  nextGoal: GoalNextStepCopy & { started: string; later: string };
  share: ShareGivingCopy & { frozen: string };
  shareTeen: ShareTeenCopy;
}

type Panel = 'income' | 'goals' | 'rewards' | 'share' | 'history' | 'parents';
type Notice = { text: string; error: boolean } | null;
const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
const asCount = (raw: string): number | null => (/^\d{1,6}$/.test(raw.trim()) ? Number(raw.trim()) : null);

/** A refusal or a confirmation: the shared InlineNotice, announced (an alert for a refusal, a status otherwise). */
function NoticeLine({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return <InlineNotice tone={notice.error ? 'error' : 'success'} live>{notice.text}</InlineNotice>;
}

/** A whole number of coins: the shared TextField with the numeric keyboard and a visible label. */
function CountField({ label, value, onChange, disabled, max }: {
  label: string; value: string; onChange: (value: string) => void; disabled?: boolean; max: number;
}) {
  return <TextField label={label} inputMode="numeric" type="number" min={0} max={max} step={1} value={value} disabled={disabled}
    onChange={(event) => onChange(event.target.value)} />;
}

/** A short name the teen writes (a goal, a reward). */
function NameField({ label, value, onChange, disabled, maxLength }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; maxLength: number }) {
  return <TextField label={label} autoComplete="off" value={value} maxLength={maxLength} disabled={disabled} onChange={(event) => onChange(event.target.value)} />;
}

/** A pick-one choice (where income came from, where goal coins go): the shared SegmentedControl. */
function Choices<T extends string>({ label, value, options, onChange, disabled }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; disabled?: boolean;
}) {
  const name = useId();
  return <SegmentedControl legend={label} name={name} value={value} options={options} disabled={disabled} onValueChange={onChange} />;
}

function Section({ id, heading, children }: { id: string; heading: string; children: ReactNode }) {
  return <section id={id} className="lf-teen-wallet-section" aria-label={heading}>
    <Copy role="heading" as="h2">{heading}</Copy>
    {children}
  </section>;
}

/** Core's answers that mean "this account holds no personal wallet", not a failure to fix. */
const REFUSED = new Set(['WALLET_UNAVAILABLE', 'WALLET_HOLDER_REQUIRED', 'FORBIDDEN', 'TEEN_WALLET_REQUIRED']);
type Failure = 'failed' | 'offline' | 'refused';

export function TeenWallet({ copy, habits, locale, dark, session, tasksHref, onOpenTasks, inviteLinkFor, copyText, onAccessChanged, screen, aside }: {
  copy: TeenWalletCopy;
  habits: TeenHabitsCopy;
  locale: string;
  dark: boolean;
  session: Session;
  tasksHref: string;
  onOpenTasks: () => void;
  inviteLinkFor: (token: string) => string;
  copyText: (text: string) => Promise<boolean>;
  /** Called after the teen confirms a parent, so the shell re-reads which sections unlock. */
  onAccessChanged?: () => void;
  /** The /wallet screen's page states (W2F.2); without it, a failure is the S07.2 notice and retry. */
  screen?: { copy: TeenWalletScreenCopy; learnHref: string; onNavigate: (href: string) => void };
  /** The page's companions, beside the wallet on a wide screen and after it on a phone. */
  aside?: ReactNode;
}) {
  const ids = { title: useId(), income: useId(), goals: useId(), rewards: useId(), share: useId(), history: useId(), parents: useId() };
  const [access, setAccess] = useState<WalletAccess | null>(null);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [goals, setGoals] = useState<HabitGoal[]>([]);
  const [usual, setUsual] = useState<Usual | null>(null);
  const [share, setShare] = useState<ShareView | null>(null);
  const [rewards, setRewards] = useState<PersonalReward[]>([]);
  const [history, setHistory] = useState<WalletEntry[]>([]);
  const [parents, setParents] = useState<ParentLink[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [failure, setFailure] = useState<Failure>('failed');
  const [retrying, setRetrying] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);

  const load = useCallback(async () => {
    const current = ++generation.current;
    const [accessRes, balanceRes, goalsRes, rewardsRes, historyRes, parentsRes, usualRes, shareRes] = await Promise.all([
      fetchWalletAccess(session), fetchBalances(session), fetchHabitGoals(session), fetchRewards(session), fetchHistory(session), fetchParents(session),
      fetchUsualSplit(session), fetchShare(session),
    ]);
    if (current !== generation.current) return;
    setRetrying(false);
    if (!accessRes.ok || !balanceRes.ok || !goalsRes.ok || !rewardsRes.ok || !historyRes.ok || !parentsRes.ok || !usualRes.ok || !shareRes.ok
      || accessRes.data.holder !== 'teen') {
      const codes = [accessRes, balanceRes, goalsRes, rewardsRes, historyRes, parentsRes, usualRes, shareRes].flatMap((result) => result.ok ? [] : [result.code]);
      setFailure(codes.includes('NETWORK') ? 'offline'
        : (accessRes.ok && accessRes.data.holder !== 'teen') || codes.some((code) => REFUSED.has(code)) ? 'refused' : 'failed');
      setState('failed');
      return;
    }
    setAccess(accessRes.data);
    setBalances(balanceRes.data.balances);
    setGoals(goalsRes.data.goals);
    setRewards(rewardsRes.data.rewards);
    setHistory(historyRes.data.entries.slice(0, 30));
    setParents(parentsRes.data.guardians);
    setUsual(usualRes.data);
    setShare(shareRes.data);
    setState('ready');
  }, [session]);

  useEffect(() => { void load(); }, [load]);

  function toggle(next: Panel) {
    setNotice(null);
    setPanel((open) => (open === next ? null : next));
  }

  /** Runs one write, then reloads everything the server holds; a refusal is shown, never an assumed success. */
  async function act(run: () => Promise<{ ok: true } | { ok: false; code: string }>, success: string, refusals: Record<string, string>, fallback: string): Promise<boolean> {
    if (busy) return false;
    setBusy(true); setNotice(null);
    const result = await run();
    setBusy(false);
    if (!result.ok) { setNotice({ text: refusals[result.code] ?? fallback, error: true }); return false; }
    setNotice({ text: success, error: false });
    await load();
    return true;
  }

  // ── Income ───────────────────────────────────────────────────────────────
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState<IncomeSource>('allowance');
  const [split, setSplit] = useState({ save: '', spend: '', share: '' });
  const [splitTouched, setSplitTouched] = useState(false);
  const [goalId, setGoalId] = useState('');
  const total = asCount(amount);

  /** D.13: the amount arrives pre-split by the teen's own usual split; editing a pocket overrides it. */
  function applyUsualSplit(forAmount: number | null) {
    if (!usual || forAmount === null || forAmount < 1 || forAmount > 1000) { setSplit({ save: '', spend: '', share: '' }); return; }
    const coins = splitCoins(forAmount, usual.usual);
    setSplit({ save: String(coins.save), spend: String(coins.spend), share: String(coins.share) });
    setSplitTouched(false);
  }

  function changeAmount(value: string) {
    setAmount(value);
    if (!splitTouched) applyUsualSplit(asCount(value));
  }
  const parts = { save: asCount(split.save || '0'), spend: asCount(split.spend || '0'), share: asCount(split.share || '0') };
  const splitSum = (parts.save ?? 0) + (parts.spend ?? 0) + (parts.share ?? 0);
  const left = total === null ? 0 : total - splitSum;
  const activeGoals = goals.filter((g) => g.status === 'active');

  async function submitIncome(event: FormEvent) {
    event.preventDefault();
    if (total === null || total < 1 || total > 1000) { setNotice({ text: copy.income.invalidAmount, error: true }); return; }
    if (parts.save === null || parts.spend === null || parts.share === null || splitSum !== total) {
      setNotice({ text: fill(copy.income.splitMismatch, { n: total }), error: true });
      return;
    }
    const chosenGoal = parts.save > 0 && goalId ? goalId : null;
    let reachedGoal: string | null = null;
    const ok = await act(async () => {
      const result = await logIncome({ source, save: parts.save!, spend: parts.spend!, share: parts.share!, goalId: chosenGoal }, session);
      if (result.ok && result.data.goal?.status === 'reached') reachedGoal = result.data.goal.title;
      return result;
    }, fill(copy.income.added, { n: total }), { ACCOUNT_FROZEN: copy.income.frozen }, copy.income.failed);
    if (ok) {
      setAmount(''); setSplit({ save: '', spend: '', share: '' }); setSplitTouched(false); setGoalId('');
      if (reachedGoal) setNotice({ text: `${fill(copy.income.added, { n: total })} ${fill(copy.income.goalReached, { goal: reachedGoal })}`, error: false });
    }
  }

  // ── Goals ────────────────────────────────────────────────────────────────
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [moving, setMoving] = useState<string | null>(null);
  const [moveAmount, setMoveAmount] = useState('');
  const [moveTo, setMoveTo] = useState<'spend' | 'save'>('spend');

  async function submitGoal(event: FormEvent) {
    event.preventDefault();
    const target = asCount(goalTarget);
    const title = goalName.trim();
    if (!title || title.length > 80 || target === null || target < 1 || target > 100000) { setNotice({ text: copy.goals.invalid, error: true }); return; }
    if (await act(() => createGoal({ title, target }, session), copy.goals.created, {}, copy.goals.failed)) { setGoalName(''); setGoalTarget(''); }
  }

  async function submitMove(event: FormEvent, goal: HabitGoal) {
    event.preventDefault();
    const n = asCount(moveAmount);
    if (n === null || n < 1 || n > Math.min(goal.saved, 1000)) { setNotice({ text: fill(copy.goals.moveTooMany, { n: goal.saved }), error: true }); return; }
    if (await act(() => releaseGoal(goal.id, { amount: n, destination: moveTo }, session), fill(copy.goals.moved, { n }),
      { GOAL_BALANCE_INSUFFICIENT: fill(copy.goals.moveTooMany, { n: goal.saved }), ACCOUNT_FROZEN: copy.income.frozen }, copy.goals.failed)) {
      setMoving(null); setMoveAmount('');
    }
  }

  // ── Usual split (D.13) ─────────────────────────────────────────────────
  const [usualOpen, setUsualOpen] = useState(false);
  const [usualVersion, setUsualVersion] = useState(0);
  const [usualNotice, setUsualNotice] = useState<Notice>(null);

  async function saveUsual(next: { save: number; spend: number; share: number }) {
    if (busy) return;
    setBusy(true); setUsualNotice(null);
    const result = await saveUsualSplit(next, session);
    setBusy(false);
    setUsualNotice(result.ok ? { text: habits.usualSplit.saved, error: false } : { text: habits.usualSplit.failed, error: true });
    if (result.ok) { setUsual(result.data); setUsualVersion((v) => v + 1); }
  }

  // ── Goals: the next step of a reached goal (D.15) ──────────────────────
  const [nextNotice, setNextNotice] = useState<{ goalId: string; text: string; error: boolean } | null>(null);

  async function nextStep(goal: HabitGoal, run: () => Promise<{ ok: true } | { ok: false; code: string }>, success: string) {
    if (busy) return;
    setBusy(true); setNextNotice(null); setNotice(null);
    const result = await run();
    setBusy(false);
    if (!result.ok) { setNextNotice({ goalId: goal.id, text: habits.nextGoal.failed, error: true }); return; }
    setNotice({ text: success, error: false });
    await load();
  }

  // ── Rewards ──────────────────────────────────────────────────────────────
  const [rewardName, setRewardName] = useState('');
  const [rewardCost, setRewardCost] = useState('');
  const spendRefusals = { INSUFFICIENT_BALANCE: copy.rewards.notEnough, SPEND_LIMIT_REACHED: copy.rewards.limit, ACCOUNT_FROZEN: copy.income.frozen };

  async function submitReward(event: FormEvent) {
    event.preventDefault();
    const cost = asCount(rewardCost);
    const title = rewardName.trim();
    if (!title || title.length > 60 || cost === null || cost < 1 || cost > 500) { setNotice({ text: copy.rewards.invalid, error: true }); return; }
    if (await act(() => createReward({ title, cost }, session), copy.rewards.created, { PERSONAL_REWARD_LIMIT: copy.rewards.full }, copy.rewards.failed)) {
      setRewardName(''); setRewardCost('');
    }
  }

  // ── Parents ──────────────────────────────────────────────────────────────
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function invite() {
    if (busy) return;
    setBusy(true); setNotice(null); setCopied(false);
    const result = await createParentInvite(session);
    setBusy(false);
    if (!result.ok) { setNotice({ text: result.code === 'GUARDIAN_INVITE_LIMIT' ? copy.parents.tooMany : copy.parents.failed, error: true }); return; }
    setInviteLink(inviteLinkFor(result.data.token));
    setNotice({ text: copy.parents.linkReady, error: false });
  }

  async function copyLink() {
    if (!inviteLink) return;
    if (await copyText(inviteLink)) setCopied(true);
    else setNotice({ text: copy.parents.copyFailed, error: true });
  }

  const date = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
  const pocket = { save: copy.page.save, spend: copy.page.spend, share: copy.page.share };
  const sourceLabel = { allowance: copy.income.allowance, gift: copy.income.gift, earned: copy.income.earned };
  const entryLabel = (e: WalletEntry) => ({
    self_income: e.source ? sourceLabel[e.source] : copy.history.income,
    personal_reward: copy.history.reward,
    goal_release: copy.history.goalMove,
    task_approved: copy.history.task,
    redemption: copy.history.familyReward,
    manual_adjustment: copy.history.tutorCorrection,
    goal_withdrawal: copy.history.tutorGoalMove,
    allowance: copy.history.familyAllowance,
    savings_bonus: copy.history.bonus,
    share_gift: copy.history.shared,
    share_gift_returned: copy.history.shareBack,
  })[e.reason];
  const name = (p: ParentLink) => p.displayName || copy.parents.unnamed;

  const panels: { key: Panel; label: string }[] = [
    { key: 'income', label: copy.income.open }, { key: 'goals', label: copy.goals.open }, { key: 'rewards', label: copy.rewards.open },
    { key: 'share', label: habits.share.heading }, { key: 'history', label: copy.history.open }, { key: 'parents', label: copy.parents.open },
  ];
  const balanceTotal = balances ? balances.save + balances.spend + balances.share : 0;

  return <section className="lf-rebuild lf-teen-wallet" data-teen-wallet="root" data-theme={dark ? 'dark' : 'light'} data-age-band="13-17" lang={locale}
    aria-labelledby={ids.title}>
    <header className="lf-teen-wallet-header">
      <h1 id={ids.title} data-copy-role="heading">{copy.page.title}</h1>
      <Copy role="body">{copy.page.sub}</Copy>
      <span className="lf-teen-wallet-chip" data-copy-role="data">{copy.page.simulation}</span>
    </header>

    {state === 'loading' && <LoadingState label={copy.page.loading} lines={3} />}
    {state === 'failed' && !screen && <>
      <NoticeLine notice={{ text: copy.page.failed, error: true }} />
      <div><Button onClick={() => { setState('loading'); void load(); }}>{copy.page.retry}</Button></div>
    </>}
    {state === 'failed' && screen && (failure === 'refused'
      ? <EmptyState heading={screen.copy.refusedTitle} body={screen.copy.refusedBody}
        action={<ButtonLink href={screen.learnHref} variant="accent" onClick={(event) => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault(); screen.onNavigate(screen.learnHref);
        }}>{screen.copy.refusedAction}</ButtonLink>} />
      : <ErrorState heading={screen.copy.failedTitle} body={failure === 'offline' ? screen.copy.offlineBody : screen.copy.failedBody}
        retryLabel={screen.copy.retry} retryingLabel={screen.copy.retrying} retrying={retrying} onRetry={() => { setRetrying(true); void load(); }} />)}

    {state === 'ready' && balances && access && <DashboardLayout secondary={aside} primary={<>
      <section className="lf-teen-wallet-balance" aria-label={fill(copy.page.total, { n: balanceTotal })}>
        <p className="lf-teen-wallet-total"><CoinAmount size="lg">{fill(copy.page.total, { n: balanceTotal })}</CoinAmount></p>
        <ul className="lf-teen-wallet-pockets">
          {(['save', 'spend', 'share'] as const).map((bucket) => <li key={bucket} data-pocket={bucket}>
            <span className="lf-teen-wallet-swatch" aria-hidden="true" />
            <span data-copy-role="option">{pocket[bucket]}</span>
            <CoinAmount className="lf-teen-wallet-amount">{fill(copy.page.total, { n: balances[bucket] })}</CoinAmount>
          </li>)}
        </ul>
      </section>

      <div className="lf-teen-wallet-tabs" role="group" aria-label={copy.page.sections}>
        {panels.map((p) => <Button key={p.key} variant={p.key === 'income' ? 'accent' : 'secondary'} aria-expanded={panel === p.key}
          aria-controls={ids[p.key]} onClick={() => toggle(p.key)}>{p.label}</Button>)}
      </div>

      <NoticeLine notice={notice} />

      {panel === 'income' && <Section id={ids.income} heading={copy.income.heading}>
        <form className="lf-teen-wallet-form" onSubmit={(event) => void submitIncome(event)} noValidate>
          <CountField label={copy.income.amount} value={amount} max={1000} disabled={busy} onChange={changeAmount} />
          <Choices label={copy.income.source} value={source} disabled={busy} onChange={setSource}
            options={[{ value: 'allowance', label: copy.income.allowance }, { value: 'gift', label: copy.income.gift }, { value: 'earned', label: copy.income.earned }]} />
          <fieldset className="lf-teen-wallet-split">
            <legend data-copy-role="body">{copy.income.split}</legend>
            {total !== null && total > 0 && !splitTouched && <p data-copy-role="body" className="lf-teen-wallet-muted">{copy.income.usualNote}</p>}
            {(['save', 'spend', 'share'] as const).map((bucket) => <div key={bucket} data-pocket={bucket} className="lf-teen-wallet-split-row">
              <span className="lf-teen-wallet-swatch" aria-hidden="true" />
              <CountField label={pocket[bucket]} value={split[bucket]} max={1000} disabled={busy}
                onChange={(value) => { setSplitTouched(true); setSplit((current) => ({ ...current, [bucket]: value })); }} />
            </div>)}
            {splitTouched && <div className="lf-actions"><Button disabled={busy} onClick={() => applyUsualSplit(total)}>{copy.income.useUsual}</Button></div>}
            <p data-copy-role="data" aria-live="polite">{total !== null && left === 0 && total > 0 ? copy.income.done : fill(copy.income.left, { n: Math.max(left, 0) })}</p>
          </fieldset>
          {activeGoals.length > 0 && (parts.save ?? 0) > 0 && <GoalSelect label={copy.income.toGoal} none={copy.income.noGoal} goals={activeGoals}
            value={goalId} onChange={setGoalId} disabled={busy} />}
          <div className="lf-actions"><Button type="submit" variant="success" disabled={busy}>{busy ? copy.income.saving : copy.income.submit}</Button></div>
        </form>
        <UsualSplit key={usualVersion} register="teen" copy={{ ...habits.usualSplit, save: copy.page.save, spend: copy.page.spend, share: copy.page.share, more: habits.split.more, less: habits.split.less }}
          locale={locale} dark={dark} open={usualOpen} loading={false} failed={false} value={usual} busy={busy} notice={usualNotice}
          onToggle={() => { setUsualOpen((o) => !o); setUsualNotice(null); }} onRetry={() => void load()} onSave={(next) => void saveUsual(next)} />
      </Section>}

      {panel === 'goals' && <Section id={ids.goals} heading={copy.goals.heading}>
        {goals.filter((g) => g.status !== 'archived' || g.saved > 0).length === 0 ? <Copy role="body">{copy.goals.empty}</Copy> : <ul className="lf-teen-wallet-list">
          {goals.filter((g) => g.status !== 'archived' || g.saved > 0).map((goal) => <li key={goal.id} data-goal-status={goal.status}>
            <div className="lf-teen-wallet-row">
              <span className="ugc" data-copy-role="data">{goal.title}</span>
              {goal.status !== 'active' && <span className="lf-teen-wallet-chip" data-copy-role="option">{goal.status === 'reached' ? copy.goals.reached : copy.goals.archived}</span>}
            </div>
            <GoalProgress copy={habits.goalProgress} title={goal.title} target={goal.target} progress={goal.progress} />
            {nextStepDue(goal) && <GoalNextStep copy={habits.nextGoal} goal={goal} busy={busy} notice={nextNotice && nextNotice.goalId === goal.id ? nextNotice : null}
              onSeen={async () => { const res = await markNextStepSeen(goal.id, session); return res.ok && res.data.celebrate; }}
              onStart={(input) => void nextStep(goal, () => createHabitGoal({ ...input, followsGoalId: goal.id }, session), habits.nextGoal.started)}
              onNotNow={() => void nextStep(goal, () => declineNextStep(goal.id, session), habits.nextGoal.later)} />}
            <div className="lf-actions">
              {goal.saved > 0 && <Button aria-expanded={moving === goal.id} onClick={() => { setMoving(moving === goal.id ? null : goal.id); setMoveAmount(''); setNotice(null); }}>
                {copy.goals.move}</Button>}
              {goal.status !== 'archived' && <Button disabled={busy} onClick={() => void act(() => archiveGoal(goal.id, session), copy.goals.archivedNotice, {}, copy.goals.failed)}>
                {copy.goals.archive}</Button>}
            </div>
            {moving === goal.id && <form className="lf-teen-wallet-form" onSubmit={(event) => void submitMove(event, goal)} noValidate>
              <CountField label={copy.goals.moveAmount} value={moveAmount} max={Math.min(goal.saved, 1000)} disabled={busy} onChange={setMoveAmount} />
              <Choices label={copy.goals.destination} value={moveTo} disabled={busy} onChange={setMoveTo}
                options={[{ value: 'spend', label: copy.goals.toSpend }, { value: 'save', label: copy.goals.toSave }]} />
              <div className="lf-actions"><Button type="submit" variant="accent" disabled={busy}>{copy.goals.confirmMove}</Button></div>
            </form>}
          </li>)}
        </ul>}
        <form className="lf-teen-wallet-form" onSubmit={(event) => void submitGoal(event)} noValidate>
          <NameField label={copy.goals.name} value={goalName} maxLength={80} disabled={busy} onChange={setGoalName} />
          <CountField label={copy.goals.target} value={goalTarget} max={100000} disabled={busy} onChange={setGoalTarget} />
          <div className="lf-actions"><Button type="submit" disabled={busy}>{copy.goals.create}</Button></div>
        </form>
      </Section>}

      {panel === 'rewards' && <Section id={ids.rewards} heading={copy.rewards.heading}>
        {rewards.filter((r) => r.status === 'active').length === 0 ? <Copy role="body">{copy.rewards.empty}</Copy> : <ul className="lf-teen-wallet-list">
          {rewards.filter((r) => r.status === 'active').map((reward) => <li key={reward.id}>
            <div className="lf-teen-wallet-row">
              <span className="ugc" data-copy-role="data">{reward.title}</span>
              <CoinAmount className="lf-teen-wallet-amount">{fill(copy.rewards.price, { n: reward.cost })}</CoinAmount>
            </div>
            <div className="lf-actions">
              <Button variant="accent" disabled={busy} onClick={() => void act(() => claimReward(reward.id, session), fill(copy.rewards.used, { n: reward.cost }), spendRefusals, copy.rewards.failed)}>
                {copy.rewards.use}</Button>
              <Button disabled={busy} onClick={() => void act(() => archiveReward(reward.id, session), copy.rewards.archivedNotice, {}, copy.rewards.failed)}>{copy.rewards.archive}</Button>
            </div>
          </li>)}
        </ul>}
        <form className="lf-teen-wallet-form" onSubmit={(event) => void submitReward(event)} noValidate>
          <NameField label={copy.rewards.name} value={rewardName} maxLength={60} disabled={busy} onChange={setRewardName} />
          <CountField label={copy.rewards.cost} value={rewardCost} max={500} disabled={busy} onChange={setRewardCost} />
          <div className="lf-actions"><Button type="submit" disabled={busy}>{copy.rewards.create}</Button></div>
        </form>
      </Section>}

      {panel === 'share' && <div id={ids.share}>
        <ShareGiving copy={habits.share} teenCopy={habits.shareTeen} locale={locale} dark={dark} available={balances.share} view={share}
          loading={false} failed={false} busy={busy} notice={null} selfDirected onRetry={() => void load()}
          onPledge={(destinationId, n) => void act(() => pledgeGift(destinationId, n, session), habits.share.pledged,
            { INSUFFICIENT_BALANCE: habits.share.notEnough, ACCOUNT_FROZEN: habits.share.frozen }, habits.share.failed)}
          onTakeBack={(gift) => void act(() => settleOwnGift(gift.id, 'returned', null, session), habits.share.takenBack, { ACCOUNT_FROZEN: habits.share.frozen }, habits.share.failed)}
          onAddPlace={(input) => void act(() => createOwnDestination(input, session), habits.shareTeen.added, { SHARE_DESTINATION_LIMIT: habits.shareTeen.limit }, habits.share.failed)}
          onRemovePlace={(destination) => void act(() => archiveOwnDestination(destination.id, session), habits.shareTeen.removed, {}, habits.share.failed)}
          onMarkGiven={(gift, note) => void act(() => settleOwnGift(gift.id, 'given', note, session), habits.shareTeen.givenNotice,
            { SHARE_GIFT_NOTE_REQUIRED: habits.shareTeen.noteRequired }, habits.share.failed)} />
      </div>}

      {panel === 'history' && <Section id={ids.history} heading={copy.history.heading}>
        {history.length === 0 ? <Copy role="body">{copy.history.empty}</Copy> : <ul className="lf-teen-wallet-list">
          {history.map((e) => <li key={e.id} data-ledger-reason={e.reason}>
            <div className="lf-teen-wallet-row">
              <span data-copy-role="option">{entryLabel(e)}</span>
              <span className={`lf-teen-wallet-amount${e.amount > 0 ? ' lf-teen-wallet-amount--credit' : ''}`} data-copy-role="data">
                {e.amount > 0 ? `+${e.amount}` : `−${Math.abs(e.amount)}`} {pocket[e.bucket]}
              </span>
            </div>
            {e.rewardTitle && <span className="ugc" data-copy-role="data">{e.rewardTitle}</span>}
            {e.note && <span className="ugc" data-copy-role="data">{fill(copy.history.note, { note: e.note })}</span>}
            <time className="lf-teen-wallet-muted" data-copy-role="data" dateTime={e.createdAt}>{date.format(new Date(e.createdAt))}</time>
          </li>)}
        </ul>}
      </Section>}

      {panel === 'parents' && <Section id={ids.parents} heading={copy.parents.heading}>
        {access.familyChild ? <>
          <Copy role="body">{copy.parents.tasksOn}</Copy>
          <div className="lf-actions"><ButtonLink href={tasksHref}
            onClick={(event) => { event.preventDefault(); onOpenTasks(); }}>{copy.parents.openTasks}</ButtonLink></div>
        </> : <>
          <Copy role="body">{copy.parents.tasksLocked}</Copy>
          <Copy role="body">{copy.parents.optional}</Copy>
        </>}
        {parents.length > 0 && <ul className="lf-teen-wallet-list">
          {parents.map((p) => <li key={p.linkId} data-link-status={p.status}>
            {p.status === 'pending' && p.awaitingMe ? <>
              <span className="ugc" data-copy-role="body">{fill(copy.parents.waiting, { name: name(p) })}</span>
              <div className="lf-actions">
                <Button variant="success" disabled={busy} onClick={() => void act(() => decideParent(p.linkId, 'confirm', session), fill(copy.parents.confirmed, { name: name(p) }), {}, copy.parents.failed)
                  .then((confirmed) => { if (confirmed) onAccessChanged?.(); })}>
                  {copy.parents.confirm}</Button>
                <Button disabled={busy} onClick={() => void act(() => decideParent(p.linkId, 'reject', session), copy.parents.rejectedNotice, {}, copy.parents.failed)}>
                  {copy.parents.reject}</Button>
              </div>
            </> : <span className="ugc" data-copy-role="data">{fill(p.status === 'verified' ? copy.parents.verified : p.status === 'rejected' ? copy.parents.rejected
              : p.status === 'revoked' ? copy.parents.revoked : copy.parents.pendingOther, { name: name(p) })}</span>}
          </li>)}
        </ul>}
        {inviteLink === null ? <div className="lf-actions"><Button variant="accent" disabled={busy} onClick={() => void invite()}>{busy ? copy.parents.inviting : copy.parents.invite}</Button></div>
          : <div className="lf-teen-wallet-invite">
            <span data-copy-role="body">{copy.parents.linkLabel}</span>
            <span className="lf-teen-wallet-link ugc" data-copy-role="data">{inviteLink}</span>
            <div className="lf-actions"><Button onClick={() => void copyLink()}>{copied ? copy.parents.copied : copy.parents.copy}</Button></div>
          </div>}
      </Section>}
    </>} />}
  </section>;
}

/** Which goal the saved coins go to: the shared SelectField; a goal's title is the teen's own data. */
function GoalSelect({ label, none, goals, value, onChange, disabled }: {
  label: string; none: string; goals: HabitGoal[]; value: string; onChange: (value: string) => void; disabled?: boolean;
}) {
  const options = [{ value: '', label: none }, ...goals.map((goal) => ({ value: goal.id, label: goal.title, role: 'data' as const }))];
  return <SelectField label={label} options={options} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />;
}
