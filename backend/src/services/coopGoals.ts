import { z } from 'zod';
import { serviceRest, serviceRestRaw } from './supabaseRest.js';

/*
 * L-04 (owner decision OD-27 (1)): teen cooperative goals, Core side.
 * Policy: docs/rebuild/policies/SOCIAL-TIERS.md section 1.2.
 *
 * The database owns every rule (migrations teen_cooperative_goals and
 * teen_cooperative_goal_actions): who may take part (the teen tier, or a
 * parent-created child proven 13 to 17 whose verified guardian opted in; never
 * a flagged profile), that every member is a mutual connection of every other
 * member, the 2-to-5 group size, one ask per person per goal, the audit row of
 * every change, and the reconcile step that ends a membership the moment a
 * rule stops holding. Core calls the functions with the service role, always
 * passing the session as the actor, and validates what comes back. An
 * unreadable or malformed answer is `unavailable`, never an empty success.
 *
 * What does not exist, on purpose: a free-text field of any kind (E.10: no
 * name, note or message on a goal), a per-member number, a ranking, a public
 * view, a reward (coins, XP, badge) or a celebration (OD-7's list has no
 * group goal). The group total is the only progress, for members only.
 */

export const COOP_TARGETS = [5, 10, 15, 20, 30, 40] as const;
export const COOP_DAYS = [7, 14, 28] as const;
export const COOP_MAX_MEMBERS = 5;
export const COOP_MAX_INVITEES = COOP_MAX_MEMBERS - 1;

const UUID = z.string().uuid();
const Instant = z.string().min(10).max(40);
const Kind = z.literal('lessons');
const Target = z.number().int().refine((n) => (COOP_TARGETS as readonly number[]).includes(n));
const Count = z.number().int().min(0);

export const CoopOverview = z.object({
  eligible: z.boolean(),
  goals: z.array(z.object({
    id: UUID, kind: Kind, target: Target, startsAt: Instant, endsAt: Instant, createdByMe: z.boolean(), done: Count,
    members: z.array(UUID).min(1).max(COOP_MAX_MEMBERS),
    invited: z.array(z.object({ userId: UUID, mine: z.boolean() }).strict()).max(COOP_MAX_INVITEES),
  }).strict()).max(3),
  invitations: z.array(z.object({
    goalId: UUID, kind: Kind, target: Target, endsAt: Instant, invitedBy: UUID.nullable(),
    members: z.array(UUID).max(COOP_MAX_MEMBERS).nullable(),
  }).strict()).max(200),
  finished: z.array(z.object({ id: UUID, kind: Kind, target: Target, endsAt: Instant, done: Count }).strict()).max(200),
}).strict();
export type CoopOverview = z.infer<typeof CoopOverview>;

export const CoopGuardianView = z.object({ ageFits: z.boolean(), enabled: z.boolean(), openGoals: Count }).strict();
export type CoopGuardianView = z.infer<typeof CoopGuardianView>;

export type CoopRefusal =
  | 'invalid' | 'not-eligible' | 'member-unavailable' | 'goal-limit' | 'group-full' | 'already-asked'
  | 'goal-not-found' | 'invitation-not-found' | 'member-not-found' | 'not-allowed'
  | 'guardian-not-linked' | 'child-not-teen' | 'practice-consent' | 'unavailable';

const REFUSALS: Record<string, CoopRefusal> = {
  COOP_INVALID: 'invalid',
  COOP_NOT_ELIGIBLE: 'not-eligible',
  COOP_MEMBER_UNAVAILABLE: 'member-unavailable',
  COOP_GOAL_LIMIT: 'goal-limit',
  COOP_GROUP_FULL: 'group-full',
  COOP_ALREADY_ASKED: 'already-asked',
  COOP_GOAL_NOT_FOUND: 'goal-not-found',
  COOP_INVITATION_NOT_FOUND: 'invitation-not-found',
  COOP_MEMBER_NOT_FOUND: 'member-not-found',
  COOP_NOT_ALLOWED: 'not-allowed',
  COOP_GUARDIAN_NOT_LINKED: 'guardian-not-linked',
  COOP_CHILD_NOT_TEEN: 'child-not-teen',
  // OD-9 4.2: a migrated child's Tutor has not consented to this sharing surface.
  DATA_PRACTICE_CONSENT_REQUIRED: 'practice-consent',
};

export type CoopResult<T> = { ok: true; value: T } | { ok: false; refusal: CoopRefusal };

const Refusal = z.object({ code: z.literal('P0001'), message: z.string() }).passthrough();

