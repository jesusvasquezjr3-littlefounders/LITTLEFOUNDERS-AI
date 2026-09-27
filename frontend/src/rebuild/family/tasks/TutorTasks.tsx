import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button, ButtonGroup, Chip, Copy, DashboardLayout, EmptyState, InlineNotice, RewardChip, TextField } from '../../design/controls';
import { childName, fetchChildren, type Child, type ConsoleTransport } from '../console/consoleApi';
import { ConsoleLink, FailureState, PageLoading, type ConsoleLocale, type PageFailure } from '../console/consoleParts';
import {
  createReward, fetchTutorBoard, glance, REWARD_COST_MAX, REWARD_TITLE_MAX, setRewardOffered, tutorChores, type PhotoPort, type Reward, type Task,
  type TutorBoard,
} from './tasksApi';
import { ChoreChips, coinWord, PhotoView, type TutorTasksCopy } from './taskParts';
import '../../design/tokens.css';
import '../../design/system.css';
import '../console/console.css';
import './money.css';

/*
 * F4-P, the Tutor's Tasks board (W2F.2), rebuilt on the design system's
 * dashboard layout inside the Tutor shell (02 §4.5, 03 §3.3: the decisions
 * and the chores wide, the reward list narrow; one column below 840 px).
 *
 * Order, most urgent first: the three glance numbers (to approve, rewards
 * asked, coins given), the decision queue (every approval and every "not
 * yet" with its reason, the child's own words and the reflective prompt:
 * D.17, D.18, D.23), the chore composer (a family contribution or a bonus
 * task, with pricing guidance: D.10, D.23), then the chores: waiting for this
 * Tutor, to do, and the ten latest closed, each with its child, status,
 * kind, coins, repeat, photo rule and photo. Beside them: this month's tip
 * and the reward list (offer, pause, add).
 *
 * The decision queue, the composer and the tip are the wave-1 surfaces
 * (S07.5, S07.3, S07.7) with their own data planes, handed in as slots by the
 * route adapter, so every server rule they carry is unchanged. A decision or
 * a new chore bumps `refreshKey`, and this board re-reads what Core holds.
 * The list here decides nothing: approval lives in the queue (D.18).
 *
 * Nothing here authorizes anything: the route admits a parent, and Core
 * re-checks the verified guardian link on every read and write.
 */

type Load = { status: 'loading' } | { status: 'failed'; failure: PageFailure } | { status: 'ready'; children: Child[]; board: TutorBoard };

export interface TutorTasksSlots {
  /** S07.7 (D.23): this month's tip. */
  tip: ReactNode;
  /** S07.5 (D.17, D.18): the decision queue, naming these children. */
  queue: (children: Child[]) => ReactNode;
  /** S07.3 (D.10): the chore composer, for these children. */
  composer: (children: Child[]) => ReactNode;
}

