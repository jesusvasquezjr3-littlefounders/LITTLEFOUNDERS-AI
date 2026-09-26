import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Button, Celebration, celebrationPart, Copy, InlineNotice, StatusMark, TextField } from '../design/controls';
import { isMilestone } from '../design/milestones';
import { GOAL_TARGET_MAX, GOAL_TITLE_MAX, type HabitGoal } from './moneyHabitsApi';
import '../design/tokens.css';
import '../design/system.css';
import './familyHub.css';
import './familyMoney.css';
import './moneyHabits.css';

/*
 * S07.4 (D.15): "what's your next goal?" at the celebration of a reached goal
 * (Appendix G §2.3, postreward resetting). On its first view the surface asks
 * the server whether this is the moment; only a `true` celebrates, so the
 * OD-7 milestone "savings goal reached" happens once per goal, whoever reloads
 * the page. The moment goes through the shared milestone `Celebration`
 * (S03.7): once per goal, and its final frame under reduced motion. The
 * prompt sits in the same card: start a next goal (it follows
 * this one) or "Not now", which is respected (the prompt does not come back).
 * No lives, no nagging, no Mentor character. Copy: youngest band (6-9).
 */

export interface GoalNextStepCopy {
  milestone: string; reached: string; prompt: string; name: string; target: string; start: string; starting: string; notNow: string;
  invalid: string; failed: string;
}

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

export function GoalNextStep({ copy, goal, busy, notice, onSeen, onStart, onNotNow }: {
  copy: GoalNextStepCopy;
  goal: HabitGoal;
  busy: boolean;
  notice: { text: string; error: boolean } | null;
  /** Records the first view; resolves true exactly once per goal (the server decides). */
  onSeen: () => Promise<boolean>;
  onStart: (input: { title: string; target: number }) => void;
  onNotNow: () => void;
}) {
  const headingId = useId();
  const [celebrate, setCelebrate] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [invalid, setInvalid] = useState(false);
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    void onSeen().then((first) => { if (first && isMilestone('savings-goal-reached')) setCelebrate(true); });
  }, [onSeen]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const title = name.trim();
    const coins = /^\d{1,6}$/.test(target.trim()) ? Number(target.trim()) : null;
    if (!title || title.length > GOAL_TITLE_MAX || coins === null || coins < 1 || coins > GOAL_TARGET_MAX) { setInvalid(true); return; }
    setInvalid(false);
    onStart({ title, target: coins });
  }

  return <section className="lf-money-habits-next" data-money-habits="next-goal" data-goal-id={goal.id} aria-labelledby={headingId}
    data-celebrating={celebrate ? 'savings-goal-reached' : undefined}>
    {celebrate ? <Celebration milestone="savings-goal-reached" momentId={`savings-goal:${goal.id}`}>
      <div className="lf-family-money-milestone" role="status">
        <span {...celebrationPart('pop')}><StatusMark correct /></span><h3 id={headingId} data-copy-role="heading">{fill(copy.milestone, { title: goal.title })}</h3>
      </div>
    </Celebration> : <h3 id={headingId} data-copy-role="heading">{fill(copy.reached, { title: goal.title })}</h3>}
    <Copy role="prompt">{copy.prompt}</Copy>
    <form onSubmit={submit} noValidate>
      <div className="lf-family-money-row">
        <TextField label={copy.name} autoComplete="off" maxLength={GOAL_TITLE_MAX} value={name} disabled={busy} onChange={(event) => setName(event.target.value)} />
        <TextField label={copy.target} type="number" inputMode="numeric" min={1} max={GOAL_TARGET_MAX} step={1} value={target} disabled={busy}
          onChange={(event) => setTarget(event.target.value)} />
      </div>
      {/* One sentence for both fields: a next goal needs a name and a whole number of coins. */}
      {invalid && <InlineNotice tone="error" live>{copy.invalid}</InlineNotice>}
      {notice && <InlineNotice tone={notice.error ? 'error' : 'success'} live>{notice.text}</InlineNotice>}
      <div className="lf-family-hub-actions">
        <Button type="submit" variant="success" pending={busy} pendingLabel={copy.starting}>{copy.start}</Button>
        <Button disabled={busy} onClick={onNotNow}>{copy.notNow}</Button>
      </div>
    </form>
  </section>;
}