async function call<T>(fn: string, args: Record<string, unknown>, parse: (body: unknown) => T | null): Promise<CoopResult<T>> {
  const result = await serviceRestRaw(`/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });
  if (result.ok) {
    const value = parse(result.body);
    return value === null ? { ok: false, refusal: 'unavailable' } : { ok: true, value };
  }
  const error = Refusal.safeParse(result.body);
  return { ok: false, refusal: (error.success && REFUSALS[error.data.message]) || 'unavailable' };
}

const ids = (...values: string[]) => values.every((v) => UUID.safeParse(v).success);

/** May this account take part right now? null: unreadable (callers refuse). */
export async function readCoopEligible(userId: string): Promise<boolean | null> {
  if (!ids(userId)) return null;
  const body = await serviceRest<unknown>('/rpc/coop_goal_eligible', { method: 'POST', body: JSON.stringify({ p_user: userId }) });
  return typeof body === 'boolean' ? body : null;
}

/** The session's own goals, invitations and finished goals, reconciled first. */
export async function readCoopOverview(userId: string): Promise<CoopResult<CoopOverview>> {
  if (!ids(userId)) return { ok: false, refusal: 'invalid' };
  return call('coop_goal_overview', { p_user: userId }, (body) => {
    const parsed = CoopOverview.safeParse(body);
    return parsed.success ? parsed.data : null;
  });
}

/** Mutual connections who may be asked (eligible and connected), newest first, at most 60. */
export async function readCoopCandidates(userId: string): Promise<string[] | null> {
  if (!ids(userId)) return null;
  const parsed = z.array(UUID).max(60).safeParse(await serviceRest<unknown>('/rpc/coop_goal_candidates', {
    method: 'POST', body: JSON.stringify({ p_user: userId }),
  }));
  return parsed.success ? parsed.data : null;
}

export async function createCoopGoal(creatorId: string, target: number, days: number, inviteeIds: string[]): Promise<CoopResult<string>> {
  if (!ids(creatorId, ...inviteeIds)) return { ok: false, refusal: 'invalid' };
  return call('create_coop_goal', { p_creator: creatorId, p_target: target, p_days: days, p_invitees: inviteeIds }, (body) => {
    const parsed = UUID.safeParse(body);
    return parsed.success ? parsed.data : null;
  });
}

export async function inviteCoopGoalMember(actorId: string, goalId: string, inviteeId: string): Promise<CoopResult<true>> {
  if (!ids(actorId, goalId, inviteeId)) return { ok: false, refusal: 'invalid' };
  return call('invite_coop_goal_member', { p_actor: actorId, p_goal: goalId, p_invitee: inviteeId }, (body) => (body === true ? true : null));
}

export async function decideCoopGoalInvitation(userId: string, goalId: string, accept: boolean): Promise<CoopResult<'accepted' | 'declined'>> {
  if (!ids(userId, goalId)) return { ok: false, refusal: 'invalid' };
  const expected = accept ? 'accepted' : 'declined';
  return call('decide_coop_goal_invitation', { p_user: userId, p_goal: goalId, p_accept: accept }, (body) => (body === expected ? expected : null));
}

export const COOP_END_REASONS = ['left', 'declined', 'withdrawn', 'removed'] as const;
export type CoopEndReason = (typeof COOP_END_REASONS)[number];

/** Leave (member = actor), withdraw an invitation, or remove a member (the creator). */
export async function endCoopGoalMembership(actorId: string, goalId: string, memberId: string): Promise<CoopResult<CoopEndReason>> {
  if (!ids(actorId, goalId, memberId)) return { ok: false, refusal: 'invalid' };
  return call('end_coop_goal_membership', { p_actor: actorId, p_goal: goalId, p_member: memberId }, (body) => {
    const parsed = z.enum(COOP_END_REASONS).safeParse(body);
    return parsed.success ? parsed.data : null;
  });
}

/** Everyone who is or was in this goal, with their status (for the report path). null: unreadable. */
export async function readCoopGoalPeople(goalId: string, userIds: string[]): Promise<Map<string, string> | null> {
  if (!ids(goalId, ...userIds) || userIds.length === 0) return null;
  const parsed = z.array(z.object({ user_id: UUID, status: z.enum(['invited', 'active', 'ended']) }).strict()).safeParse(
    await serviceRest<unknown>(`/coop_goal_members?goal_id=eq.${goalId}&user_id=in.(${userIds.join(',')})&select=user_id,status`),
  );
  return parsed.success ? new Map(parsed.data.map((row) => [row.user_id, row.status])) : null;
}

export async function readCoopGuardianView(guardianId: string, kidId: string): Promise<CoopResult<CoopGuardianView>> {
  if (!ids(guardianId, kidId)) return { ok: false, refusal: 'invalid' };
  return call('coop_goal_guardian_view', { p_guardian: guardianId, p_kid: kidId }, (body) => {
    const parsed = CoopGuardianView.safeParse(body);
    return parsed.success ? parsed.data : null;
  });
}

/*
 * E.2 / Law 5 (GAP-FIX-R4): the verified Tutor's read of a parent-created
 * child's open goals (migration coop_goal_guardian_goals). The database
 * checks the verified link and the guardian tier (a self-registered teen's
 * goals stay its own, OD-3 Option B), reconciles first, and returns no
 * progress at all: no group total, no per-member number (OD-27 (1)).
 */
export const CoopGuardianGoals = z.array(z.object({
  id: UUID, kind: Kind, target: Target, startsAt: Instant, endsAt: Instant, startedByChild: z.boolean(),
  childStatus: z.enum(['invited', 'active']),
  people: z.array(z.object({ userId: UUID, status: z.enum(['invited', 'active', 'ended']) }).strict()).max(COOP_MAX_MEMBERS * 4),
}).strict()).max(50);
export type CoopGuardianGoals = z.infer<typeof CoopGuardianGoals>;

export async function readCoopGuardianGoals(guardianId: string, kidId: string): Promise<CoopResult<CoopGuardianGoals>> {
  if (!ids(guardianId, kidId)) return { ok: false, refusal: 'invalid' };
  return call('coop_goal_guardian_goals', { p_guardian: guardianId, p_kid: kidId }, (body) => {
    const parsed = CoopGuardianGoals.safeParse(body);
    return parsed.success ? parsed.data : null;
  });
}

export async function setCoopGuardianConsent(guardianId: string, kidId: string, enabled: boolean): Promise<CoopResult<boolean>> {
  if (!ids(guardianId, kidId)) return { ok: false, refusal: 'invalid' };
  return call('set_coop_goal_guardian_consent', { p_guardian: guardianId, p_kid: kidId, p_enabled: enabled }, (body) => (body === enabled ? enabled : null));
}
