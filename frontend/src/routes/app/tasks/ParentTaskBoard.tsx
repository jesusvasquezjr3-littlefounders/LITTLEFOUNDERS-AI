import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Button, Card, Dropdown, Field, Icon, LoadingOverlay } from '@/components/ui';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';
import type { WireCatalogItem, WireRedemption, WireTask } from './types';

/*
 * The parent's half of FAMILY_HUB.md's loop: assign a task, approve it once
 * done (the ONLY action that credits the kid's wallet — see KidTaskBoard's
 * allocate step), and manage the reward catalog + redemption decisions.
 *
 * Loads everything once in parallel (kids, tasks, catalog, redemptions) —
 * the same "one screen, one load" shape FamilyPage already uses, rather than
 * four independent spinners for what is one page.
 */

interface Kid {
  userId: string;
  displayName: string | null;
  username: string | null;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; code: string }
  | { status: 'ready'; kids: Kid[]; tasks: WireTask[]; catalog: WireCatalogItem[]; redemptions: WireRedemption[] };

const MAX_REWARD_COINS = 500;

export function ParentTaskBoard() {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [token, setToken] = useState<string | null>(null);
  const [busyTask, setBusyTask] = useState<string | null>(null);
  const [busyRedemption, setBusyRedemption] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const tok = await getToken();
      if (!tok || cancelled) return;
      setToken(tok);
      const [kidsRes, tasksRes, catalogRes, redemptionsRes] = await Promise.all([
        api<{ kids: Kid[] }>('/family/kids', { token: tok }),
        api<{ tasks: WireTask[] }>('/tasks', { token: tok }),
        api<{ items: WireCatalogItem[] }>('/tasks/catalog', { token: tok }),
        api<{ redemptions: WireRedemption[] }>('/tasks/redemptions', { token: tok }),
      ]);
      if (cancelled) return;
      // Checked as direct property accesses (not through an intermediate
      // variable) so TypeScript can narrow each result's `.data` to non-null
      // below — routing through a merged `firstError` variable breaks that.
      if (kidsRes.error || tasksRes.error || catalogRes.error || redemptionsRes.error) {
        const code = (kidsRes.error ?? tasksRes.error ?? catalogRes.error ?? redemptionsRes.error)?.code ?? 'INTERNAL';
        setState({ status: 'error', code });
        return;
      }
      setState({
        status: 'ready',
        kids: kidsRes.data.kids,
        tasks: tasksRes.data.tasks,
        catalog: catalogRes.data.items,
        redemptions: redemptionsRes.data.redemptions,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const kidName = useMemo(() => {
    const byId = new Map((state.status === 'ready' ? state.kids : []).map((k) => [k.userId, k.displayName ?? k.username ?? '?']));
    return (id: string) => byId.get(id) ?? '?';
  }, [state]);

  async function onApprove(taskId: string) {
    if (!token || busyTask) return;
    setBusyTask(taskId);
    const res = await api<{ task: WireTask }>(`/tasks/${taskId}/approve`, { method: 'POST', token });
    setBusyTask(null);
    if (res.data) setState((prev) => (prev.status === 'ready' ? { ...prev, tasks: prev.tasks.map((tt) => (tt.id === taskId ? res.data.task : tt)) } : prev));
  }

  async function onCancel(taskId: string) {
    if (!token || busyTask) return;
    setBusyTask(taskId);
    const res = await api<{ task: WireTask }>(`/tasks/${taskId}/cancel`, { method: 'POST', token });
    setBusyTask(null);
    if (res.data) setState((prev) => (prev.status === 'ready' ? { ...prev, tasks: prev.tasks.map((tt) => (tt.id === taskId ? res.data.task : tt)) } : prev));
  }

  async function onToggleCatalog(item: WireCatalogItem) {
    if (!token) return;
    const res = await api<{ item: WireCatalogItem }>(`/tasks/catalog/${item.id}`, { method: 'PATCH', token, body: { active: !item.active } });
    if (res.data) setState((prev) => (prev.status === 'ready' ? { ...prev, catalog: prev.catalog.map((c) => (c.id === item.id ? res.data.item : c)) } : prev));
  }

  async function onDecideRedemption(redemptionId: string, approve: boolean) {
    if (!token || busyRedemption) return;
    setBusyRedemption(redemptionId);
    const res = await api<{ decided: boolean }>(`/tasks/redemptions/${redemptionId}/decide`, { method: 'POST', token, body: { approve } });
    setBusyRedemption(null);
    if (res.data) {
      setState((prev) =>
        prev.status === 'ready'
          ? { ...prev, redemptions: prev.redemptions.map((r) => (r.id === redemptionId ? { ...r, status: approve ? 'approved' : 'denied' } : r)) }
          : prev,
      );
    }
  }

  if (state.status === 'loading') return <LoadingOverlay label={t('tasks.loading')} />;
  if (state.status === 'error') return <ErrorBanner code={state.code} />;

  const awaitingApproval = state.tasks.filter((tt) => tt.status === 'done');
  const open = state.tasks.filter((tt) => tt.status === 'open');
  const history = state.tasks.filter((tt) => tt.status === 'approved' || tt.status === 'cancelled').slice(0, 10);
  const pendingRedemptions = state.redemptions.filter((r) => r.status === 'requested');

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:px-6">
      <header>
        <h1 className="lf-display-lg text-content">{t('tasks.title')}</h1>
        <p className="lf-body text-content-muted">{t('tasks.parent.subtitle')}</p>
      </header>

      {state.kids.length > 0 && (
        <CreateTaskCard
          kids={state.kids}
          token={token}
          onCreated={(task) => setState((prev) => (prev.status === 'ready' ? { ...prev, tasks: [task, ...prev.tasks] } : prev))}
        />
      )}

      <section className="flex flex-col gap-3">
        {awaitingApproval.length === 0 && open.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 p-8 text-center">
            <Icon name="checklist" className="text-[40px] text-content-faint" aria-hidden />
            <h2 className="lf-title text-content">{t('tasks.parent.emptyTitle')}</h2>
            <p className="lf-body max-w-md text-content-muted">{t('tasks.parent.emptyBody')}</p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {[...awaitingApproval, ...open].map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                kidName={kidName(task.assignedTo)}
                busy={busyTask === task.id}
                onApprove={task.status === 'done' ? () => void onApprove(task.id) : undefined}
                onCancel={() => void onCancel(task.id)}
              />
            ))}
          </ul>
        )}
      </section>

      {history.length > 0 && (
        <ul className="flex flex-col gap-2 opacity-70">
          {history.map((task) => (
            <TaskRow key={task.id} task={task} kidName={kidName(task.assignedTo)} busy={false} />
          ))}
        </ul>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="lf-title text-content">{t('tasks.parent.catalogTitle')}</h2>
        <p className="lf-body text-content-muted">{t('tasks.parent.catalogSubtitle')}</p>
        {state.catalog.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 p-6 text-center">
            <Icon name="redeem" className="text-[32px] text-content-faint" aria-hidden />
            <p className="lf-body text-content-muted">{t('tasks.parent.catalogEmptyBody')}</p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {state.catalog.map((item) => (
              <li key={item.id} className="flex items-center gap-3 rounded-lg border border-outline/70 bg-surface px-4 py-3 shadow-glass-sm">
                <Icon name="redeem" className="shrink-0 text-[20px] text-content-faint" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="lf-label block truncate text-content">{item.title}</span>
                  <span className="lf-caption block text-content-faint">{t('tasks.parent.rewardLabel', { count: item.cost })}</span>
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-9 px-3 lf-caption"
                  onClick={() => void onToggleCatalog(item)}
                >
                  {item.active ? t('tasks.parent.catalogToggleOff') : t('tasks.parent.catalogToggleOn')}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <AddCatalogItemCard token={token} onCreated={(item) => setState((prev) => (prev.status === 'ready' ? { ...prev, catalog: [item, ...prev.catalog] } : prev))} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="lf-title text-content">{t('tasks.parent.redemptionsTitle')}</h2>
        {pendingRedemptions.length === 0 ? (
          <p className="lf-body text-content-muted">{t('tasks.parent.redemptionsEmpty')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pendingRedemptions.map((r) => {
              const item = state.catalog.find((c) => c.id === r.catalogId);
              return (
                <li key={r.id} className="flex items-center gap-3 rounded-lg border border-outline/70 bg-surface px-4 py-3 shadow-glass-sm">
                  <span className="min-w-0 flex-1">
                    <span className="lf-label block truncate text-content">{kidName(r.kidUserId)} — {item?.title ?? '?'}</span>
                    <span className="lf-caption block text-content-faint">{t('tasks.parent.redemptionStatusRequested')}</span>
                  </span>
                  <Button type="button" variant="secondary" className="min-h-9 px-3 lf-caption" disabled={busyRedemption === r.id} onClick={() => void onDecideRedemption(r.id, false)}>
                    {t('tasks.parent.redemptionDeny')}
                  </Button>
                  <Button type="button" variant="success" className="min-h-9 px-3 lf-caption" disabled={busyRedemption === r.id} onClick={() => void onDecideRedemption(r.id, true)}>
                    {t('tasks.parent.redemptionApprove')}
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

function TaskRow({
  task,
  kidName,
  busy,
  onApprove,
  onCancel,
}: {
  task: WireTask;
  kidName: string;
  busy: boolean;
  onApprove?: () => void;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const statusKey = { open: 'statusOpen', done: 'statusDone', approved: 'statusApproved', cancelled: 'statusCancelled' }[task.status];
  return (
    <li className="flex items-center gap-3 rounded-lg border border-outline/70 bg-surface px-4 py-3 shadow-glass-sm">
      <Icon
        name={task.status === 'approved' ? 'check_circle' : task.status === 'cancelled' ? 'cancel' : task.status === 'done' ? 'pending_actions' : 'radio_button_unchecked'}
        className="shrink-0 text-[20px] text-content-faint"
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="lf-label block truncate text-content">{task.title} — {kidName}</span>
        <span className="lf-caption block text-content-faint">
          {t(`tasks.parent.${statusKey}`)} · {t('tasks.parent.rewardLabel', { count: task.rewardCoins })}
        </span>
      </span>
      {onCancel && (
        <Button type="button" variant="secondary" className="min-h-9 px-3 lf-caption" disabled={busy} onClick={onCancel}>
          {busy ? t('tasks.parent.cancelling') : t('tasks.parent.cancelTask')}
        </Button>
      )}
      {onApprove && (
        <Button type="button" variant="success" className="min-h-9 px-3 lf-caption" disabled={busy} onClick={onApprove}>
          {busy ? t('tasks.parent.approving') : t('tasks.parent.approve')}
        </Button>
      )}
    </li>
  );
}

function CreateTaskCard({ kids, token, onCreated }: { kids: Kid[]; token: string | null; onCreated: (task: WireTask) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [assignedTo, setAssignedTo] = useState(kids[0]?.userId ?? '');
  const [title, setTitle] = useState('');
  const [rewardCoins, setRewardCoins] = useState(5);
  const [recurrence, setRecurrence] = useState<'once' | 'weekly'>('once');
  const [submitting, setSubmitting] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const ready = assignedTo.length > 0 && title.trim().length > 0 && rewardCoins >= 1 && rewardCoins <= MAX_REWARD_COINS;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ready || submitting || !token) return;
    setSubmitting(true);
    setErrorCode(null);
    const res = await api<{ task: WireTask }>('/tasks', { method: 'POST', token, body: { assignedTo, title: title.trim(), rewardCoins, recurrence } });
    setSubmitting(false);
    if (res.error) {
      setErrorCode(res.error.code);
      return;
    }
    onCreated(res.data.task);
    setTitle('');
    setRewardCoins(5);
    setOpen(false);
  }

  if (!open) {
    return (
      <Button type="button" variant="primary" className="self-start" onClick={() => setOpen(true)}>
        <Icon name="add_task" className="mr-1.5 text-[18px]" aria-hidden />
        {t('tasks.parent.createCta')}
      </Button>
    );
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <h2 className="lf-title text-content">{t('tasks.parent.createTitle')}</h2>
      <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="lf-label text-content">{t('tasks.parent.assignTo')}</span>
          <Dropdown
            value={assignedTo}
            options={kids.map((k) => ({ value: k.userId, label: k.displayName ?? k.username ?? '?' }))}
            onChange={setAssignedTo}
            ariaLabel={t('tasks.parent.assignTo')}
          />
        </div>
        <Field label={t('tasks.parent.taskTitle')} hint={t('tasks.parent.taskTitleHint')} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        <Field
          label={t('tasks.parent.reward')}
          type="number"
          min={1}
          max={MAX_REWARD_COINS}
          value={rewardCoins}
          onChange={(e) => setRewardCoins(Number(e.target.value))}
        />
        <div className="flex flex-col gap-1.5">
          <span className="lf-label text-content">{t('tasks.parent.recurrence')}</span>
          <Dropdown
            value={recurrence}
            options={[
              { value: 'once', label: t('tasks.parent.recurrenceOnce') },
              { value: 'weekly', label: t('tasks.parent.recurrenceWeekly') },
            ]}
            onChange={(v) => setRecurrence(v as 'once' | 'weekly')}
            ariaLabel={t('tasks.parent.recurrence')}
          />
        </div>
        {errorCode && <ErrorBanner code={errorCode} />}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            {t('tasks.parent.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={!ready || submitting}>
            {submitting ? t('tasks.parent.submitting') : t('tasks.parent.submit')}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function AddCatalogItemCard({ token, onCreated }: { token: string | null; onCreated: (item: WireCatalogItem) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [cost, setCost] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const ready = title.trim().length > 0 && cost >= 1 && cost <= MAX_REWARD_COINS;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ready || submitting || !token) return;
    setSubmitting(true);
    setErrorCode(null);
    const res = await api<{ item: WireCatalogItem }>('/tasks/catalog', { method: 'POST', token, body: { title: title.trim(), cost } });
    setSubmitting(false);
    if (res.error) {
      setErrorCode(res.error.code);
      return;
    }
    onCreated(res.data.item);
    setTitle('');
    setCost(5);
    setOpen(false);
  }

  if (!open) {
    return (
      <Button type="button" variant="secondary" className="self-start" onClick={() => setOpen(true)}>
        <Icon name="add" className="mr-1.5 text-[18px]" aria-hidden />
        {t('tasks.parent.catalogAddCta')}
      </Button>
    );
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
        <Field label={t('tasks.parent.catalogItemTitle')} hint={t('tasks.parent.catalogItemTitleHint')} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        <Field label={t('tasks.parent.catalogItemCost')} type="number" min={1} max={MAX_REWARD_COINS} value={cost} onChange={(e) => setCost(Number(e.target.value))} />
        {errorCode && <ErrorBanner code={errorCode} />}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            {t('tasks.parent.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={!ready || submitting}>
            {submitting ? t('tasks.parent.catalogSubmitting') : t('tasks.parent.catalogSubmit')}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default ParentTaskBoard;
