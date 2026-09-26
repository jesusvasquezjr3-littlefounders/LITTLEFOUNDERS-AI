import { useEffect, useRef, useState } from 'react';
import { trackInsight } from '@/lib/insights';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Card, Icon, LoadingOverlay, SectionHeading, StatCard } from '@/components/ui';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';
import { EvidenceThumbnail, EvidenceUploadButton } from './EvidencePhoto';
import { type WalletBalances, type WireCatalogItem, type WireLedgerEntry, type WireRedemption, type WireTask } from './types';
import { WalletActivityPanel } from './WalletActivityPanel';
import { ChoreStreakPanel } from './ChoreStreakPanel';
import { AllocationPanel } from './AllocationPanel';
import { SavingsGoalsPanel } from './SavingsGoalsPanel';
import { ShareGivingPanel } from './ShareGivingPanel';
import { UsualSplitPanel } from './UsualSplitPanel';
import { ChoreDonePanel, DecisionNotesPanel, MyLevelPanel, RewardAskPanel } from './FamilyVoicePanels';
import { choreKindLine } from '../family/familyMoneyCopy';
import { isStreakMilestone, type StreakMilestone } from '@/rebuild/family/familyMoneyApi';

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
      catalog: WireCatalogItem[];
      redemptions: WireRedemption[];
      ledger: WireLedgerEntry[];
    };

