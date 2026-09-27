import { z } from 'zod';
import { failureOf, type Failure } from './learnHome';

/*
 * L-04 (owner decision OD-27 (1)): teen cooperative goals, the client side of
 * /api/v1/coop-goals. Core and the database decide everything: who may take
 * part (13 to 17, a Tutor's opt-in for a parent-created child), who may be
 * asked (mutual connections of every member), the group size, the group total.
 * The client validates the shape and renders it; it never re-derives a rule.
 * A malformed answer is unavailable, never partly shown. Transport is
 * injected, so this module imports nothing from the legacy app (Bible 02
 * rule 23).
 *
 * There is nothing here to send a person: no text field, no note, no message
 * (E.10). The only progress is the group total; no member has a number.
 */

export interface TogetherTransport {
  (path: string, init?: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown }): Promise<{ data: unknown; error: { code: string } | null }>;
}

const person = z.object({
  username: z.string().regex(/^[a-z0-9_]{3,20}$/),
  displayName: z.string(),
  avatarOptions: z.record(z.string(), z.unknown()),
  isSelf: z.boolean(),
});
export type TogetherPerson = z.infer<typeof person>;

const goal = z.object({
  id: z.string().uuid(), kind: z.literal('lessons'), target: z.number().int().positive(), startsAt: z.string(), endsAt: z.string(),
  createdByMe: z.boolean(), done: z.number().int().nonnegative(), reached: z.boolean(),
  members: z.array(person), invited: z.array(person.extend({ mine: z.boolean() })), canInvite: z.boolean(),
});
export type TogetherGoal = z.infer<typeof goal>;

const invitation = z.object({
  goalId: z.string().uuid(), kind: z.literal('lessons'), target: z.number().int().positive(), endsAt: z.string(),
  invitedBy: person.nullable(), members: z.array(person),
});
export type TogetherInvitation = z.infer<typeof invitation>;

export const togetherSchema = z.object({
  eligible: z.boolean(),
  options: z.object({ targets: z.array(z.number().int().positive()).min(1), days: z.array(z.number().int().positive()).min(1), maxPeople: z.number().int().min(2) }),
  goals: z.array(goal),
  invitations: z.array(invitation),
  finished: z.array(z.object({ id: z.string().uuid(), kind: z.literal('lessons'), target: z.number().int().positive(), endsAt: z.string(), done: z.number().int().nonnegative(), reached: z.boolean() })),
});
export type Together = z.infer<typeof togetherSchema>;
export type TogetherState = { status: 'loading' } | { status: 'ready'; value: Together } | { status: Failure };

export async function fetchTogether(request: TogetherTransport): Promise<TogetherState> {
  let response: Awaited<ReturnType<TogetherTransport>>;
  try { response = await request('/coop-goals'); } catch { return { status: 'offline' }; }
  if (response.error) return { status: failureOf(response.error.code) };
  const parsed = togetherSchema.safeParse(response.data);
  return parsed.success ? { status: 'ready', value: parsed.data } : { status: 'error' };
}

/** People who may be asked (Core's list). null: unavailable. */
export async function fetchCandidates(request: TogetherTransport): Promise<TogetherPerson[] | null> {
  try {
    const response = await request('/coop-goals/candidates');
    if (response.error) return null;
    const parsed = z.object({ people: z.array(person) }).safeParse(response.data);
    return parsed.success ? parsed.data.people : null;
  } catch { return null; }
}

/** What an action came back as: done, or which refusal the screen names. */
export type TogetherOutcome = 'done' | 'member-unavailable' | 'full' | 'limit' | 'already-asked' | 'not-eligible' | 'gone' | 'failed';

function outcomeOf(code: string): TogetherOutcome {
  switch (code) {
    case 'COOP_MEMBER_UNAVAILABLE': return 'member-unavailable';
    case 'COOP_GROUP_FULL': return 'full';
    case 'COOP_GOAL_LIMIT': return 'limit';
    case 'COOP_ALREADY_ASKED': return 'already-asked';
    case 'COOP_NOT_ELIGIBLE': return 'not-eligible';
    case 'NOT_FOUND': return 'gone';
    default: return 'failed';
  }
}

async function act(request: TogetherTransport, path: string, method: 'POST' | 'DELETE', body?: unknown): Promise<TogetherOutcome> {
  try {
    const response = await request(path, { method, body });
    return response.error ? outcomeOf(response.error.code) : 'done';
  } catch { return 'failed'; }
}

const at = (goalId: string) => `/coop-goals/${encodeURIComponent(goalId)}`;

export const startGoal = (request: TogetherTransport, target: number, days: number, invite: string[]) =>
  act(request, '/coop-goals', 'POST', { target, days, invite });
export const askSomeone = (request: TogetherTransport, goalId: string, username: string) =>
  act(request, `${at(goalId)}/invitations`, 'POST', { username });
export const answerInvitation = (request: TogetherTransport, goalId: string, accept: boolean) =>
  act(request, `${at(goalId)}/decision`, 'POST', { decision: accept ? 'accept' : 'decline' });
export const leaveGoal = (request: TogetherTransport, goalId: string) => act(request, `${at(goalId)}/leave`, 'POST');
export const removeFromGoal = (request: TogetherTransport, goalId: string, username: string) =>
  act(request, `${at(goalId)}/members/${encodeURIComponent(username)}`, 'DELETE');
export const reportFromGoal = (request: TogetherTransport, goalId: string, username: string, category: string, note: string | null, leave: boolean) =>
  act(request, `${at(goalId)}/report`, 'POST', { username, category, ...(note ? { note } : {}), leave });

/** Whether the learner home offers the card, and whether someone asked: read quietly (a failure hides the card). */
export async function fetchTogetherTeaser(request: TogetherTransport): Promise<{ eligible: boolean; asked: boolean } | null> {
  const state = await fetchTogether(request);
  return state.status === 'ready' ? { eligible: state.value.eligible, asked: state.value.invitations.length > 0 } : null;
}