export function TutorTasks({ copy, locale, dark, transport, photos, onNavigate, refreshKey = 0, slots, verifyHref = '/verify-parent' }: {
  copy: TutorTasksCopy;
  locale: ConsoleLocale;
  dark: boolean;
  transport: ConsoleTransport;
  photos: PhotoPort;
  onNavigate: (href: string) => void;
  /** Bumped by the route adapter after a decision or a new chore: the board re-reads. */
  refreshKey?: number;
  slots: TutorTasksSlots;
  verifyHref?: string;
}) {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [retrying, setRetrying] = useState(false);
  const generation = useRef(0);

  const read = useCallback(async () => {
    const current = ++generation.current;
    const [children, board] = await Promise.all([fetchChildren(transport), fetchTutorBoard(transport)]);
    if (current !== generation.current) return;
    setRetrying(false);
    // A family with no children has no board to read; the verification refusal comes from the family list.
    if (!children.ok) { setLoad({ status: 'failed', failure: { code: children.code } }); return; }
    if (!board.ok) {
      // A silent re-read after a decision keeps what is shown; only a first load (or a retry) shows the failure.
      setLoad((previous) => previous.status === 'ready' ? previous : { status: 'failed', failure: { code: board.code } });
      return;
    }
    setLoad({ status: 'ready', children: children.data, board: board.data });
  }, [transport]);

  useEffect(() => {
    void read();
    return () => { generation.current++; };
  }, [read, refreshKey]);

  const root = (body: ReactNode) => <div className="lf-rebuild lf-family-console lf-family-money" data-screen="tutor-tasks" data-theme={dark ? 'dark' : 'light'} lang={locale}>
    <header className="lf-console-header"><h1 data-copy-role="heading">{copy.title}</h1></header>
    {body}
  </div>;

  if (load.status === 'loading') return root(<PageLoading label={copy.loading} />);
  if (load.status === 'failed') {
    if (load.failure.code === 'PARENT_VERIFICATION_REQUIRED') {
      return root(<EmptyState heading={copy.verifyTitle} body={copy.verifyBody}
        action={<ConsoleLink href={verifyHref} onNavigate={onNavigate} variant="accent">{copy.verifyAction}</ConsoleLink>} />);
    }
    return root(<FailureState failure={load.failure} copy={copy} retrying={retrying} onRetry={() => { setRetrying(true); void read(); }} />);
  }

  const { children, board } = load;
  if (children.length === 0) {
    return root(<EmptyState heading={copy.emptyTitle} body={copy.emptyBody}
      action={<ConsoleLink href="/family" onNavigate={onNavigate} variant="accent">{copy.emptyAction}</ConsoleLink>} />);
  }

  const names = new Map(children.map((child) => [child.userId, childName(child)]));
  const counts = glance(board);
  const chores = tutorChores(board.tasks);
  return root(<DashboardLayout
    primary={<>
      <Glance copy={copy} counts={counts} />
      {slots.queue(children)}
      {slots.composer(children)}
      <section className="lf-console-group" data-family-part="chores" aria-labelledby="tutor-chores-heading">
        <h2 id="tutor-chores-heading" data-copy-role="heading">{copy.choresTitle}</h2>
        {board.tasks.length === 0 ? <Copy role="body">{copy.choresEmpty}</Copy> : <>
          <ChoreList heading={copy.waiting} tasks={chores.waiting} names={names} copy={copy} photos={photos} group="waiting" />
          <ChoreList heading={copy.toDo} tasks={chores.open} names={names} copy={copy} photos={photos} group="open" />
          <ChoreList heading={copy.recent} tasks={chores.recent} names={names} copy={copy} photos={photos} group="recent" />
        </>}
      </section>
    </>}
    secondary={<>
      {slots.tip}
      <RewardList copy={copy} transport={transport} rewards={board.rewards}
        onChanged={(reward, added) => setLoad((previous) => previous.status !== 'ready' ? previous : {
          ...previous, board: { ...previous.board, rewards: added ? [reward, ...previous.board.rewards] : previous.board.rewards.map((item) => item.id === reward.id ? reward : item) },
        })} />
      <div className="lf-money-link"><ConsoleLink href="/banking" onNavigate={onNavigate}>{copy.coinCards}</ConsoleLink></div>
    </>} />);
}

function Glance({ copy, counts }: { copy: TutorTasksCopy; counts: ReturnType<typeof glance> }) {
  const heading = useId();
  return <section className="lf-console-group" data-family-part="glance" aria-labelledby={heading}>
    <h2 id={heading} data-copy-role="heading">{copy.glance}</h2>
    <dl className="lf-console-stats">
      {([['toApprove', counts.toApprove], ['toDecide', counts.asked], ['coinsGiven', counts.coinsGiven]] as const).map(([key, value]) =>
        <div key={key} className="lf-console-stat" data-glance={key}>
          <dt data-copy-role="option">{copy[key]}</dt>
          <dd data-copy-role="data">{value}</dd>
        </div>)}
    </dl>
  </section>;
}

function ChoreList({ heading, tasks, names, copy, photos, group }: {
  heading: string; tasks: Task[]; names: Map<string, string>; copy: TutorTasksCopy; photos: PhotoPort; group: string;
}) {
  const id = useId();
  if (tasks.length === 0) return null;
  return <section className="lf-money-subgroup" data-chores={group} aria-labelledby={id}>
    <h3 id={id} data-copy-role="heading">{heading}</h3>
    <ul className="lf-console-list">
      {tasks.map((task) => <li key={task.id} className="lf-console-item" data-task-id={task.id} data-status={task.status}>
        <div className="lf-console-row">
          <div>
            <span className="ugc lf-money-title" data-copy-role="data">{task.title}</span>
            <span className="ugc lf-console-muted" data-copy-role="data">{names.get(task.assignedTo) ?? ''}</span>
          </div>
          {task.hasEvidence ? <PhotoView task={task} photos={photos}
            copy={{ ...copy, failed: copy.photoFailed, retry: copy.photoRetry, close: copy.photoClose }} /> : null}
        </div>
        <ChoreChips task={task} copy={copy} />
        {task.childNote && task.status === 'done' ? <p className="lf-money-quote">
          <span data-copy-role="body">{copy.noteLabel}</span> <span className="ugc" data-copy-role="data">{task.childNote}</span>
        </p> : null}
        {task.status === 'cancelled' && task.cancelReason ? <p className="lf-money-quote">
          <span data-copy-role="body">{copy.reasonLabel}</span> <span className="ugc" data-copy-role="data">{task.cancelReason}</span>
        </p> : null}
      </li>)}
    </ul>
  </section>;
}

