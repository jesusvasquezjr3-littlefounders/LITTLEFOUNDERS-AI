import { useId } from 'react';
import type enFamily from '../../i18n/en-US/rebuild-family.json';
import { Button, Card, InlineNotice, List, ListRow, LoadingState, Pill, Switch } from '../design/controls';
import './console/console.css';

/*
 * L-04 (owner decision OD-27 (1)): the verified Tutor's opt-in for goals
 * together, for a parent-created child aged 13 to 17. Off by default (E.10's
 * pattern for a peer feature: a guardian opt-in per child). The card says
 * what it allows (lesson goals with up to 4 mutual connections) and what it
 * never allows (chat, scores, rankings); turning it off takes the child out of
 * every goal at once, and the card says so before it happens. For a child
 * whose birth date does not prove 13 to 17 the card only says why it is not
 * offered. Core decides every rule again; this is presentation only.
 *
 * E.2 / Law 5 (GAP-FIX-R4): the Tutor also sees each open goal the child is
 * asked to or in: its target and end date, who started it, and each other
 * person by name (or "private account" when the Tutor may not see them) with
 * a status (asked, joined, left). No progress of any kind is shown: the group
 * total belongs to the group, and there is no number per person.
 */

export type CoopGoalsConsentCopy = typeof enFamily.familyCoopGoals;
export type CoopConsentView =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'ready'; ageFits: boolean; enabled: boolean; openGoals: number };

export type CoopPersonStatus = 'asked' | 'joined' | 'left';
export interface CoopGuardianGoal {
  id: string; target: number; endsAt: string; startedByChild: boolean; childStatus: 'asked' | 'joined';
  people: { name: string | null; status: CoopPersonStatus }[];
}
/** The goals read: `none` when it does not apply (a self-managed teen, the opt-in off with nothing open). */
export type CoopGoalsList =
  | { kind: 'none' }
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'ready'; goals: CoopGuardianGoal[] };

function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? String(values[key]) : whole));
}

const STATUS_COPY = { asked: 'statusAsked', joined: 'statusJoined', left: 'statusLeft' } as const;
const STATUS_TONE = { asked: 'sky', joined: 'mint', left: 'berry' } as const;

export function CoopGoalsConsent({ copy, name, locale = 'en-US', view, goals = { kind: 'none' }, saving, saveFailed, onChange, onRetry, onRetryGoals }: {
  copy: CoopGoalsConsentCopy; name: string; locale?: string; view: CoopConsentView; goals?: CoopGoalsList; saving: boolean; saveFailed: boolean;
  onChange: (enabled: boolean) => void; onRetry: () => void; onRetryGoals?: () => void;
}) {
  const noteId = useId();
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  return <Card heading={copy.title} headingLevel={3} as="section">
    <div className="lf-coop-consent" data-console-part="coop-goals">
      {view.kind === 'loading' ? <LoadingState label={copy.loading} lines={2} />
        : view.kind === 'failed' ? <>
          <InlineNotice tone="error">{copy.failed}</InlineNotice>
          <div className="lf-actions"><Button onClick={onRetry}>{copy.retry}</Button></div>
        </>
          : !view.ageFits && !view.enabled ? <p data-copy-role="body">{copy.notTeen}</p>
            : <>
              <p data-copy-role="body">{fill(copy.body, { name })}</p>
              <p data-copy-role="body">{copy.rules}</p>
              <Switch label={copy.label} checked={view.enabled} pending={saving} stateLabels={{ on: copy.on, off: copy.off }}
                help={view.enabled ? fill(copy.offNote, { name }) : undefined} onCheckedChange={onChange} />
              {view.enabled && view.openGoals > 0 && goals.kind !== 'ready' ? <p id={noteId} data-copy-role="body">{fill(copy.active, { name, count: view.openGoals })}</p> : null}
              {saveFailed ? <InlineNotice tone="error" live>{copy.saveFailed}</InlineNotice> : null}
              <GoalsList copy={copy} name={name} date={date} goals={goals} enabled={view.enabled} onRetry={onRetryGoals} />
            </>}
    </div>
  </Card>;
}

function GoalsList({ copy, name, date, goals, enabled, onRetry }: {
  copy: CoopGoalsConsentCopy; name: string; date: Intl.DateTimeFormat; goals: CoopGoalsList; enabled: boolean; onRetry?: () => void;
}) {
  const headingId = useId();
  if (goals.kind === 'none') return null;
  if (goals.kind === 'ready' && goals.goals.length === 0 && !enabled) return null;
  return <section className="lf-coop-goals" data-coop-part="goals" aria-labelledby={headingId}>
    <h4 id={headingId} className="lf-coop-goals-heading" data-copy-role="heading">{copy.goalsTitle}</h4>
    {goals.kind === 'loading' ? <LoadingState label={copy.loading} lines={2} />
      : goals.kind === 'failed' ? <>
        <InlineNotice tone="error">{copy.goalsFailed}</InlineNotice>
        {onRetry ? <div className="lf-actions"><Button onClick={onRetry}>{copy.retry}</Button></div> : null}
      </>
        : goals.goals.length === 0 ? <p data-copy-role="body">{fill(copy.noGoals, { name })}</p>
          : <ul className="lf-coop-goals-list">
            {goals.goals.map((goal) => <li key={goal.id} className="lf-coop-goal" data-coop-goal={goal.id} data-child-status={goal.childStatus}>
              <p className="lf-coop-goal-line" data-copy-role="body">{fill(copy.goalLine, { n: goal.target, date: date.format(new Date(goal.endsAt)) })}</p>
              {goal.childStatus === 'asked' ? <p data-copy-role="body">{fill(copy.asked, { name })}</p>
                : goal.startedByChild ? <p data-copy-role="body">{fill(copy.startedBy, { name })}</p> : null}
              {goal.people.length > 0 ? <List label={copy.people}>
                {goal.people.map((person, index) => <ListRow key={index} title={person.name ?? copy.privatePerson}
                  trailing={<Pill tone={STATUS_TONE[person.status]} role="option">{copy[STATUS_COPY[person.status]]}</Pill>} />)}
              </List> : null}
            </li>)}
          </ul>}
  </section>;
}
