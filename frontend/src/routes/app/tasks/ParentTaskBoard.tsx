import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { trackInsight } from '@/lib/insights';
import { Button, Card, ConfirmButton, Field, Icon, LoadingOverlay, SectionHeading, StatCard } from '@/components/ui';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';
import { EvidenceThumbnail } from './EvidencePhoto';
import type { WireCatalogItem, WireRedemption, WireTask } from './types';
import { ChoreComposerPanel } from './ChoreComposerPanel';
import { choreKindLine } from '../family/familyMoneyCopy';

/*
 * The parent's half of FAMILY_HUB.md's loop: assign a task, approve it once
 * done — the ONLY action that credits the kid's wallet, see KidTaskBoard's
 * allocate step — and manage the reward catalog + redemption decisions.
 *
 * Layout mirrors KidTaskBoard's: three aggregate StatCards up top (the same
 * visual rhythm as the kid's Save/Spend/Share row, so the two dashboards
 * read as one product), then a main column (the task list, where a decision
 * is due) beside a secondary column (catalog + redemption requests),
 * collapsing to one stacked column on mobile.
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
  const [busyTask, setBusyTask] = useState<string | null>(null);
  const [busyRedemption, setBusyRedemption] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [taskActionError, setTaskActionError] = useState<{ id: string; code: string } | null>(null);
  const [redemptionActionError, setRedemptionActionError] = useState<{ id: string; code: string } | null>(null);
  const [liveMessage, setLiveMessage] = useState('');
  const liveRegionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setState((prev) => (prev.status === 'error' ? { status: 'loading' } : prev));
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
  }, [getToken, reloadKey]);

  function announce(message: string) {
    setLiveMessage(message);
    liveRegionRef.current?.focus();
  }

  const kidName = useMemo(() => {
    const byId = new Map((state.status === 'ready' ? state.kids : []).map((k) => [k.userId, k.displayName ?? k.username ?? '?']));
    return (id: string) => byId.get(id) ?? '?';
  }, [state]);

  async function onApprove(taskId: string, title: string) {
    if (!token || busyTask) return;
    setBusyTask(taskId);
    setTaskActionError(null);
    const res = await api<{ task: WireTask }>(`/tasks/${taskId}/approve`, { method: 'POST', token });
    setBusyTask(null);
    if (res.error) {
      setTaskActionError({ id: taskId, code: res.error.code });
      return;
    }
    setState((prev) => (prev.status === 'ready' ? { ...prev, tasks: prev.tasks.map((tt) => (tt.id === taskId ? res.data.task : tt)) } : prev));
    announce(t('tasks.parent.approvedAnnounce', { title }));
  }

  async function onCancel(taskId: string, reason: string) {
    if (!token || busyTask) return;
    setBusyTask(taskId);
    setTaskActionError(null);
    const res = await api<{ task: WireTask }>(`/tasks/${taskId}/cancel`, { method: 'POST', token, body: { reason: reason.trim() || null } });
    setBusyTask(null);
    if (res.error) {
      setTaskActionError({ id: taskId, code: res.error.code });
      return;
    }
    setState((prev) => (prev.status === 'ready' ? { ...prev, tasks: prev.tasks.map((tt) => (tt.id === taskId ? res.data.task : tt)) } : prev));
    announce(t('tasks.parent.cancelledAnnounce', { title: res.data.task.title }));
  }

  async function onToggleCatalog(item: WireCatalogItem) {
    if (!token) return;
    const res = await api<{ item: WireCatalogItem }>(`/tasks/catalog/${item.id}`, { method: 'PATCH', token, body: { active: !item.active } });
    if (res.data) setState((prev) => (prev.status === 'ready' ? { ...prev, catalog: prev.catalog.map((c) => (c.id === item.id ? res.data.item : c)) } : prev));
  }

  async function onDecideRedemption(redemptionId: string, approve: boolean) {
    if (!token || busyRedemption) return;
    setBusyRedemption(redemptionId);
    setRedemptionActionError(null);
    const res = await api<{ decided: boolean }>(`/tasks/redemptions/${redemptionId}/decide`, { method: 'POST', token, body: { approve } });
    setBusyRedemption(null);
    if (res.error) {
      setRedemptionActionError({ id: redemptionId, code: res.error.code });
      return;
    }
    setState((prev) =>
      prev.status === 'ready'
        ? { ...prev, redemptions: prev.redemptions.map((r) => (r.id === redemptionId ? { ...r, status: approve ? 'approved' : 'denied' } : r)) }
        : prev,
    );
    announce(approve ? t('tasks.parent.redemptionApprovedAnnounce') : t('tasks.parent.redemptionDeniedAnnounce'));
  }

  if (state.status === 'loading') return <LoadingOverlay label={t('tasks.loading')} />;
  if (state.status === 'error') return <ErrorBanner code={state.code} onRetry={() => setReloadKey((k) => k + 1)} />;

  const awaitingApproval = state.tasks.filter((tt) => tt.status === 'done');
  const open = state.tasks.filter((tt) => tt.status === 'open');
  const history = state.tasks.filter((tt) => tt.status === 'approved' || tt.status === 'cancelled').slice(0, 10);
  const pendingRedemptions = state.redemptions.filter((r) => r.status === 'requested');
  const coinsAwarded = state.tasks.filter((tt) => tt.status === 'approved').reduce((sum, tt) => sum + tt.rewardCoins, 0);

  return (
    <div className="flex flex-col gap-8 pb-8">
      <div ref={liveRegionRef} tabIndex={-1} role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </div>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="lf-display-lg text-content">{t('tasks.title')}</h1>
          <p className="lf-body text-content-muted">{t('tasks.parent.subtitle')}</p>
        </div>
      </header>

      {/* S07.3 (D.10): every chore is tagged as a family contribution or a bonus task. */}
      {state.kids.length > 0 && <ChoreComposerPanel kids={state.kids} token={token} onCreated={() => setReloadKey((k) => k + 1)} />}

      {state.kids.length === 0 && (
        <Card className="flex flex-col items-center gap-2 p-8 text-center">
          <Icon name="family_restroom" className="text-[40px] text-content-faint" aria-hidden />
          <h2 className="lf-title text-content">{t('tasks.parent.emptyNoKidsTitle')}</h2>
          <p className="lf-body max-w-md text-content-muted">{t('tasks.parent.emptyNoKidsBody')}</p>
          <Link to="/family" className="lf-caption lf-press mt-2 inline-flex min-h-9 items-center rounded-full bg-accent px-4 font-bold text-on-accent hover:bg-accent-strong">
            {t('tasks.parent.emptyNoKidsCta')}
          </Link>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard icon={<Icon name="pending_actions" />} value={String(awaitingApproval.length)} label={t('tasks.parent.statAwaiting')} tone="warning" />
        <StatCard icon={<Icon name="redeem" />} value={String(pendingRedemptions.length)} label={t('tasks.parent.statRedemptions')} tone="delight" />
        <StatCard icon={<Icon name="savings" />} value={String(coinsAwarded)} label={t('tasks.parent.statAwarded')} tone="success" />
      </div>
      <Link to="/banking" className="-mt-4 inline-flex items-center gap-1 self-start lf-caption font-bold text-primary">
        {t('tasks.parent.bankingLink')}
        <Icon name="arrow_forward" className="text-[16px]" aria-hidden />
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-labelledby="parent-tasks-heading">
          <SectionHeading id="parent-tasks-heading" icon="checklist" tone="accent" meta={open.length + awaitingApproval.length > 0 ? String(open.length + awaitingApproval.length) : undefined}>
            {t('tasks.parent.tasksHeading')}
          </SectionHeading>
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
                  token={token}
                  busy={busyTask === task.id}
                  errorCode={taskActionError?.id === task.id ? taskActionError.code : null}
                  onApprove={task.status === 'done' ? () => void onApprove(task.id, task.title) : undefined}
                  onCancel={(reason) => void onCancel(task.id, reason)}
                />
              ))}
            </ul>
          )}
          {history.length > 0 && (
            <ul className="mt-2 flex flex-col gap-2 opacity-70">
              {history.map((task) => (
                <TaskRow key={task.id} task={task} kidName={kidName(task.assignedTo)} token={token} busy={false} />
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-6">
          <section aria-labelledby="parent-catalog-heading">
            <SectionHeading id="parent-catalog-heading" icon="redeem" tone="delight">
              {t('tasks.parent.catalogTitle')}
            </SectionHeading>
            <p className="lf-caption -mt-1.5 mb-2 text-content-muted">{t('tasks.parent.catalogSubtitle')}</p>
            {state.catalog.length === 0 ? (
              <Card className="flex flex-col items-center gap-2 p-6 text-center">
                <Icon name="redeem" className="text-[28px] text-content-faint" aria-hidden />
                <p className="lf-caption text-content-muted">{t('tasks.parent.catalogEmptyBody')}</p>
              </Card>
            ) : (
              <ul className="flex flex-col gap-2">
                {state.catalog.map((item) => (
                  <li key={item.id} className="flex items-center gap-2.5 rounded-lg border border-outline/70 bg-surface px-4 py-3 shadow-glass-sm">
                    <Icon name="redeem" className="shrink-0 text-[16px] text-content-faint" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="lf-label block truncate text-content">{item.title}</span>
                      <span className="lf-caption block text-content-faint">{t('tasks.parent.rewardLabel', { count: item.cost })}</span>
                    </span>
                    <Button type="button" variant="secondary" className="min-h-8 shrink-0 px-2.5 lf-caption" onClick={() => void onToggleCatalog(item)}>
                      {item.active ? t('tasks.parent.catalogToggleOff') : t('tasks.parent.catalogToggleOn')}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <AddCatalogItemCard token={token} onCreated={(item) => setState((prev) => (prev.status === 'ready' ? { ...prev, catalog: [item, ...prev.catalog] } : prev))} />
          </section>

          <section aria-labelledby="parent-redemptions-heading">
            <SectionHeading id="parent-redemptions-heading" icon="pending_actions" tone="warning">
              {t('tasks.parent.redemptionsTitle')}
            </SectionHeading>
            {pendingRedemptions.length === 0 ? (
              <p className="lf-caption text-content-muted">{t('tasks.parent.redemptionsEmpty')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {pendingRedemptions.map((r) => {
                  const item = state.catalog.find((c) => c.id === r.catalogId);
                  return (
                    <li key={r.id} className="flex flex-col gap-2 rounded-lg border border-outline/70 bg-surface px-4 py-3 shadow-glass-sm">
                      <span className="min-w-0">
                        <span className="lf-label block truncate text-content">
                          {kidName(r.kidUserId)} — {item?.title ?? '?'}
                        </span>
                        <span className="lf-caption block text-content-faint">{t('tasks.parent.redemptionStatusRequested')}</span>
                      </span>
                      {redemptionActionError?.id === r.id && (
                        <span className="lf-caption text-error-strong">
                          {t(`errors.api.${redemptionActionError.code}`, { defaultValue: t('errors.api.INTERNAL') })}
                        </span>
                      )}
                      <div className="flex gap-2">
                        <ConfirmButton
                          variant="secondary"
                          className="min-h-8 flex-1 px-2.5 lf-caption"
                          disabled={busyRedemption === r.id}
                          confirmQuestion={t('tasks.parent.denyConfirmQuestion')}
                          onConfirm={() => void onDecideRedemption(r.id, false)}
                        >
                          {t('tasks.parent.redemptionDeny')}
                        </ConfirmButton>
                        <Button type="button" variant="success" className="min-h-8 flex-1 px-2.5 lf-caption" disabled={busyRedemption === r.id} onClick={() => void onDecideRedemption(r.id, true)}>
                          {t('tasks.parent.redemptionApprove')}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function TaskRow({
  task,
  kidName,
  token,
  busy,
  errorCode,
  onApprove,
  onCancel,
}: {
  task: WireTask;
  kidName: string;
  token: string | null;
  busy: boolean;
  errorCode?: string | null;
  onApprove?: () => void;
  onCancel?: (reason: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const statusKey = { open: 'statusOpen', done: 'statusDone', approved: 'statusApproved', cancelled: 'statusCancelled' }[task.status];
  const blockedByMissingEvidence = task.status === 'done' && task.requiresEvidence && !task.hasEvidence;

  return (
    <li className="flex flex-col gap-2.5 rounded-lg border border-outline/70 bg-surface px-4 py-3 shadow-glass-sm sm:flex-row sm:items-center sm:gap-3">
      <Icon
        name={task.status === 'approved' ? 'check_circle' : task.status === 'cancelled' ? 'cancel' : task.status === 'done' ? 'pending_actions' : 'radio_button_unchecked'}
        className="hidden shrink-0 text-[20px] text-content-faint sm:block"
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="lf-label flex flex-wrap items-center gap-x-2 truncate text-content">
          {task.title} — {kidName}
          {task.recurrence === 'weekly' && (
            <span className="lf-caption rounded-full bg-surface-sunken px-2 py-0.5 font-bold text-content-faint">{t('tasks.recurrenceBadgeWeekly')}</span>
          )}
          {task.requiresEvidence && (
            <span className="lf-caption rounded-full bg-warning-soft px-2 py-0.5 font-bold text-warning-strong">{t('tasks.parent.requiresEvidenceLabel')}</span>
          )}
        </span>
        <span className="lf-caption block text-content-faint">
          {t(`tasks.parent.${statusKey}`)} · {choreKindLine(i18n.resolvedLanguage, task.kind, task.rewardCoins)}
        </span>
        {task.status === 'cancelled' && task.cancelReason && <span className="lf-caption block italic text-content-faint">“{task.cancelReason}”</span>}
        {errorCode && <span className="lf-caption block text-error-strong">{t(`errors.api.${errorCode}`, { defaultValue: t('errors.api.INTERNAL') })}</span>}
      </span>

      {cancelling ? (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
          <Field
            label={t('tasks.parent.cancelReasonLabel')}
            placeholder={t('tasks.parent.cancelReasonPlaceholder')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={240}
            className="sm:w-56"
          />
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="secondary"
              className="min-h-9 px-3 lf-caption"
              onClick={() => {
                setCancelling(false);
                setReason('');
              }}
            >
              {t('actions.confirmNo')}
            </Button>
            <Button type="button" variant="danger" className="min-h-9 px-3 lf-caption" disabled={busy} onClick={() => onCancel?.(reason)}>
              {busy ? t('tasks.parent.cancelling') : t('tasks.parent.cancelTask')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-2">
          {task.hasEvidence && <EvidenceThumbnail taskId={task.id} token={token} alt={t('tasks.parent.evidenceAlt', { title: task.title })} />}
          {onCancel && (
            <Button type="button" variant="secondary" className="min-h-9 px-3 lf-caption" disabled={busy} onClick={() => setCancelling(true)}>
              {t('tasks.parent.cancelTask')}
            </Button>
          )}
          {onApprove && (
            <Button type="button" variant="success" className="min-h-9 px-3 lf-caption" disabled={busy || blockedByMissingEvidence} onClick={onApprove}>
              {busy ? t('tasks.parent.approving') : t('tasks.parent.approve')}
            </Button>
          )}
        </div>
      )}
    </li>
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
      <Button type="button" variant="secondary" className="mt-2 min-h-9 px-3 lf-caption" onClick={() => setOpen(true)}>
        <Icon name="add" className="mr-1.5 text-[16px]" aria-hidden />
        {t('tasks.parent.catalogAddCta')}
      </Button>
    );
  }

  return (
    <Card className="mt-2 flex flex-col gap-4 p-5">
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
