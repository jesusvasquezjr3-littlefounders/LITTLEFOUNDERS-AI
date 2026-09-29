import type { CoopGuardianGoal } from './CoopGoalsConsent';

/*
 * E.2 / Law 5 (GAP-FIX-R4): the shape of Core's GET /family/kids/:kidId/coop-goals
 * answer, checked whole. A malformed answer is a failure with a retry, never a
 * partly shown list.
 */
const STATUSES = ['asked', 'joined', 'left'];

export function parseGuardianGoals(raw: unknown): CoopGuardianGoal[] | null {
  const goals = (raw as { goals?: unknown } | null)?.goals;
  if (!Array.isArray(goals)) return null;
  const out: CoopGuardianGoal[] = [];
  for (const goal of goals as Record<string, unknown>[]) {
    if (!goal || typeof goal.id !== 'string' || !Number.isInteger(goal.target) || typeof goal.endsAt !== 'string' || !Number.isFinite(Date.parse(goal.endsAt))
      || typeof goal.startedByChild !== 'boolean' || (goal.childStatus !== 'asked' && goal.childStatus !== 'joined') || !Array.isArray(goal.people)) return null;
    const people = (goal.people as Record<string, unknown>[]).map((person) => person && (person.name === null || typeof person.name === 'string')
      && typeof person.status === 'string' && STATUSES.includes(person.status) ? { name: person.name as string | null, status: person.status as 'asked' | 'joined' | 'left' } : null);
    if (people.includes(null)) return null;
    out.push({ id: goal.id, target: goal.target as number, endsAt: goal.endsAt, startedByChild: goal.startedByChild, childStatus: goal.childStatus,
      people: people as CoopGuardianGoal['people'] });
  }
  return out;
}
