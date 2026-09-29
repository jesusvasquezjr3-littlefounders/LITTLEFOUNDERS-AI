import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import en from '../../i18n/en-US/rebuild-family.json';
import es from '../../i18n/es-MX/rebuild-family.json';
import { parseGuardianGoals } from './coopGuardianGoals';
import { SocialHistory, coopSentence, type SocialHistoryEntry } from '../social/SocialHistory';
import { CoopGoalsConsent, type CoopGoalsList } from './CoopGoalsConsent';

/*
 * E.2 / Law 5 (GAP-FIX-R4): the Tutor sees the goals together a
 * parent-created child is in, and with whom, and the goal events in the
 * child's connection history. Names only where Core named them; a status per
 * person; no progress of any kind.
 */

const GOAL = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ready = { kind: 'ready', ageFits: true, enabled: true, openGoals: 1 } as const;
const goals: CoopGoalsList = { kind: 'ready', goals: [
  { id: GOAL, target: 10, endsAt: '2026-10-04T12:00:00Z', startedByChild: true, childStatus: 'joined',
    people: [{ name: 'Leo', status: 'joined' }, { name: null, status: 'asked' }, { name: 'Mar', status: 'left' }] },
  { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', target: 5, endsAt: '2026-10-10T12:00:00Z', startedByChild: false, childStatus: 'asked',
    people: [{ name: 'Sol', status: 'joined' }] },
] };

function card(list: CoopGoalsList, copy = en.familyCoopGoals, onRetryGoals = vi.fn()) {
  render(<CoopGoalsConsent copy={copy} name="Sofía" locale="en-US" view={ready} goals={list} saving={false} saveFailed={false}
    onChange={vi.fn()} onRetry={vi.fn()} onRetryGoals={onRetryGoals} />);
  return onRetryGoals;
}

describe('the Tutor sees the child\'s goals together', () => {
  it('lists each goal with its target, end date and each person by name or as a private account, with a status', () => {
    card(goals);
    const list = screen.getByRole('region', { name: en.familyCoopGoals.goalsTitle });
    const first = within(list).getAllByRole('listitem').find((item) => item.getAttribute('data-coop-goal') === GOAL)!;
    expect(first.textContent).toContain('10 lessons together by');
    expect(first.textContent).toContain('Sofía started it.');
    const people = within(first).getByRole('list', { name: en.familyCoopGoals.people });
    expect(within(people).getAllByRole('listitem').map((row) => row.textContent)).toEqual(['LeoJoined', 'Private accountAsked', 'MarLeft']);
    expect(screen.getByText('Sofía was asked to join.')).toBeTruthy();
    // No progress anywhere: the only numbers are the targets and dates.
    expect(list.textContent).not.toMatch(/\bof\b|done|rank|score/i);
    for (const element of list.querySelectorAll('p, h4, [data-copy-role]')) expect(element.getAttribute('data-copy-role')).toBeTruthy();
  });

  it('says when the child is in no goal, and offers a retry when the goals could not load', () => {
    card({ kind: 'ready', goals: [] });
    expect(screen.getByText('Sofía is in no goals right now.')).toBeTruthy();
    const retry = card({ kind: 'failed' });
    expect(screen.getByText(en.familyCoopGoals.goalsFailed)).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: en.familyCoopGoals.retry }).at(-1)!);
    expect(retry).toHaveBeenCalled();
  });

  it('shows nothing when the read does not apply (a self-managed teen)', () => {
    card({ kind: 'none' });
    expect(screen.queryByText(en.familyCoopGoals.goalsTitle)).toBeNull();
  });

  it('reads in es-MX', () => {
    card(goals, es.familyCoopGoals);
    expect(screen.getByText('Sofía la empezó.')).toBeTruthy();
    expect(screen.getAllByText('Cuenta privada').length).toBe(1);
  });

  it('refuses a malformed goals answer instead of showing part of it', () => {
    const good = { goals: [{ id: GOAL, target: 10, endsAt: '2026-10-04T12:00:00Z', startedByChild: true, childStatus: 'joined', people: [{ name: null, status: 'asked' }] }] };
    expect(parseGuardianGoals(good)).toHaveLength(1);
    expect(parseGuardianGoals({ goals: [{ ...good.goals[0], people: [{ name: 'Leo', status: 'winning' }] }] })).toBeNull();
    expect(parseGuardianGoals({ goals: [{ ...good.goals[0], childStatus: 'invited' }] })).toBeNull();
    expect(parseGuardianGoals({})).toBeNull();
  });
});

describe('goal events in the child\'s connection history', () => {
  const entry = (over: Partial<SocialHistoryEntry>): SocialHistoryEntry => ({ id: 1, action: 'social.coop_member_joined', sourceName: 'Sofía', targetName: 'Sofía',
    createdAt: '2026-09-22T10:00:00Z', ...over });

  it('maps every goal event and ending to one sentence', () => {
    expect(coopSentence(entry({ action: 'social.coop_member_ended', reason: 'removed' }))).toBe('coopRemoved');
    expect(coopSentence(entry({ action: 'social.coop_member_ended', reason: 'guardian_off' }))).toBe('coopEnded');
    expect(coopSentence(entry({ action: 'social.coop_goal_closed' }))).toBe('coopClosed');
    expect(coopSentence(entry({ action: 'social.follow' }))).toBeNull();
  });

  it('renders goal events as sentences, and a hidden person as private', () => {
    render(<SocialHistory copy={en.socialHistory} locale="en-US" dark={false} open entries={[
      entry({ id: 3, action: 'social.coop_member_invited', targetName: null }),
      entry({ id: 2, action: 'social.coop_goal_closed', sourceName: null, targetName: null }),
      entry({ id: 1, action: 'social.follow', targetName: 'Leo' }),
    ]} loading={false} failed={false} hasMore={false} onToggle={vi.fn()} onMore={vi.fn()} onRetry={vi.fn()} />);
    expect(screen.getByText(`Sofía asked ${en.socialHistory.hidden} to a goal together.`)).toBeTruthy();
    expect(screen.getByText('A goal together ended.')).toBeTruthy();
    expect(screen.getByText(en.socialHistory.follow)).toBeTruthy();
  });
});
