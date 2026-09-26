import { useId, useState, type FormEvent } from 'react';
import { Button, Copy, ErrorState, InlineNotice, LoadingState, TextField } from '../design/controls';
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
  heading: string; empty: string; name: string; target: string; create: string; creating: string; invalid: string;
  archive: string; archiveConfirm: string; keep: string; reached: string; loading: string; failed: string; retry: string;
}

export function SavingsGoals({ copy, progressCopy, nextCopy, locale, dark, goals, loading, failed, busy, notice, nextNotice,
  onRetry, onCreate, onArchive, onSeen, onStartNext, onNotNow }: {
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
  onSeen: (goal: HabitGoal) => Promise<boolean>;
  onStartNext: (goal: HabitGoal, input: { title: string; target: number }) => void;
  onNotNow: (goal: HabitGoal) => void;
}) {
  const headingId = useId();
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const shown = goals.filter((g) => g.status !== 'archived');

  function submit(event: FormEvent) {
    event.preventDefault();
    const title = name.trim();
    const coins = /^\d{1,6}$/.test(target.trim()) ? Number(target.trim()) : null;
    if (!title || title.length > GOAL_TITLE_MAX || coins === null || coins < 1 || coins > GOAL_TARGET_MAX) { setInvalid(true); return; }
    setInvalid(false);
    onCreate({ title, target: coins });
    setName(''); setTarget('');
  }

  return <section className="lf-rebuild lf-family-hub lf-money-habits" data-money-habits="savings-goals" data-theme={dark ? 'dark' : 'light'} lang={locale}
    aria-labelledby={headingId}>
    <h2 id={headingId} data-copy-role="heading">{copy.heading}</h2>
    {failed ? <ErrorState heading={copy.failed} retryLabel={copy.retry} retryingLabel={copy.loading} onRetry={onRetry} />
      : loading ? <LoadingState label={copy.loading} lines={2} /> : <>
      {shown.length === 0 ? <Copy role="body">{copy.empty}</Copy> : <ul>
        {shown.map((goal) => <li key={goal.id} data-goal-status={goal.status}>
          <div className="lf-family-hub-row">
            <span className="ugc" data-copy-role="data">{goal.title}</span>
            {goal.status === 'reached' && <span className="lf-money-habits-chip" data-copy-role="option">{copy.reached}</span>}
          </div>
          <GoalProgress copy={progressCopy} title={goal.title} target={goal.target} progress={goal.progress} />
          {nextStepDue(goal) && <GoalNextStep copy={nextCopy} goal={goal} busy={busy}
            notice={nextNotice && nextNotice.goalId === goal.id ? nextNotice : null}
            onSeen={() => onSeen(goal)} onStart={(input) => onStartNext(goal, input)} onNotNow={() => onNotNow(goal)} />}
          <div className="lf-family-hub-actions">
            {confirming === goal.id ? <>
              <Copy role="body" as="span">{copy.archiveConfirm}</Copy>
              <Button disabled={busy} onClick={() => { setConfirming(null); onArchive(goal); }}>{copy.archive}</Button>
              <Button variant="accent" disabled={busy} onClick={() => setConfirming(null)}>{copy.keep}</Button>
            </> : <Button disabled={busy} onClick={() => setConfirming(goal.id)}>{copy.archive}</Button>}
          </div>
        </li>)}
      </ul>}
      <form onSubmit={submit} noValidate>
        <div className="lf-family-money-row">
          <TextField label={copy.name} autoComplete="off" maxLength={GOAL_TITLE_MAX} value={name} disabled={busy} onChange={(event) => setName(event.target.value)} />
          <TextField label={copy.target} type="number" inputMode="numeric" min={1} max={GOAL_TARGET_MAX} step={1} value={target} disabled={busy}
            onChange={(event) => setTarget(event.target.value)} />
        </div>
        {/* One sentence for both fields: a goal needs a name and a whole number of coins. */}
        {invalid && <InlineNotice tone="error" live>{copy.invalid}</InlineNotice>}
        {notice && <InlineNotice tone={notice.error ? 'error' : 'success'} live>{notice.text}</InlineNotice>}
        <div className="lf-family-hub-actions"><Button type="submit" pending={busy} pendingLabel={copy.creating}>{copy.create}</Button></div>
      </form>
    </>}
  </section>;
}
