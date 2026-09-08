import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Button, Card, Dropdown, Field, Icon, LoadingOverlay, ProgressBar } from '@/components/ui';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';
import { GOAL_ICONS, GOAL_ICON_GLYPH, type GoalIcon, type WalletBalances, type WireCatalogItem, type WireGoal, type WireRedemption, type WireTask } from './types';

/*
 * The kid's half of FAMILY_HUB.md's loop: complete a task, sort the reward
 * across Save/Spend/Share once a grown-up approves it, watch goals fill up,
 * and redeem what a grown-up has offered.
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
    };

export function KidTaskBoard() {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [token, setToken] = useState<string | null>(null);
  const [allocatingTaskId, setAllocatingTaskId] = useState<string | null>(null);
  const [busyTask, setBusyTask] = useState<string | null>(null);
  const [busyRedemption, setBusyRedemption] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const tok = await getToken();
      if (!tok || cancelled) return;
      setToken(tok);
      const [tasksRes, walletRes, goalsRes, catalogRes, redemptionsRes] = await Promise.all([
        api<{ tasks: WireTask[] }>('/tasks/mine', { token: tok }),
        api<{ balances: WalletBalances }>('/tasks/wallet', { token: tok }),
        api<{ goals: WireGoal[] }>('/tasks/goals', { token: tok }),
        api<{ items: WireCatalogItem[] }>('/tasks/catalog/available', { token: tok }),
        api<{ redemptions: WireRedemption[] }>('/tasks/redemptions/mine', { token: tok }),
      ]);
      if (cancelled) return;
      // Direct property accesses (not a merged variable) so TypeScript can
      // narrow each result's `.data` to non-null below.
      if (tasksRes.error || walletRes.error || goalsRes.error || catalogRes.error || redemptionsRes.error) {
        const code = (tasksRes.error ?? walletRes.error ?? goalsRes.error ?? catalogRes.error ?? redemptionsRes.error)?.code ?? 'INTERNAL';
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
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  async function refreshWallet() {
    if (!token) return;
    const res = await api<{ balances: WalletBalances }>('/tasks/wallet', { token });
    if (res.data) setState((prev) => (prev.status === 'ready' ? { ...prev, balances: res.data.balances } : prev));
  }

  async function onComplete(taskId: string) {
    if (!token || busyTask) return;
    setBusyTask(taskId);
    const res = await api<{ task: WireTask }>(`/tasks/${taskId}/complete`, { method: 'POST', token });
    setBusyTask(null);
    if (res.data) setState((prev) => (prev.status === 'ready' ? { ...prev, tasks: prev.tasks.map((tt) => (tt.id === taskId ? res.data.task : tt)) } : prev));
  }

  async function onAllocated(task: WireTask) {
    setAllocatingTaskId(null);
    setState((prev) => (prev.status === 'ready' ? { ...prev, tasks: prev.tasks.map((tt) => (tt.id === task.id ? { ...tt, allocated: true } : tt)) } : prev));
    await refreshWallet();
    if (!token) return;
    const goalsRes = await api<{ goals: WireGoal[] }>('/tasks/goals', { token });
    if (goalsRes.data) setState((prev) => (prev.status === 'ready' ? { ...prev, goals: goalsRes.data.goals } : prev));
  }

  async function onCreateGoal(goal: WireGoal) {
    setState((prev) => (prev.status === 'ready' ? { ...prev, goals: [goal, ...prev.goals] } : prev));
  }

  async function onArchiveGoal(goalId: string) {
    if (!token) return;
    const res = await api<{ goal: WireGoal }>(`/tasks/goals/${goalId}`, { method: 'PATCH', token });
    if (res.data) setState((prev) => (prev.status === 'ready' ? { ...prev, goals: prev.goals.filter((g) => g.id !== goalId) } : prev));
  }

  async function onRedeem(catalogId: string) {
    if (!token || busyRedemption) return;
    setBusyRedemption(catalogId);
    const res = await api<{ redemption: WireRedemption }>('/tasks/redemptions', { method: 'POST', token, body: { catalogId } });
    setBusyRedemption(null);
    if (res.data) setState((prev) => (prev.status === 'ready' ? { ...prev, redemptions: [res.data.redemption, ...prev.redemptions] } : prev));
  }

  if (state.status === 'loading') return <LoadingOverlay label={t('tasks.loading')} />;
  if (state.status === 'error') return <ErrorBanner code={state.code} />;

  const activeGoals = state.goals.filter((g) => g.status !== 'archived');
  const openTasks = state.tasks.filter((tt) => tt.status === 'open');
  const doneTasks = state.tasks.filter((tt) => tt.status === 'done');
  const toAllocate = state.tasks.filter((tt) => tt.status === 'approved' && !tt.allocated);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:px-6">
      <header>
        <h1 className="lf-display-lg text-content">{t('tasks.title')}</h1>
        <p className="lf-body text-content-muted">{t('tasks.kid.subtitle')}</p>
      </header>

      <WalletJars balances={state.balances} />

      {toAllocate.length > 0 && (
        <section className="flex flex-col gap-2">
          {toAllocate.map((task) =>
            allocatingTaskId === task.id ? (
              <AllocateCard key={task.id} task={task} goals={activeGoals} token={token} onDone={() => void onAllocated(task)} onCancel={() => setAllocatingTaskId(null)} />
            ) : (
              <li key={task.id} className="flex list-none items-center gap-3 rounded-lg border-2 border-accent/60 bg-accent-soft px-4 py-3 shadow-glass-sm">
                <Icon name="celebration" className="shrink-0 text-[20px] text-accent-strong" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="lf-label block truncate text-content">{task.title}</span>
                  <span className="lf-caption block text-content-faint">{t('tasks.kid.allocateTitle', { count: task.rewardCoins })}</span>
                </span>
                <Button type="button" variant="primary" className="min-h-9 px-3 lf-caption" onClick={() => setAllocatingTaskId(task.id)}>
                  {t('tasks.kid.allocateCta')}
                </Button>
              </li>
            ),
          )}
        </section>
      )}

      <section className="flex flex-col gap-2">
        {openTasks.length === 0 && doneTasks.length === 0 && toAllocate.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 p-8 text-center">
            <Icon name="checklist" className="text-[40px] text-content-faint" aria-hidden />
            <h2 className="lf-title text-content">{t('tasks.kid.emptyTitle')}</h2>
            <p className="lf-body max-w-md text-content-muted">{t('tasks.kid.emptyBody')}</p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {[...openTasks, ...doneTasks].map((task) => (
              <li key={task.id} className="flex items-center gap-3 rounded-lg border border-outline/70 bg-surface px-4 py-3 shadow-glass-sm">
                <Icon name={task.status === 'done' ? 'pending_actions' : 'radio_button_unchecked'} className="shrink-0 text-[20px] text-content-faint" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="lf-label block truncate text-content">{task.title}</span>
                  <span className="lf-caption block text-content-faint">
                    {t(`tasks.kid.${task.status === 'done' ? 'statusDone' : 'statusOpen'}`)} · {t('tasks.parent.rewardLabel', { count: task.rewardCoins })}
                  </span>
                </span>
                {task.status === 'open' && (
                  <Button type="button" variant="success" className="min-h-9 px-3 lf-caption" disabled={busyTask === task.id} onClick={() => void onComplete(task.id)}>
                    {busyTask === task.id ? t('tasks.kid.completing') : t('tasks.kid.complete')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="lf-title text-content">{t('tasks.kid.goalsTitle')}</h2>
        {activeGoals.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 p-6 text-center">
            <Icon name="savings" className="text-[32px] text-content-faint" aria-hidden />
            <p className="lf-body text-content-muted">{t('tasks.kid.goalEmptyBody')}</p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {activeGoals.map((goal) => (
              <li key={goal.id} className="flex flex-col gap-2 rounded-lg border border-outline/70 bg-surface px-4 py-3 shadow-glass-sm">
                <div className="flex items-center gap-3">
                  <Icon name={GOAL_ICON_GLYPH[goal.icon]} className="shrink-0 text-[20px] text-primary" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="lf-label block truncate text-content">{goal.title}</span>
                    <span className="lf-caption block text-content-faint">
                      {goal.status === 'reached' ? t('tasks.kid.goalReached') : `${goal.saved} / ${goal.target}`}
                    </span>
                  </span>
                  <Button type="button" variant="secondary" className="min-h-8 px-2.5 lf-caption" onClick={() => void onArchiveGoal(goal.id)}>
                    {t('tasks.kid.goalArchive')}
                  </Button>
                </div>
                <ProgressBar value={(goal.saved / goal.target) * 100} label={goal.title} tone={goal.status === 'reached' ? 'accent' : 'primary'} />
              </li>
            ))}
          </ul>
        )}
        <AddGoalCard token={token} onCreated={(g) => void onCreateGoal(g)} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="lf-title text-content">{t('tasks.kid.catalogTitle')}</h2>
        {state.catalog.length === 0 ? (
          <p className="lf-body text-content-muted">{t('tasks.kid.catalogEmpty')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {state.catalog.map((item) => {
              const requested = state.redemptions.some((r) => r.catalogId === item.id && r.status === 'requested');
              const affordable = state.balances.spend >= item.cost;
              return (
                <li key={item.id} className="flex items-center gap-3 rounded-lg border border-outline/70 bg-surface px-4 py-3 shadow-glass-sm">
                  <Icon name="redeem" className="shrink-0 text-[20px] text-content-faint" aria-hidden />
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
                    className="min-h-9 px-3 lf-caption"
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
    </div>
  );
}

function WalletJars({ balances }: { balances: WalletBalances }) {
  const { t } = useTranslation();
  const jars: { key: 'save' | 'spend' | 'share'; icon: string; tone: string }[] = [
    { key: 'save', icon: 'savings', tone: 'text-success' },
    { key: 'spend', icon: 'shopping_bag', tone: 'text-primary' },
    { key: 'share', icon: 'volunteer_activism', tone: 'text-delight' },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {jars.map((jar) => (
        <Card key={jar.key} className="flex flex-col items-center gap-1 p-4 text-center">
          <Icon name={jar.icon} className={`text-[28px] ${jar.tone}`} aria-hidden />
          <span className="lf-number lf-headline text-content">{balances[jar.key]}</span>
          <span className="lf-caption text-content-faint">{t(`tasks.kid.${jar.key}`)}</span>
        </Card>
      ))}
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
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <h2 className="lf-title text-content">{t('tasks.kid.allocateTitle', { count: task.rewardCoins })}</h2>
        <p className="lf-body text-content-muted">{t('tasks.kid.allocateBody')}</p>
      </div>
      <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
        <Field label={t('tasks.kid.save')} type="number" min={0} max={task.rewardCoins} value={save} onChange={(e) => setSave(Number(e.target.value))} />
        <Field label={t('tasks.kid.spend')} type="number" min={0} max={task.rewardCoins} value={spend} onChange={(e) => setSpend(Number(e.target.value))} />
        <Field label={t('tasks.kid.share')} type="number" min={0} max={task.rewardCoins} value={share} onChange={(e) => setShare(Number(e.target.value))} />
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
          {remaining > 0
            ? t('tasks.kid.allocateRemaining', { count: remaining })
            : remaining < 0
              ? t('tasks.kid.allocateTooMuch')
              : null}
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
      <Button type="button" variant="secondary" className="self-start" onClick={() => setOpen(true)}>
        <Icon name="add" className="mr-1.5 text-[18px]" aria-hidden />
        {t('tasks.kid.goalsAddCta')}
      </Button>
    );
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
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
