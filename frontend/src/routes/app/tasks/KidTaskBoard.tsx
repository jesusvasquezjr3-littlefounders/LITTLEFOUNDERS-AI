import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Button, Card, ConfirmButton, Dropdown, Field, Icon, LoadingOverlay, ProgressBar, SectionHeading, StatCard } from '@/components/ui';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';
import { EvidenceThumbnail, EvidenceUploadButton } from './EvidencePhoto';
import { GOAL_ICONS, GOAL_ICON_GLYPH, type GoalIcon, type WalletBalances, type WireCatalogItem, type WireGoal, type WireLedgerEntry, type WireRedemption, type WireTask } from './types';

/*
 * The kid's half of FAMILY_HUB.md's loop: complete a task (with an optional
 * photo as proof), sort the reward across Save/Spend/Share once a grown-up
 * approves it, watch goals fill up, and redeem what a grown-up has offered.
 *
 * Layout: a real desktop dashboard, not a stretched single column
 * (/AGENTS.md §1.11 — the violation the previous cut shipped with). The
 * wallet is always three columns (a fixed, named set — Save/Spend/Share is
 * never "whatever fits"); below it a main column (what to DO) sits beside a
 * secondary column (what you're WORKING TOWARD), collapsing to one stacked
 * column on mobile in that same reading order.
 */

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; code: string }
  | {
      status: 'ready';
      tasks: WireTask[];
      balances: WalletBalances;
      goals: WireGoal[];
      catalog: WireCatalogItem[];
      redemptions: WireRedemption[];
      ledger: WireLedgerEntry[];
    };

