import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Chip, Copy, DashboardLayout, EmptyState, RewardChip } from '../../design/controls';
import type { ConsoleTransport } from '../console/consoleApi';
import { ConsoleLink, FailureState, PageLoading, type ConsoleLocale, type PageFailure } from '../console/consoleParts';
import { DEFAULT_REGISTER, REGISTER_BAND, type MoneyRegister } from '../moneyRegister';
import { childChores, fetchChildBoard, fetchRegister, type ChildBoard, type PhotoPort, type Reward, type Task } from './tasksApi';
import { ChoreChips, coinWord, PhotoPicker, PocketRow, type ChildTasksCopy } from './taskParts';
import '../../design/tokens.css';
import '../../design/system.css';
import '../console/console.css';
import './money.css';
import { FAMILY_WALLET_PATH } from '@/rebuild/banking/walletPath';

/*
 * F4-K, the child's Tasks board (W2F.2), for a parent-created child or a
 * self-registered teen who linked a verified parent (OD-3 Option B: Tasks
 * and anything a parent approves stay guardian-only, so an unlinked teen
 * never reaches this route; Core refuses them with GUARDIAN_LINK_REQUIRED).
 *
 * What to DO first, then what the child is working toward (03 §3.3; one
 * column below 840 px, in that reading order): coins waiting to be split
 * (D.13, pre-split by the child's own usual split), the chores (to do, then
 * waiting for approval; a photo when one is asked for; "done" with the
 * child's own note: D.17, D.18), the rewards a Tutor offers (asked for with a
 * reason, D.18; the independence level may pre-approve, D.17). Beside them:
 * the pockets, the forgiving chore streak (D.2: two rest days a week, only
 * 7/30/100 celebrate, OD-7), the child's level and the notes on their
 * decisions, the usual split, the goals with provenance (D.15, D.16), the
 * Share places (D.14) and the history with every Tutor reason.
 *
 * D.12: the age register comes from Core (decided by the database from age
 * evidence, never role), presented as the young register until it is known.
 * This screen's own words are written to the youngest band's budget, so they
 * read plainly at every age; `data-age-band` lets the Copy Budget audit apply
 * that band's limits. The wave-1 surfaces carry their own register policy.
 *
 * The wave-1 surfaces keep their own data planes and arrive as slots; the
 * per-chore and per-reward ones are functions of the item and a callback
 * that re-reads this board. Nothing celebrates here except what the streak
 * and a reached goal already celebrate (the OD-7 list).
 */

export interface ChildTasksSlots {
  streak: ReactNode;
  level: ReactNode;
  notes: ReactNode;
  usualSplit: ReactNode;
  goals: ReactNode;
  share: ReactNode;
  history: ReactNode;
  /** S07.5 (D.17, D.18): mark one chore done, with an optional note. `changed` re-reads this board. */
  done: (task: Task, changed: () => void) => ReactNode;
  /** S07.4 (D.13): split one approved chore's coins. */
  split: (task: Task, changed: () => void) => ReactNode;
  /** S07.5 (D.18): ask for one reward, with a reason; `affordable` is what the Spend pocket covers now. */
  ask: (reward: Reward, affordable: boolean, changed: () => void) => ReactNode;
}

/** Core's refusals that mean this account has no family wallet here (OD-3 Option B: Tasks and family coins need a linked parent). */
const REFUSED = new Set(['GUARDIAN_LINK_REQUIRED', 'WALLET_UNAVAILABLE']);

type Load = { status: 'loading' } | { status: 'failed'; failure: PageFailure } | { status: 'ready'; board: ChildBoard };

