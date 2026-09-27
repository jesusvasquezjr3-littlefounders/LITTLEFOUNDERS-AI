import type { Together, TogetherPerson, TogetherState } from './together';

/* L-04 (OD-27 (1)): preview and test fixtures for goals together. Cartoon option sets only; no real person. */

const person = (username: string, displayName: string, isSelf = false): TogetherPerson => ({ username, displayName, avatarOptions: { seed: username }, isSelf });
const inDays = (days: number) => new Date(Date.UTC(2026, 9, 1 + days)).toISOString();

export const togetherCandidatesFixture: TogetherPerson[] = [person('luz_m', 'Luz'), person('mar_17', 'Mar'), person('teo_x', 'Teo')];

export function togetherFixture(kind: 'ready' | 'empty' | 'reached' = 'ready'): Together {
  const options = { targets: [5, 10, 15, 20, 30, 40], days: [7, 14, 28], maxPeople: 5 };
  if (kind === 'empty') return { eligible: true, options, goals: [], invitations: [], finished: [] };
  return {
    eligible: true,
    options,
    goals: [{
      id: '11111111-1111-4111-8111-111111111111', kind: 'lessons', target: 10, startsAt: inDays(-4), endsAt: inDays(10), createdByMe: true,
      done: kind === 'reached' ? 11 : 4, reached: kind === 'reached',
      members: [person('sofia_r', 'Sofía', true), person('luz_m', 'Luz')], invited: [{ ...person('teo_x', 'Teo'), mine: true }], canInvite: true,
    }],
    invitations: kind === 'ready' ? [{
      goalId: '22222222-2222-4222-8222-222222222222', kind: 'lessons', target: 5, endsAt: inDays(7), invitedBy: person('mar_17', 'Mar'),
      members: [person('mar_17', 'Mar')],
    }] : [],
    finished: [{ id: '33333333-3333-4333-8333-333333333333', kind: 'lessons', target: 15, endsAt: inDays(-2), done: 12, reached: false }],
  };
}

export const togetherPreviewStates: Record<string, TogetherState> = {
  ready: { status: 'ready', value: togetherFixture('ready') },
  empty: { status: 'ready', value: togetherFixture('empty') },
  reached: { status: 'ready', value: togetherFixture('reached') },
  closed: { status: 'ready', value: { ...togetherFixture('empty'), eligible: false } },
  loading: { status: 'loading' },
  error: { status: 'error' },
  offline: { status: 'offline' },
};