export function KidTaskBoard() {
  const { t, i18n } = useTranslation();
  const { getToken } = useAuth();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [token, setToken] = useState<string | null>(null);
  const [allocatingTaskId, setAllocatingTaskId] = useState<string | null>(null);
  const [busyTask, setBusyTask] = useState<string | null>(null);
  const [busyRedemption, setBusyRedemption] = useState<string | null>(null);
  const [evidenceVersion, setEvidenceVersion] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [liveMessage, setLiveMessage] = useState('');
  const [streak, setStreak] = useState({ currentStreak: 0, longestStreak: 0 });
  const liveRegionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setState((prev) => (prev.status === 'error' ? { status: 'loading' } : prev));
    void (async () => {
      const tok = await getToken();
      if (!tok || cancelled) return;
      setToken(tok);
      const [tasksRes, walletRes, goalsRes, catalogRes, redemptionsRes, ledgerRes] = await Promise.all([
        api<{ tasks: WireTask[] }>('/tasks/mine', { token: tok }),
        api<{ balances: WalletBalances }>('/tasks/wallet', { token: tok }),
        api<{ goals: WireGoal[] }>('/tasks/goals', { token: tok }),
        api<{ items: WireCatalogItem[] }>('/tasks/catalog/available', { token: tok }),
        api<{ redemptions: WireRedemption[] }>('/tasks/redemptions/mine', { token: tok }),
        api<{ entries: WireLedgerEntry[] }>('/tasks/wallet/ledger', { token: tok }),
      ]);
      if (cancelled) return;
      // Direct property accesses (not a merged variable) so TypeScript can
      // narrow each result's `.data` to non-null below.
      if (tasksRes.error || walletRes.error || goalsRes.error || catalogRes.error || redemptionsRes.error || ledgerRes.error) {
        const code = (tasksRes.error ?? walletRes.error ?? goalsRes.error ?? catalogRes.error ?? redemptionsRes.error ?? ledgerRes.error)?.code ?? 'INTERNAL';
        setState({ status: 'error', code });
        return;
      }
      setState({
        status: 'ready',
        tasks: tasksRes.data.tasks,
        balances: walletRes.data.balances,
        goals: goalsRes.data.goals,
        catalog: catalogRes.data.items,
        redemptions: redemptionsRes.data.redemptions,
        ledger: ledgerRes.data.entries,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, reloadKey]);

  async function refreshStreak() {
    if (!token) return;
    const res = await api<{ currentStreak: number; longestStreak: number }>('/tasks/streak', { token });
    if (res.data) setStreak(res.data);
  }

  useEffect(() => {
    void refreshStreak();
  }, [token]);

  function announce(message: string) {
    setLiveMessage(message);
    // Focus moves to the live region itself — the control that triggered the
    // change (a "Mark done" button, an "Archive" link) is about to leave the
    // DOM as the row re-renders, so focus would otherwise silently fall back
    // to <body> with nothing announced to a screen reader (§1.14-style gap:
    // the UI updated, but nothing said so).
    liveRegionRef.current?.focus();
  }

  async function refreshWallet() {
    if (!token) return;
    const res = await api<{ balances: WalletBalances }>('/tasks/wallet', { token });
    if (res.data) setState((prev) => (prev.status === 'ready' ? { ...prev, balances: res.data.balances } : prev));
  }

  async function onComplete(taskId: string, title: string) {
    if (!token || busyTask) return;
    setBusyTask(taskId);
    // The kid's LOCAL calendar day anchors the streak (same construction as
    // LessonRoute.tsx's local_date — guaranteed YYYY-MM-DD, unlike
    // toLocaleDateString('sv') on some browsers).
    const localDate = (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();
    const res = await api<{ task: WireTask }>(`/tasks/${taskId}/complete`, { method: 'POST', token, body: { localDate } });
    setBusyTask(null);
    if (res.data) {
      setState((prev) => (prev.status === 'ready' ? { ...prev, tasks: prev.tasks.map((tt) => (tt.id === taskId ? res.data.task : tt)) } : prev));
      announce(t('tasks.kid.completedAnnounce', { title }));
      void refreshStreak();
    }
  }

  function onEvidenceUploaded(taskId: string) {
    setEvidenceVersion((v) => v + 1);
    setState((prev) => (prev.status === 'ready' ? { ...prev, tasks: prev.tasks.map((tt) => (tt.id === taskId ? { ...tt, hasEvidence: true } : tt)) } : prev));
  }

  async function onAllocated(task: WireTask) {
    setAllocatingTaskId(null);
    setState((prev) => (prev.status === 'ready' ? { ...prev, tasks: prev.tasks.map((tt) => (tt.id === task.id ? { ...tt, allocated: true } : tt)) } : prev));
    await refreshWallet();
    if (!token) return;
    const [goalsRes, ledgerRes] = await Promise.all([
      api<{ goals: WireGoal[] }>('/tasks/goals', { token }),
      api<{ entries: WireLedgerEntry[] }>('/tasks/wallet/ledger', { token }),
    ]);
    if (goalsRes.data) setState((prev) => (prev.status === 'ready' ? { ...prev, goals: goalsRes.data.goals } : prev));
    if (ledgerRes.data) setState((prev) => (prev.status === 'ready' ? { ...prev, ledger: ledgerRes.data.entries } : prev));
  }

  function onCreateGoal(goal: WireGoal) {
    setState((prev) => (prev.status === 'ready' ? { ...prev, goals: [goal, ...prev.goals] } : prev));
  }

  async function onArchiveGoal(goalId: string, title: string) {
    if (!token) return;
    const res = await api<{ goal: WireGoal }>(`/tasks/goals/${goalId}`, { method: 'PATCH', token });
    if (res.data) {
      setState((prev) => (prev.status === 'ready' ? { ...prev, goals: prev.goals.filter((g) => g.id !== goalId) } : prev));
      announce(t('tasks.kid.goalArchivedAnnounce', { title }));
    }
  }

  async function onRedeem(catalogId: string) {
    if (!token || busyRedemption) return;
    setBusyRedemption(catalogId);
    const res = await api<{ redemption: WireRedemption }>('/tasks/redemptions', { method: 'POST', token, body: { catalogId } });
    setBusyRedemption(null);
    if (res.data) setState((prev) => (prev.status === 'ready' ? { ...prev, redemptions: [res.data.redemption, ...prev.redemptions] } : prev));
  }

  if (state.status === 'loading') return <LoadingOverlay label={t('tasks.loading')} />;
  if (state.status === 'error') return <ErrorBanner code={state.code} onRetry={() => setReloadKey((k) => k + 1)} />;

  const activeGoals = state.goals.filter((g) => g.status !== 'archived');
  const openTasks = state.tasks.filter((tt) => tt.status === 'open');
  const doneTasks = state.tasks.filter((tt) => tt.status === 'done');
  const toAllocate = state.tasks.filter((tt) => tt.status === 'approved' && !tt.allocated);
  const todo = [...openTasks, ...doneTasks];

  // A receipt list needs names, not ids — resolved from state already
  // loaded for the tasks/rewards sections above, not a second fetch.
  const taskTitleById = new Map(state.tasks.map((tt) => [tt.id, tt.title]));
  const catalogTitleByRedemptionId = new Map(
    state.redemptions.map((r) => [r.id, state.catalog.find((c) => c.id === r.catalogId)?.title]),
  );
  const recentLedger = state.ledger.slice(0, 12);
  const dateFormatter = new Intl.DateTimeFormat(i18n.resolvedLanguage, { month: 'short', day: 'numeric' });

  function ledgerLabel(entry: WireLedgerEntry): string {
    if (entry.reason === 'task_approved') {
      const title = entry.taskId ? taskTitleById.get(entry.taskId) : undefined;
      return title ? t('tasks.kid.activityEarned', { title }) : t('tasks.kid.activityEarnedUntitled');
    }
    if (entry.reason === 'redemption') {
      const title = entry.redemptionId ? catalogTitleByRedemptionId.get(entry.redemptionId) : undefined;
      return title ? t('tasks.kid.activitySpent', { title }) : t('tasks.kid.activitySpentUntitled');
    }
    return t('tasks.kid.activityAdjustment');
  }

  const BUCKET_DOT: Record<WireLedgerEntry['bucket'], string> = { save: 'bg-success', spend: 'bg-primary', share: 'bg-delight' };

  return (
    <div className="flex flex-col gap-8 pb-8">
      {/* Focus lands here after an action removes its own trigger from the
          DOM (Mark done, Archive) — announced to a screen reader and, being
          focusable, keeps a keyboard user's position sane instead of losing
          it to <body>. */}
      <div ref={liveRegionRef} tabIndex={-1} role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </div>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="lf-display-lg text-content">{t('tasks.title')}</h1>
          <p className="lf-body text-content-muted">{t('tasks.kid.subtitle')}</p>
        </div>
        {streak.currentStreak > 0 && (
          <span className="lf-caption flex items-center gap-1.5 rounded-full bg-warning-soft px-3 py-1.5 font-bold text-warning-strong">
            <Icon name="local_fire_department" fill className="text-[16px]" aria-hidden />
            {t('tasks.kid.streakLabel', { count: streak.currentStreak })}
          </span>
        )}
      </header>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard icon={<Icon name="savings" />} value={String(state.balances.save)} label={t('tasks.kid.save')} tone="success" />
        <StatCard icon={<Icon name="shopping_bag" />} value={String(state.balances.spend)} label={t('tasks.kid.spend')} tone="primary" />
        <StatCard icon={<Icon name="volunteer_activism" />} value={String(state.balances.share)} label={t('tasks.kid.share')} tone="delight" />
      </div>
      <Link to="/banking" className="-mt-4 inline-flex items-center gap-1 self-start lf-caption font-bold text-primary">
        {t('tasks.kid.bankingLink')}
        <Icon name="arrow_forward" className="text-[16px]" aria-hidden />
      </Link>

      {toAllocate.length > 0 && (
        <div className="flex flex-col gap-3">
          {toAllocate.map((task) =>
            allocatingTaskId === task.id ? (
              <AllocateCard key={task.id} task={task} goals={activeGoals} token={token} onDone={() => void onAllocated(task)} onCancel={() => setAllocatingTaskId(null)} />
            ) : (
              <Card key={task.id} className="flex items-center gap-3 border-2 border-accent/60 bg-accent-soft p-4">
                <span className="lf-tile h-9 w-9 shrink-0 text-accent">
                  <Icon name="celebration" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="lf-label block truncate text-content">{task.title}</span>
                  <span className="lf-caption block text-content-faint">{t('tasks.kid.allocateTitle', { count: task.rewardCoins })}</span>
                </span>
                <Button type="button" variant="primary" className="min-h-9 shrink-0 px-3 lf-caption" onClick={() => setAllocatingTaskId(task.id)}>
                  {t('tasks.kid.allocateCta')}
                </Button>
              </Card>
            ),
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-labelledby="kid-tasks-heading">
          <SectionHeading id="kid-tasks-heading" icon="checklist" tone="accent" meta={todo.length > 0 ? String(todo.length) : undefined}>
            {t('tasks.kid.tasksHeading')}
          </SectionHeading>
          {todo.length === 0 && toAllocate.length === 0 ? (
            <Card className="flex flex-col items-center gap-2 p-8 text-center">
              <Icon name="checklist" className="text-[40px] text-content-faint" aria-hidden />
              <h2 className="lf-title text-content">{t('tasks.kid.emptyTitle')}</h2>
              <p className="lf-body max-w-md text-content-muted">{t('tasks.kid.emptyBody')}</p>
            </Card>
          ) : (
            <ul className="flex flex-col gap-2">
              {todo.map((task) => (
                <li key={task.id} className="flex flex-col gap-2.5 rounded-lg border border-outline/70 bg-surface px-4 py-3 shadow-glass-sm sm:flex-row sm:items-center sm:gap-3">
                  <Icon name={task.status === 'done' ? 'pending_actions' : 'radio_button_unchecked'} className="hidden shrink-0 text-[20px] text-content-faint sm:block" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="lf-label flex flex-wrap items-center gap-x-2 truncate text-content">
                      {task.title}
                      {task.recurrence === 'weekly' && (
                        <span className="lf-caption rounded-full bg-surface-sunken px-2 py-0.5 font-bold text-content-faint">{t('tasks.recurrenceBadgeWeekly')}</span>
                      )}
                    </span>
                    <span className="lf-caption block text-content-faint">
                      {t(`tasks.kid.${task.status === 'done' ? 'statusDone' : 'statusOpen'}`)} · {t('tasks.parent.rewardLabel', { count: task.rewardCoins })}
                      {task.requiresEvidence && !task.hasEvidence ? ` · ${t('tasks.kid.requiresEvidenceHint')}` : ''}
                    </span>
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    {task.hasEvidence && <EvidenceThumbnail key={evidenceVersion} taskId={task.id} token={token} alt={t('tasks.kid.evidenceAlt', { title: task.title })} />}
                    <EvidenceUploadButton taskId={task.id} token={token} replace={task.hasEvidence} onUploaded={() => onEvidenceUploaded(task.id)} />
                    {task.status === 'open' && (
                      <Button type="button" variant="success" className="min-h-9 px-3 lf-caption" disabled={busyTask === task.id} onClick={() => void onComplete(task.id, task.title)}>
                        {busyTask === task.id ? t('tasks.kid.completing') : t('tasks.kid.complete')}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-6">
          <section aria-labelledby="kid-goals-heading">
            <SectionHeading id="kid-goals-heading" icon="savings" tone="success">
              {t('tasks.kid.goalsTitle')}
            </SectionHeading>
            {activeGoals.length === 0 ? (
              <Card className="flex flex-col items-center gap-2 p-6 text-center">
                <Icon name="savings" className="text-[28px] text-content-faint" aria-hidden />
                <p className="lf-caption text-content-muted">{t('tasks.kid.goalEmptyBody')}</p>
              </Card>
            ) : (
              <ul className="flex flex-col gap-2">
                {activeGoals.map((goal) => (
                  <li
                    key={goal.id}
                    className={`flex flex-col gap-2 rounded-lg border px-4 py-3 shadow-glass-sm ${goal.status === 'reached' ? 'border-2 border-success/60 bg-success-soft' : 'border-outline/70 bg-surface'}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon name={goal.status === 'reached' ? 'emoji_events' : GOAL_ICON_GLYPH[goal.icon]} className="shrink-0 text-[18px] text-success" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="lf-label block truncate text-content">{goal.title}</span>
                        <span className="lf-caption block text-content-faint">{goal.status === 'reached' ? t('tasks.kid.goalReached') : `${goal.saved} / ${goal.target}`}</span>
                      </span>
                      <ConfirmButton
                        variant="secondary"
                        className="min-h-8 shrink-0 px-2.5 lf-caption"
                        confirmQuestion={t('tasks.kid.goalArchiveConfirmQuestion')}
                        onConfirm={() => void onArchiveGoal(goal.id, goal.title)}
                      >
                        {t('tasks.kid.goalArchive')}
                      </ConfirmButton>
                    </div>
                    <ProgressBar value={(goal.saved / goal.target) * 100} label={goal.title} tone={goal.status === 'reached' ? 'accent' : 'primary'} />
                  </li>
                ))}
              </ul>
            )}
            <AddGoalCard token={token} onCreated={onCreateGoal} />
          </section>

          <section aria-labelledby="kid-rewards-heading">
            <SectionHeading id="kid-rewards-heading" icon="redeem" tone="delight">
              {t('tasks.kid.catalogTitle')}
            </SectionHeading>
            {state.catalog.length === 0 ? (
              <p className="lf-caption text-content-muted">{t('tasks.kid.catalogEmpty')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {state.catalog.map((item) => {
                  const requested = state.redemptions.some((r) => r.catalogId === item.id && r.status === 'requested');
                  const affordable = state.balances.spend >= item.cost;
                  return (
                    <li key={item.id} className="flex items-center gap-2.5 rounded-lg border border-outline/70 bg-surface px-4 py-3 shadow-glass-sm">
                      <Icon name="redeem" className="shrink-0 text-[18px] text-delight" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="lf-label block truncate text-content">{item.title}</span>
                        <span className="lf-caption block text-content-faint">
                          {t('tasks.parent.rewardLabel', { count: item.cost })}
                          {!affordable ? ` · ${t('tasks.kid.catalogNotEnough')}` : ''}
                        </span>
                      </span>
                      <Button
                        type="button"
                        variant="primary"
                        className="min-h-9 shrink-0 px-3 lf-caption"
                        disabled={!affordable || requested || busyRedemption === item.id}
                        onClick={() => void onRedeem(item.id)}
                      >
                        {busyRedemption === item.id ? t('tasks.kid.catalogRequesting') : requested ? t('tasks.parent.redemptionStatusRequested') : t('tasks.kid.catalogRequestCta')}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="kid-activity-heading">
            <SectionHeading id="kid-activity-heading" icon="receipt_long" tone="muted">
              {t('tasks.kid.activityTitle')}
            </SectionHeading>
            {recentLedger.length === 0 ? (
              <p className="lf-caption text-content-muted">{t('tasks.kid.activityEmpty')}</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {recentLedger.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-2.5 rounded-lg border border-outline/50 bg-surface px-3.5 py-2.5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${BUCKET_DOT[entry.bucket]}`} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="lf-caption block truncate text-content">{ledgerLabel(entry)}</span>
                      <span className="lf-caption block text-content-faint">{dateFormatter.format(new Date(entry.createdAt))}</span>
                    </span>
                    <span className={`lf-label lf-number shrink-0 tabular-nums ${entry.amount >= 0 ? 'text-success' : 'text-content-muted'}`}>
                      {entry.amount >= 0 ? '+' : ''}
                      {entry.amount}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function AllocateCard({
  task,
  goals,
  token,
  onDone,
  onCancel,
}: {
  task: WireTask;
  goals: WireGoal[];
  token: string | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [save, setSave] = useState(task.rewardCoins);
  const [spend, setSpend] = useState(0);
  const [share, setShare] = useState(0);
  const [goalId, setGoalId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const total = save + spend + share;
  const remaining = task.rewardCoins - total;
  const ready = total === task.rewardCoins && save >= 0 && spend >= 0 && share >= 0;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ready || submitting || !token) return;
    setSubmitting(true);
    setErrorCode(null);
    const res = await api<{ allocated: boolean }>(`/tasks/${task.id}/allocate`, {
      method: 'POST',
      token,
      body: { save, spend, share, goalId: save > 0 && goalId ? goalId : null },
    });
    setSubmitting(false);
    if (res.error) {
      setErrorCode(res.error.code);
      return;
    }
    onDone();
  }

  return (
    <Card className="flex flex-col gap-4 border-2 border-accent/60 p-5">
      <div>
        <h2 className="lf-title text-content">{t('tasks.kid.allocateTitle', { count: task.rewardCoins })}</h2>
        <p className="lf-body text-content-muted">{t('tasks.kid.allocateBody')}</p>
      </div>
      <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label={t('tasks.kid.save')} type="number" min={0} max={task.rewardCoins} value={save} onChange={(e) => setSave(Number(e.target.value))} />
          <Field label={t('tasks.kid.spend')} type="number" min={0} max={task.rewardCoins} value={spend} onChange={(e) => setSpend(Number(e.target.value))} />
          <Field label={t('tasks.kid.share')} type="number" min={0} max={task.rewardCoins} value={share} onChange={(e) => setShare(Number(e.target.value))} />
        </div>
        {save > 0 && goals.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="lf-label text-content">{t('tasks.kid.allocateGoal')}</span>
            <Dropdown
              value={goalId}
              options={[{ value: '', label: t('tasks.kid.allocateNoGoal') }, ...goals.map((g) => ({ value: g.id, label: g.title }))]}
              onChange={setGoalId}
              ariaLabel={t('tasks.kid.allocateGoal')}
            />
          </div>
        )}
        <p className={`lf-caption ${remaining === 0 ? 'text-success' : 'text-content-muted'}`}>
          {remaining > 0 ? t('tasks.kid.allocateRemaining', { count: remaining }) : remaining < 0 ? t('tasks.kid.allocateTooMuch') : null}
        </p>
        {errorCode && <ErrorBanner code={errorCode} />}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t('tasks.parent.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={!ready || submitting}>
            {submitting ? t('tasks.kid.allocateSubmitting') : t('tasks.kid.allocateSubmit')}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function AddGoalCard({ token, onCreated }: { token: string | null; onCreated: (goal: WireGoal) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState(50);
  const [icon, setIcon] = useState<GoalIcon>('star');
  const [submitting, setSubmitting] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const ready = title.trim().length > 0 && target >= 1;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ready || submitting || !token) return;
    setSubmitting(true);
    setErrorCode(null);
    const res = await api<{ goal: WireGoal }>('/tasks/goals', { method: 'POST', token, body: { title: title.trim(), target, icon } });
    setSubmitting(false);
    if (res.error) {
      setErrorCode(res.error.code);
      return;
    }
    onCreated(res.data.goal);
    setTitle('');
    setTarget(50);
    setOpen(false);
  }

  if (!open) {
    return (
      <Button type="button" variant="secondary" className="mt-2 min-h-9 px-3 lf-caption" onClick={() => setOpen(true)}>
        <Icon name="add" className="mr-1.5 text-[16px]" aria-hidden />
        {t('tasks.kid.goalsAddCta')}
      </Button>
    );
  }

  return (
    <Card className="mt-2 flex flex-col gap-4 p-5">
      <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
        <Field label={t('tasks.kid.goalTitle')} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
        <Field label={t('tasks.kid.goalTarget')} type="number" min={1} max={100000} value={target} onChange={(e) => setTarget(Number(e.target.value))} />
        <div className="flex flex-col gap-1.5">
          <span className="lf-label text-content">{t('tasks.kid.goalIcon')}</span>
          <Dropdown value={icon} options={GOAL_ICONS.map((i) => ({ value: i, label: t(`tasks.goalIcons.${i}`) }))} onChange={(v) => setIcon(v as GoalIcon)} ariaLabel={t('tasks.kid.goalIcon')} />
        </div>
        {errorCode && <ErrorBanner code={errorCode} />}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            {t('tasks.parent.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={!ready || submitting}>
            {submitting ? t('tasks.kid.goalSubmitting') : t('tasks.kid.goalSubmit')}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default KidTaskBoard;