export function ChildTasks({ copy, locale, dark, transport, photos, onNavigate, refreshKey = 0, slots }: {
  copy: ChildTasksCopy;
  locale: ConsoleLocale;
  dark: boolean;
  transport: ConsoleTransport;
  photos: PhotoPort;
  onNavigate: (href: string) => void;
  refreshKey?: number;
  slots: ChildTasksSlots;
}) {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [register, setRegister] = useState<MoneyRegister>(DEFAULT_REGISTER);
  const [retrying, setRetrying] = useState(false);
  const [version, setVersion] = useState(0);
  // A chore marked done in this visit keeps its "done" control, so its answer (sent, or counted at once) stays in view and announced.
  const [marked, setMarked] = useState<ReadonlySet<string>>(new Set());
  const generation = useRef(0);

  const read = useCallback(async () => {
    const current = ++generation.current;
    const board = await fetchChildBoard(transport);
    if (current !== generation.current) return;
    setRetrying(false);
    if (!board.ok) {
      setLoad((previous) => previous.status === 'ready' ? previous : { status: 'failed', failure: { code: board.code } });
      return;
    }
    setLoad({ status: 'ready', board: board.data });
  }, [transport]);

  useEffect(() => {
    void read();
    return () => { generation.current++; };
  }, [read, refreshKey, version]);

  useEffect(() => {
    let live = true;
    void fetchRegister(transport).then((result) => { if (live && result.ok) setRegister(result.data); });
    return () => { live = false; };
  }, [transport]);

  const changed = useCallback(() => setVersion((value) => value + 1), []);

  const root = (body: ReactNode) => <div className="lf-rebuild lf-family-console lf-family-money" data-screen="child-tasks" data-theme={dark ? 'dark' : 'light'}
    data-age-band={REGISTER_BAND[register]} data-register={register} lang={locale}>
    <header className="lf-console-header"><h1 data-copy-role="heading">{copy.title}</h1></header>
    {body}
  </div>;

  if (load.status === 'loading') return root(<PageLoading label={copy.loading} />);
  if (load.status === 'failed') {
    // Core refused this account (no linked parent, or no family wallet): say why and offer the way back, never "try again".
    if (REFUSED.has(load.failure.code)) {
      return root(<EmptyState heading={copy.refusedTitle} action={<ConsoleLink href="/learn" onNavigate={onNavigate} variant="accent">{copy.refusedAction}</ConsoleLink>} />);
    }
    return root(<FailureState failure={load.failure} copy={copy} retrying={retrying} onRetry={() => { setRetrying(true); void read(); }} />);
  }

  const { board } = load;
  const chores = childChores(board.tasks);
  return root(<DashboardLayout
    primary={<>
      {/* Each waiting payout already says what it is and how many coins wait ("10 coins to split"): the group is named, not titled, to keep the first view short (06 §3.1). */}
      {chores.toSplit.length > 0 ? <section className="lf-console-group" data-family-part="payouts" aria-label={copy.payoutsTitle}>
        {chores.toSplit.map((task) => <div key={task.id} className="lf-money-slot" data-task-id={task.id}>{slots.split(task, changed)}</div>)}
      </section> : null}
      <Group id="chores" heading={copy.choresTitle}>
        {chores.todo.length === 0 ? <Copy role="body">{copy.empty}</Copy> : <ul className="lf-console-list">
          {chores.todo.map((task) => <li key={task.id} className="lf-console-item" data-task-id={task.id} data-status={task.status}>
            <span className="ugc lf-money-title" data-copy-role="data">{task.title}</span>
            {/* An open chore's state is its "done" control; the chip says what is not obvious (waiting for approval). */}
            <ChoreChips task={task} copy={copy} showOpen={false} />
            <div className="lf-money-actions">
              {/* A photo can be added or replaced until a Tutor decides (Core refuses it after); the Tutor views it on their board. */}
              <PhotoPicker task={task} photos={photos} copy={copy} onUploaded={changed} />
            </div>
            {task.status === 'open' || marked.has(task.id) ? <div className="lf-money-chore-controls">{slots.done(task, () => {
              setMarked((previous) => new Set(previous).add(task.id));
              changed();
            })}</div> : null}
          </li>)}
        </ul>}
      </Group>
      {/* No reward offered yet: nothing to act on, so no group (the Tutor's list appears here once there is one). */}
      {board.rewards.length === 0 ? null : <Group id="rewards" heading={copy.rewardsTitle}>
        <ul className="lf-console-list">
          {board.rewards.map((reward) => {
            const asked = board.requests.some((request) => request.catalogId === reward.id && request.status === 'requested');
            const affordable = board.pockets.spend >= reward.cost;
            return <li key={reward.id} className="lf-console-item" data-reward-id={reward.id}>
              <div className="lf-console-row">
                <div><span className="ugc lf-money-title" data-copy-role="data">{reward.title}</span></div>
                <RewardChip coin>{coinWord(copy, reward.cost)}</RewardChip>
              </div>
              {asked ? <div><Chip tone="warning" glyph="pause" role="option">{copy.asked}</Chip></div> : <>
                {!affordable ? <Copy role="body">{copy.notEnough}</Copy> : null}
                <div className="lf-money-chore-controls">{slots.ask(reward, affordable, changed)}</div>
              </>}
            </li>;
          })}
        </ul>
      </Group>}
    </>}
    secondary={<>
      <PocketRow pockets={board.pockets} copy={copy} heading={copy.pocketsTitle}
        action={<div className="lf-money-link"><ConsoleLink href={FAMILY_WALLET_PATH} onNavigate={onNavigate}>{copy.walletLink}</ConsoleLink></div>} />
      <div className="lf-money-slot">{slots.streak}</div>
      <div className="lf-money-slot">{slots.level}</div>
      <div className="lf-money-slot">{slots.notes}</div>
      <div className="lf-money-slot">{slots.usualSplit}</div>
      <div className="lf-money-slot">{slots.goals}</div>
      <div className="lf-money-slot">{slots.share}</div>
      <div className="lf-money-slot">{slots.history}</div>
    </>} />);
}

function Group({ id, heading, children }: { id: string; heading: string; children: ReactNode }) {
  const headingId = useId();
  return <section className="lf-console-group" data-family-part={id} aria-labelledby={headingId}>
    <h2 id={headingId} data-copy-role="heading">{heading}</h2>
    {children}
  </section>;
}
