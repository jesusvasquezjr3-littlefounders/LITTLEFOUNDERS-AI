import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { Button, Copy, DestructiveAction, ErrorState, InlineNotice, LoadingState, TextField } from '../design/controls';
import { GoalNextStep, type GoalNextStepCopy } from './GoalNextStep';
import { GoalProgress, type GoalProgressCopy } from './GoalProgress';
import { GOAL_TARGET_MAX, GOAL_TITLE_MAX, nextStepDue, type HabitGoal } from './moneyHabitsApi';
import '../design/tokens.css';
import '../design/system.css';
import './familyHub.css';
import './familyMoney.css';
import './moneyHabits.css';

/*
 * S07.4: the child's savings goals (a child in a family; the teen wallet uses
 * the same pieces). Every bar shows its provenance (D.16); a reached goal
 * whose next step is still due carries the celebration and the next-goal
 * prompt (D.15). Putting a goal away asks first. Copy: youngest band (6-9).
 */

export interface SavingsGoalsCopy {
  heading: string; empty: string; add: string; name: string; target: string; create: string; creating: string; invalid: string;
  archive: string; archiveHeading: string; archiveConfirm: string; keep: string; reached: string; loading: string; failed: string; retry: string;
  putIn: string; takeOut: string; edit: string; editTitle: string; editSave: string; editName: string; editTarget: string; more: string;
}