export function KidTaskBoard() {
  const { t, i18n } = useTranslation();
  const { getToken } = useAuth();
  // H.3: `task_view` was catalogued but emitted nowhere. Fired once per
  // board mount, consent-gated by the beacon like every other event.
  const taskViewEmitted = useRef(false);
  useEffect(() => {
    if (taskViewEmitted.current) return;
    taskViewEmitted.current = true;
    trackInsight('task_view', { routeClass: 'tasks' });
  }, []);
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [token, setToken] = useState<string | null>(null);
  // S07.4: goals, the Share destination and the split chooser are rebuilt
  // panels; a landed payout bumps them so a reached goal celebrates at once.
  const [moneyVersion, setMoneyVersion] = useState(0);
  // S07.5 (D.17, D.18): the child's level and decision notes follow every
  // chore marked done and every reward asked for.
  const [voiceVersion, setVoiceVersion] = useState(0);
  const [evidenceVersion, setEvidenceVersion] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [liveMessage, setLiveMessage] = useState('');
  // S07.3 (D.2): the lapse-tolerant streak lives in ChoreStreakPanel; a
  // completion bumps it and passes Core's milestone (7/30/100 only).
  const [streakVersion, setStreakVersion] = useState(0);
  const [milestone, setMilestone] = useState<StreakMilestone | null>(null);
  const liveRegionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setState((prev) => (prev.status === 'error' ? { status: 'loading' } : prev));
    void (async () => {
      const tok = await getToken();
      if (!tok || cancelled) return;
      setToken(tok);
      const [tasksRes, walletRes, catalogRes, redemptionsRes, ledgerRes] = await Promise.all([
        api<{ tasks: WireTask[] }>('/tasks/mine', { token: tok }),
        api<{ balances: WalletBalances }>('/tasks/wallet', { token: tok }),
        api<{ items: WireCatalogItem[] }>('/tasks/catalog/available', { token: tok }),
        api<{ redemptions: WireRedemption[] }>('/tasks/redemptions/mine', { token: tok }),
        api<{ entries: WireLedgerEntry[] }>('/tasks/wallet/ledger', { token: tok }),
      ]);
      if (cancelled) return;
      // Direct property accesses (not a merged variable) so TypeScript can
      // narrow each result's `.data` to non-null below.
      if (tasksRes.error || walletRes.error || catalogRes.error || redemptionsRes.error || ledgerRes.error) {
        const code = (tasksRes.error ?? walletRes.error ?? catalogRes.error ?? redemptionsRes.error ?? ledgerRes.error)?.code ?? 'INTERNAL';
        setState({ status: 'error', code });
        return;
      }
      setState({
        status: 'ready',
        tasks: tasksRes.data.tasks,
        balances: walletRes.data.balances,
        catalog: catalogRes.data.items,
        redemptions: redemptionsRes.data.redemptions,
        ledger: ledgerRes.data.entries,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, reloadKey]);

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

  /** S07.5: the rebuilt ChoreDone marked it (with the child's note); the level may have counted it at once. */
  function onMarked(task: WireTask, answer: { task: Record<string, unknown>; selfLogged: boolean; milestone?: unknown }) {
    const status = answer.selfLogged ? 'approved' : 'done';
    setState((prev) => (prev.status === 'ready' ? { ...prev, tasks: prev.tasks.map((tt) => (tt.id === task.id ? { ...tt, status } : tt)) } : prev));
    announce(t('tasks.kid.completedAnnounce', { title: task.title }));
    setMilestone(isStreakMilestone(answer.milestone) ? answer.milestone : null);
    setStreakVersion((v) => v + 1);
    setVoiceVersion((v) => v + 1);
  }

  function onEvidenceUploaded(taskId: string) {
    setEvidenceVersion((v) => v + 1);
    setState((prev) => (prev.status === 'ready' ? { ...prev, tasks: prev.tasks.map((tt) => (tt.id === taskId ? { ...tt, hasEvidence: true } : tt)) } : prev));
    // S07.5 (D.17): a photo can let the child's level count the chore.
    setReloadKey((k) => k + 1);
    setVoiceVersion((v) => v + 1);
  }

  async function onAllocated(task: WireTask) {
    setState((prev) => (prev.status === 'ready' ? { ...prev, tasks: prev.tasks.map((tt) => (tt.id === task.id ? { ...tt, allocated: true } : tt)) } : prev));
    setMoneyVersion((v) => v + 1);
    await refreshMoney();
  }

  /** Pockets and history after a payout or a Share gift. */
  async function refreshMoney() {
    await refreshWallet();
    if (!token) return;
    const ledgerRes = await api<{ entries: WireLedgerEntry[] }>('/tasks/wallet/ledger', { token });
    if (ledgerRes.data) setState((prev) => (prev.status === 'ready' ? { ...prev, ledger: ledgerRes.data.entries } : prev));
  }

  /** S07.5: the rebuilt RewardAsk sent the child's reason; the level may have approved it at once. */
  function onAsked(answer: { redemption: Record<string, unknown>; preapproved: boolean }) {
    setVoiceVersion((v) => v + 1);
    if (answer.preapproved) void refreshMoney();
    setReloadKey((k) => k + 1);
  }

  if (state.status === 'loading') return <LoadingOverlay label={t('tasks.loading')} />;
  if (state.status === 'error') return <ErrorBanner code={state.code} onRetry={() => setReloadKey((k) => k + 1)} />;

  const openTasks = state.tasks.filter((tt) => tt.status === 'open');
  const doneTasks = state.tasks.filter((tt) => tt.status === 'done');
  // S07.3 (D.10): a zero-coin family contribution has nothing to split.
  const toAllocate = state.tasks.filter((tt) => tt.status === 'approved' && !tt.allocated && tt.rewardCoins > 0);
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
    // S07.4 (D.14): coins directed to a Share destination are never an "adjustment".
    if (entry.reason === 'share_gift') return t('tasks.kid.activityShared');
    if (entry.reason === 'share_gift_returned') return t('tasks.kid.activityShareReturned');
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
      </header>

      {/* S07.5 (D.17): the child's own level, and (D.18) the notes on their decisions. */}
      <MyLevelPanel token={token} refreshKey={voiceVersion} />
      <DecisionNotesPanel token={token} refreshKey={voiceVersion} />

      {/* S07.3 (D.2): the lapse-tolerant chore streak (two free rest days a week). */}
      <ChoreStreakPanel token={token} refreshKey={streakVersion} milestone={milestone} />

      {/* S07.1 (D.5 / OD-21): the child's own history, with every Tutor reason. */}
      <WalletActivityPanel token={token} />

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard icon={<Icon name="savings" />} value={String(state.balances.save)} label={t('tasks.kid.save')} tone="success" />
        <StatCard icon={<Icon name="shopping_bag" />} value={String(state.balances.spend)} label={t('tasks.kid.spend')} tone="primary" />
        <StatCard icon={<Icon name="volunteer_activism" />} value={String(state.balances.share)} label={t('tasks.kid.share')} tone="delight" />
      </div>
      <Link to="/banking" className="-mt-4 inline-flex items-center gap-1 self-start lf-caption font-bold text-primary">
        {t('tasks.kid.bankingLink')}
        <Icon name="arrow_forward" className="text-[16px]" aria-hidden />
      </Link>

      {/* S07.4 (D.13): each payout arrives pre-split by the child's own usual split; keeping it is one tap. */}
      {toAllocate.length > 0 && (
        <div className="flex flex-col gap-3">
          {toAllocate.map((task) => (
            <AllocationPanel key={task.id} token={token} kind="task" id={task.id} amount={task.rewardCoins} title={task.title} onDone={() => void onAllocated(task)} />
          ))}
        </div>
      )}
      <UsualSplitPanel token={token} />

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
                <li key={task.id} className="flex flex-col gap-2.5 rounded-lg border border-outline/70 bg-surface px-4 py-3 shadow-glass-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                  <Icon name={task.status === 'done' ? 'pending_actions' : 'radio_button_unchecked'} className="hidden shrink-0 text-[20px] text-content-faint sm:block" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="lf-label flex flex-wrap items-center gap-x-2 truncate text-content">
                      {task.title}
                      {task.recurrence === 'weekly' && (
                        <span className="lf-caption rounded-full bg-surface-sunken px-2 py-0.5 font-bold text-content-faint">{t('tasks.recurrenceBadgeWeekly')}</span>
                      )}
                    </span>
                    <span className="lf-caption block text-content-faint">
                      {t(`tasks.kid.${task.status === 'done' ? 'statusDone' : 'statusOpen'}`)} · {choreKindLine(i18n.resolvedLanguage, task.kind, task.rewardCoins)}
                      {task.requiresEvidence && !task.hasEvidence ? ` · ${t('tasks.kid.requiresEvidenceHint')}` : ''}
                    </span>
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    {task.hasEvidence && <EvidenceThumbnail key={evidenceVersion} taskId={task.id} token={token} alt={t('tasks.kid.evidenceAlt', { title: task.title })} />}
                    <EvidenceUploadButton taskId={task.id} token={token} replace={task.hasEvidence} onUploaded={() => onEvidenceUploaded(task.id)} />
                  </div>
                  {/* S07.5 (D.17, D.18): mark it done with an optional note; the level may count it at once. */}
                  {task.status === 'open' && (
                    <div className="w-full basis-full">
                      <ChoreDonePanel token={token} taskId={task.id} title={task.title} onMarked={(answer) => onMarked(task, answer)} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-6">
          {/* S07.4 (D.15, D.16): goals with provenance and the next-goal prompt. */}
          <SavingsGoalsPanel token={token} refreshKey={moneyVersion} />

          {/* S07.4 (D.14): the Share pocket's real destination. */}
          <ShareGivingPanel token={token} refreshKey={moneyVersion} onChanged={() => void refreshMoney()} />

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
                    <li key={item.id} className="flex flex-wrap items-center gap-2.5 rounded-lg border border-outline/70 bg-surface px-4 py-3 shadow-glass-sm">
                      <Icon name="redeem" className="shrink-0 text-[18px] text-delight" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="lf-label block truncate text-content">{item.title}</span>
                        <span className="lf-caption block text-content-faint">
                          {t('tasks.parent.rewardLabel', { count: item.cost })}
                          {!affordable ? ` · ${t('tasks.kid.catalogNotEnough')}` : ''}
                        </span>
                      </span>
                      {requested ? (
                        <span className="lf-caption shrink-0 text-content-faint">{t('tasks.parent.redemptionStatusRequested')}</span>
                      ) : (
                        /* S07.5 (D.18): the child says why; the level may approve it at once (D.17). */
                        <div className="w-full basis-full">
                          <RewardAskPanel token={token} catalogId={item.id} title={item.title} disabled={!affordable} onAsked={onAsked} />
                        </div>
                      )}
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