function RewardList({ copy, transport, rewards, onChanged }: {
  copy: TutorTasksCopy; transport: ConsoleTransport; rewards: Reward[]; onChanged: (reward: Reward, added: boolean) => void;
}) {
  const heading = useId();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  async function toggle(reward: Reward) {
    if (busy) return;
    setBusy(reward.id); setNotice(null);
    const result = await setRewardOffered(transport, reward.id, !reward.active);
    setBusy(null);
    // The switch never flips before Core confirms; a failure keeps the confirmed state and says so.
    if (!result.ok) { setNotice({ text: copy.toggleFailed, error: true }); return; }
    onChanged(result.data, false);
  }

  return <section className="lf-console-group" data-family-part="rewards" aria-labelledby={heading}>
    <h2 id={heading} data-copy-role="heading">{copy.rewardsTitle}</h2>
    <Copy role="body">{copy.rewardsBody}</Copy>
    {notice ? <InlineNotice tone={notice.error ? 'error' : 'success'} live>{notice.text}</InlineNotice> : null}
    {rewards.length === 0 ? <Copy role="body">{copy.rewardsEmpty}</Copy> : <ul className="lf-console-list">
      {rewards.map((reward) => <li key={reward.id} className="lf-console-item" data-reward-id={reward.id} data-offered={reward.active}>
        <div className="lf-console-row">
          <div><span className="ugc lf-money-title" data-copy-role="data">{reward.title}</span></div>
          <RewardChip>{coinWord(copy, reward.cost)}</RewardChip>
        </div>
        <div className="lf-console-row">
          <div><Chip tone={reward.active ? 'success' : 'primary'} glyph={reward.active ? 'check' : 'pause'} role="option">{reward.active ? copy.offered : copy.paused}</Chip></div>
          <Button size="sm" pending={busy === reward.id} disabled={busy !== null && busy !== reward.id}
            onClick={() => void toggle(reward)}>{reward.active ? copy.pause : copy.offer}</Button>
        </div>
      </li>)}
    </ul>}
    <AddReward copy={copy} transport={transport} onAdded={(reward) => { setNotice({ text: copy.added, error: false }); onChanged(reward, true); }} />
  </section>;
}

function AddReward({ copy, transport, onAdded }: { copy: TutorTasksCopy; transport: ConsoleTransport; onAdded: (reward: Reward) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [cost, setCost] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amount = /^\d{1,3}$/.test(cost.trim()) ? Number(cost.trim()) : null;
  const ready = title.trim().length > 0 && amount !== null && amount >= 1 && amount <= REWARD_COST_MAX;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    // Client validation mirrors Core's (a 1-120 character title, 1-500 whole coins); Core stays the boundary.
    if (!ready) { setError(copy.invalid); return; }
    setBusy(true); setError(null);
    const result = await createReward(transport, { title: title.trim(), cost: amount! });
    setBusy(false);
    if (!result.ok) { setError(result.code === 'VALIDATION_ERROR' ? copy.invalid : copy.failed); return; }
    setTitle(''); setCost(''); setOpen(false);
    onAdded(result.data);
  }

  if (!open) return <ButtonGroup><Button variant="brand" aria-expanded={false} onClick={() => setOpen(true)}>{copy.addReward}</Button></ButtonGroup>;
  return <form className="lf-console-form" data-family-part="add-reward" noValidate onSubmit={(event) => void submit(event)}>
    {error ? <InlineNotice tone="error" live>{error}</InlineNotice> : null}
    <TextField label={copy.rewardName} help={copy.rewardNameHelp} autoComplete="off" maxLength={REWARD_TITLE_MAX} value={title} onChange={(e) => setTitle(e.target.value)} />
    <TextField label={copy.rewardCost} help={copy.rewardCostHelp} type="number" inputMode="numeric" min={1} max={REWARD_COST_MAX} step={1} value={cost}
      onChange={(e) => setCost(e.target.value)} />
    <ButtonGroup>
      <Button type="submit" variant="success" pending={busy} pendingLabel={copy.creating}>{copy.create}</Button>
      <Button onClick={() => { setOpen(false); setError(null); }}>{copy.cancel}</Button>
    </ButtonGroup>
  </form>;
}