export function SavingsGoals({ compact = false, startAdding = false, copy, progressCopy, nextCopy, locale, dark, goals, loading, failed, busy, notice, nextNotice,
  onRetry, onCreate, onArchive, onEdit, onMove, headingAction, onSeen, onStartNext, onNotNow }: {
  /** The wallet home's glance: the first two goals as cards, nothing to press. */
  compact?: boolean;
  /** Open with the new-goal form showing (the wallet's "New goal" quick action). */
  startAdding?: boolean;
  copy: SavingsGoalsCopy;
  progressCopy: GoalProgressCopy;
  nextCopy: GoalNextStepCopy;
  locale: string;
  dark: boolean;
  goals: HabitGoal[];
  loading: boolean;
  failed: boolean;
  busy: boolean;
  notice: { text: string; error: boolean } | null;
  nextNotice: { goalId: string; text: string; error: boolean } | null;
  onRetry: () => void;
  onCreate: (input: { title: string; target: number }) => void;
  onArchive: (goal: HabitGoal) => void;
  /** Rename a goal or change what it needs; a goal you reached keeps its target (the server says so). */
  onEdit?: (goal: HabitGoal, input: { title: string; target: number }) => void;
  /** Put coins in, or take them out: opens the wallet's move dialog already pointed at this goal. */
  onMove?: (goal: HabitGoal, direction: 'in' | 'out') => void;
  /** Sits at the end of the heading row (the wallet home's "See all"). */
  headingAction?: ReactNode;
  onSeen: (goal: HabitGoal) => Promise<boolean>;
  onStartNext: (goal: HabitGoal, input: { title: string; target: number }) => void;
  onNotNow: (goal: HabitGoal) => void;
}) {
  const headingId = useId();
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [adding, setAdding] = useState(startAdding);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const [editInvalid, setEditInvalid] = useState(false);
  const all = goals.filter((g) => g.status !== 'archived');
  const shown = compact ? all.slice(0, 2) : all;

  function submit(event: FormEvent) {
    event.preventDefault();
    const title = name.trim();
    const coins = /^\d{1,6}$/.test(target.trim()) ? Number(target.trim()) : null;
    if (!title || title.length > GOAL_TITLE_MAX || coins === null || coins < 1 || coins > GOAL_TARGET_MAX) { setInvalid(true); return; }
    setInvalid(false);
    onCreate({ title, target: coins });
    setName(''); setTarget('');
    setAdding(false);
  }

  function startEdit(goal: HabitGoal) { setEditing(goal.id); setEditName(goal.title); setEditTarget(String(goal.target)); setEditInvalid(false); }

  function submitEdit(event: FormEvent, goal: HabitGoal) {
    event.preventDefault();
    const title = editName.trim();
    const coins = /^\d{1,6}$/.test(editTarget.trim()) ? Number(editTarget.trim()) : null;
    if (!title || title.length > GOAL_TITLE_MAX || coins === null || coins < 1 || coins > GOAL_TARGET_MAX) { setEditInvalid(true); return; }
    setEditInvalid(false);
    onEdit?.(goal, { title, target: coins });
    setEditing(null);
  }

  return <section className="lf-rebuild lf-family-hub lf-money-habits lf-goals-section" data-money-habits="savings-goals" data-theme={dark ? 'dark' : 'light'} lang={locale}
    aria-labelledby={headingId}>
    <div className="lf-goals-head"><h2 id={headingId} data-copy-role="heading">{copy.heading}</h2>{headingAction}</div>
    {failed ? <ErrorState heading={copy.failed} retryLabel={copy.retry} retryingLabel={copy.loading} onRetry={onRetry} />
      : loading ? <LoadingState label={copy.loading} lines={2} /> : <>
      {/* What happened to a goal (made, changed, removed, and where its coins went) is said where the goals are, never only inside a closed form. */}
      {notice && <InlineNotice tone={notice.error ? 'error' : 'success'} live>{notice.text}</InlineNotice>}
      {shown.length === 0 ? <Copy role="body">{copy.empty}</Copy> : <ul className="lf-goal-cards">
        {shown.map((goal) => <li key={goal.id} className="lf-goal-card" data-goal-status={goal.status}>
          <div className="lf-goal-card-head">
            <span className="ugc lf-goal-card-title" data-copy-role="data">{goal.title}</span>
            {goal.status === 'reached' && <span className="lf-money-habits-chip" data-copy-role="option">{copy.reached}</span>}
          </div>
          <GoalProgress copy={progressCopy} title={goal.title} target={goal.target} progress={goal.progress} ring={!compact} compact={compact} />
          {!compact && nextStepDue(goal) && <GoalNextStep copy={nextCopy} goal={goal} busy={busy}
            notice={nextNotice && nextNotice.goalId === goal.id ? nextNotice : null}
            onSeen={() => onSeen(goal)} onStart={(input) => onStartNext(goal, input)} onNotNow={() => onNotNow(goal)} />}
          {/* The two things you do with a goal are on the card: put coins in, take coins out. The rest is one tap away. */}
          {onMove && editing !== goal.id && <div className="lf-goal-card-actions">
            {goal.status === 'active' && <Button size="sm" variant={compact ? undefined : 'accent'} disabled={busy} onClick={() => onMove(goal, 'in')}>{copy.putIn}</Button>}
            {!compact && goal.saved > 0 && <Button size="sm" disabled={busy} onClick={() => onMove(goal, 'out')}>{copy.takeOut}</Button>}
          </div>}
          {!compact && editing === goal.id && <form className="lf-goal-form lf-goal-form--inline" onSubmit={(event) => submitEdit(event, goal)} noValidate>
            <h3 data-copy-role="heading">{copy.editTitle}</h3>
            <div className="lf-family-money-row">
              <TextField label={copy.editName} autoComplete="off" maxLength={GOAL_TITLE_MAX} value={editName} disabled={busy} onChange={(event) => setEditName(event.target.value)} />
              <TextField label={copy.editTarget} type="number" inputMode="numeric" min={1} max={GOAL_TARGET_MAX} step={1} value={editTarget} disabled={busy || goal.status === 'reached'}
                onChange={(event) => setEditTarget(event.target.value)} />
            </div>
            {editInvalid && <InlineNotice tone="error" live>{copy.invalid}</InlineNotice>}
            <div className="lf-family-hub-actions">
              <Button type="submit" variant="success" pending={busy}>{copy.editSave}</Button>
              <Button disabled={busy} onClick={() => setEditing(null)}>{copy.keep}</Button>
            </div>
          </form>}
          {!compact && editing !== goal.id && <div className="lf-goal-card-more">
            <details className="lf-wallet-how"><summary data-copy-role="action">{copy.more}</summary>
              <div className="lf-family-hub-actions">
                {onEdit && <Button size="sm" disabled={busy} onClick={() => startEdit(goal)}>{copy.edit}</Button>}
                {/* Removing a goal always asks first; its seeds go back to Save in the same step. */}
                <DestructiveAction label={copy.archive} size="sm" disabled={busy}
                  confirm={{ heading: copy.archiveHeading, consequence: copy.archiveConfirm, keepLabel: copy.keep, confirmLabel: copy.archive }}
                  onConfirm={() => onArchive(goal)} />
              </div>
            </details>
          </div>}
        </li>)}
        {/* A new goal is a tile in the grid, not a form always on show. */}
        {!compact && !adding && <li className="lf-goal-add"><Button variant="brand" size="lg" onClick={() => setAdding(true)}>{`+ ${copy.add}`}</Button></li>}
      </ul>}
      {!compact && (adding || shown.length === 0) && <form className="lf-goal-form" onSubmit={submit} noValidate>
        <div className="lf-family-money-row">
          <TextField label={copy.name} autoComplete="off" maxLength={GOAL_TITLE_MAX} value={name} disabled={busy} onChange={(event) => setName(event.target.value)} />
          <TextField label={copy.target} type="number" inputMode="numeric" min={1} max={GOAL_TARGET_MAX} step={1} value={target} disabled={busy}
            onChange={(event) => setTarget(event.target.value)} />
        </div>
        {/* One sentence for both fields: a goal needs a name and a whole number of coins. */}
        {invalid && <InlineNotice tone="error" live>{copy.invalid}</InlineNotice>}
        <div className="lf-family-hub-actions"><Button type="submit" variant="accent" pending={busy} pendingLabel={copy.creating}>{copy.create}</Button></div>
      </form>}
    </>}
  </section>;
}
