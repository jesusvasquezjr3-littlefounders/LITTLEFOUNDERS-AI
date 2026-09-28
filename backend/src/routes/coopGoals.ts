import { Router, type Response } from 'express';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import { authedUser, requireAuth, requireRole } from '../middleware/auth.js';
import { getRolesForGate } from '../services/insights.js';
import { requiresMinorMentorSafeguards } from '../services/mentorSafety.js';
import {
  COOP_DAYS,
  COOP_MAX_INVITEES,
  COOP_MAX_MEMBERS,
  COOP_TARGETS,
  createCoopGoal,
  decideCoopGoalInvitation,
  endCoopGoalMembership,
  inviteCoopGoalMember,
  readCoopCandidates,
  readCoopEligible,
  readCoopGoalPeople,
  readCoopGuardianView,
  readCoopOverview,
  setCoopGuardianConsent,
  type CoopRefusal,
} from '../services/coopGoals.js';
import { readDataPracticeApplies } from '../services/dataPractices.js';
import { findProfileByUsername, getSocialCards, submitSocialReport, SOCIAL_REPORT_CATEGORIES, SOCIAL_REPORT_NOTE_MAX, type ListedUser } from '../services/supabaseRest.js';

/*
 * /api/v1/coop-goals — L-04 (owner decision OD-27 (1)): teen cooperative
 * goals. Policy: docs/rebuild/policies/SOCIAL-TIERS.md section 1.2.
 *
 * Teens 13 to 17 set one shared learning goal ("finish N lessons together in
 * 7, 14 or 28 days") with 1 to 4 mutual connections. The session is always
 * the actor; no route takes another account as the one acting. The database
 * re-checks every rule under the goal's lock and audits every change; Core
 * refuses early where it can (the session's eligibility, the body's shape) and
 * maps the database's refusals to one answer each:
 *
 *   403 COOP_NOT_ELIGIBLE        not a 13-to-17 participant (adult, child under
 *                                13, a child without the Tutor's opt-in, a
 *                                flagged profile, a guest)
 *   409 COOP_MEMBER_UNAVAILABLE  the person asked is not eligible, not a mutual
 *                                connection of every member, or does not exist
 *                                (one answer, so nothing about them leaks)
 *   409 COOP_GROUP_FULL / COOP_GOAL_LIMIT / COOP_ALREADY_ASKED
 *   403 DATA_PRACTICE_CONSENT_REQUIRED  a migrated child (OD-9 4.2) whose Tutor
 *                                has not consented to 'sharing.cooperative_goals'
 *   404 NOT_FOUND                not your goal, invitation or member
 *
 * No free text is accepted anywhere (E.10: there is no messaging); the only
 * strings are usernames matched to the handle pattern and the E.3 report's
 * category and bounded note, which only the safety team reads. The overview
 * carries the group total only: no per-member number, no rank, no reward.
 *
 * /api/v1/family/coop-goals — the verified Tutor's opt-in for a parent-created
 * child aged 13 to 17 (default off; E.10's pattern for a peer feature). Same
 * gate as the Family Hub: a parent role, a current verified adult identity,
 * and a verified link to this exact child (404 otherwise).
 */

const USERNAME = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,20}$/);
const GoalId = z.string().uuid();
const TargetEnum = z.number().int().refine((n) => (COOP_TARGETS as readonly number[]).includes(n));
const DaysEnum = z.number().int().refine((n) => (COOP_DAYS as readonly number[]).includes(n));

const CreateBody = z.object({ target: TargetEnum, days: DaysEnum, invite: z.array(USERNAME).min(1).max(COOP_MAX_INVITEES) }).strict();
const InviteBody = z.object({ username: USERNAME }).strict();
const DecisionBody = z.object({ decision: z.enum(['accept', 'decline']) }).strict();
const ReportBody = z.object({
  username: USERNAME,
  category: z.enum(SOCIAL_REPORT_CATEGORIES),
  note: z.string().trim().min(1).max(SOCIAL_REPORT_NOTE_MAX).optional(),
  leave: z.boolean().optional(),
}).strict();

function refuse(res: Response, refusal: CoopRefusal) {
  switch (refusal) {
    case 'invalid': return fail(res, 400, 'VALIDATION_ERROR', 'Choose a goal from the options');
    case 'not-eligible': return fail(res, 403, 'COOP_NOT_ELIGIBLE', 'Goals together are for 13 to 17 year olds');
    case 'member-unavailable': return fail(res, 409, 'COOP_MEMBER_UNAVAILABLE', 'This person cannot join this goal');
    case 'goal-limit': return fail(res, 409, 'COOP_GOAL_LIMIT', 'You are already in three goals');
    case 'group-full': return fail(res, 409, 'COOP_GROUP_FULL', 'A goal has at most five people');
    case 'already-asked': return fail(res, 409, 'COOP_ALREADY_ASKED', 'This person was already asked');
    case 'not-allowed': return fail(res, 403, 'COOP_NOT_ALLOWED', 'Only the person who started the goal can do this');
    case 'child-not-teen': return fail(res, 409, 'COOP_CHILD_NOT_TEEN', 'Goals together are for 13 to 17 year olds');
    case 'practice-consent': return fail(res, 403, 'DATA_PRACTICE_CONSENT_REQUIRED', 'A Tutor needs to say yes to goals together first');
    case 'goal-not-found': case 'invitation-not-found': case 'member-not-found': case 'guardian-not-linked':
      return fail(res, 404, 'NOT_FOUND', 'Not found');
    default: return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not reach goals together');
  }
}

interface Card { username: string; displayName: string; avatarOptions: Record<string, unknown>; isSelf: boolean }

function card(user: ListedUser | undefined, selfId: string): Card | null {
  if (!user?.username) return null;
  return { username: user.username, displayName: user.displayName, avatarOptions: user.avatarOptions, isSelf: user.userId === selfId };
}

/** Username -> account id; null when there is no such profile. */
async function accountOf(username: string): Promise<string | null | 'unavailable'> {
  const rows = await findProfileByUsername(username);
  if (rows === null) return 'unavailable';
  return rows[0]?.user_id ?? null;
}

/** The OD-9 4.2 data practice this surface is (database: cooperative_goals_data_practice). */
const COOP_PRACTICE = 'sharing.cooperative_goals';

async function requireEligible(res: Response, userId: string, isGuest: boolean): Promise<boolean> {
  if (isGuest) { refuse(res, 'not-eligible'); return false; }
  const eligible = await readCoopEligible(userId);
  if (eligible === null) { refuse(res, 'unavailable'); return false; }
  if (!eligible) {
    // OD-9 4.2: name the missing consent only on a clear no from the database.
    const applies = await readDataPracticeApplies(userId, COOP_PRACTICE);
    refuse(res, applies === false ? 'practice-consent' : 'not-eligible');
    return false;
  }
  return true;
}

export function coopGoalsRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (_req, res) => {
    const user = authedUser(res);
    if (user.isGuest) return ok(res, emptyOverview());
    const overview = await readCoopOverview(user.id);
    if (!overview.ok) return refuse(res, overview.refusal);
    const { goals, invitations, finished, eligible } = overview.value;
    const everyone = [
      ...goals.flatMap((g) => [...g.members, ...g.invited.map((i) => i.userId)]),
      ...invitations.flatMap((i) => [...(i.members ?? []), ...(i.invitedBy ? [i.invitedBy] : [])]),
    ];
    const cards = await getSocialCards(everyone);
    if (cards === null) return refuse(res, 'unavailable');
    const byId = new Map(cards.map((c) => [c.userId, c]));
    const cardOf = (id: string) => card(byId.get(id), user.id);
    const present = <T>(value: T | null): value is T => value !== null;
    return ok(res, {
      ...emptyOverview(),
      eligible,
      goals: goals.map((g) => ({
        id: g.id, kind: g.kind, target: g.target, startsAt: g.startsAt, endsAt: g.endsAt, createdByMe: g.createdByMe,
        done: g.done, reached: g.done >= g.target,
        members: g.members.map(cardOf).filter(present),
        invited: g.invited.map((i) => { const c = cardOf(i.userId); return c ? { ...c, mine: i.mine } : null; }).filter(present),
        canInvite: g.members.length + g.invited.length < COOP_MAX_MEMBERS,
      })),
      invitations: invitations.map((i) => ({
        goalId: i.goalId, kind: i.kind, target: i.target, endsAt: i.endsAt,
        invitedBy: i.invitedBy ? cardOf(i.invitedBy) : null,
        members: (i.members ?? []).map(cardOf).filter(present),
      })),
      finished: finished.map((f) => ({ id: f.id, kind: f.kind, target: f.target, endsAt: f.endsAt, done: f.done, reached: f.done >= f.target })),
    });
  });

  router.get('/candidates', async (_req, res) => {
    const user = authedUser(res);
    if (!await requireEligible(res, user.id, user.isGuest)) return undefined;
    const idsList = await readCoopCandidates(user.id);
    if (idsList === null) return refuse(res, 'unavailable');
    const cards = await getSocialCards(idsList);
    if (cards === null) return refuse(res, 'unavailable');
    return ok(res, { people: cards.map((c) => card(c, user.id)).filter((c): c is Card => c !== null) });
  });

  router.post('/', async (req, res) => {
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) return refuse(res, 'invalid');
    const user = authedUser(res);
    if (!await requireEligible(res, user.id, user.isGuest)) return undefined;
    const invitees: string[] = [];
    for (const username of new Set(parsed.data.invite)) {
      const id = await accountOf(username);
      if (id === 'unavailable') return refuse(res, 'unavailable');
      if (id === null || id === user.id) return refuse(res, 'member-unavailable');
      invitees.push(id);
    }
    if (invitees.length !== parsed.data.invite.length) return refuse(res, 'invalid');
    const created = await createCoopGoal(user.id, parsed.data.target, parsed.data.days, invitees);
    if (!created.ok) return refuse(res, created.refusal);
    return ok(res, { goalId: created.value }, 201);
  });

  router.post('/:goalId/invitations', async (req, res) => {
    const goal = GoalId.safeParse(req.params.goalId);
    const body = InviteBody.safeParse(req.body);
    if (!goal.success || !body.success) return refuse(res, 'invalid');
    const user = authedUser(res);
    if (!await requireEligible(res, user.id, user.isGuest)) return undefined;
    const invitee = await accountOf(body.data.username);
    if (invitee === 'unavailable') return refuse(res, 'unavailable');
    if (invitee === null || invitee === user.id) return refuse(res, 'member-unavailable');
    const invited = await inviteCoopGoalMember(user.id, goal.data, invitee);
    if (!invited.ok) return refuse(res, invited.refusal);
    return ok(res, { invited: true }, 201);
  });

  router.post('/:goalId/decision', async (req, res) => {
    const goal = GoalId.safeParse(req.params.goalId);
    const body = DecisionBody.safeParse(req.body);
    if (!goal.success || !body.success) return refuse(res, 'invalid');
    const user = authedUser(res);
    // Declining always works; accepting needs eligibility (re-checked in the database too).
    if (body.data.decision === 'accept' && !await requireEligible(res, user.id, user.isGuest)) return undefined;
    const decided = await decideCoopGoalInvitation(user.id, goal.data, body.data.decision === 'accept');
    if (!decided.ok) return refuse(res, decided.refusal);
    return ok(res, { status: decided.value });
  });

  // Leaving always works, eligible or not.
  router.post('/:goalId/leave', async (req, res) => {
    const goal = GoalId.safeParse(req.params.goalId);
    if (!goal.success || (req.body && Object.keys(req.body as object).length > 0)) return refuse(res, 'invalid');
    const user = authedUser(res);
    const ended = await endCoopGoalMembership(user.id, goal.data, user.id);
    if (!ended.ok) return refuse(res, ended.refusal);
    return ok(res, { ended: ended.value });
  });

  // The goal's creator removes a member or withdraws an invitation; an inviter withdraws their own invitation.
  router.delete('/:goalId/members/:username', async (req, res) => {
    const goal = GoalId.safeParse(req.params.goalId);
    const username = USERNAME.safeParse(req.params.username);
    if (!goal.success || !username.success) return refuse(res, 'invalid');
    const user = authedUser(res);
    const member = await accountOf(username.data);
    if (member === 'unavailable') return refuse(res, 'unavailable');
    if (member === null) return refuse(res, 'member-not-found');
    const ended = await endCoopGoalMembership(user.id, goal.data, member);
    if (!ended.ok) return refuse(res, ended.refusal);
    return ok(res, { ended: ended.value });
  });

  /*
   * E.3 from inside a goal: report someone who is or was in it with you, and
   * optionally leave in the same step. The report joins the same safety queue
   * as a profile report (a child's Tutor is told, the pattern trigger counts
   * it); the person reported is never told who reported them.
   */
  router.post('/:goalId/report', async (req, res) => {
    const goal = GoalId.safeParse(req.params.goalId);
    const body = ReportBody.safeParse(req.body);
    if (!goal.success || !body.success) return fail(res, 400, 'VALIDATION_ERROR', 'Choose a report reason');
    const user = authedUser(res);
    const subject = await accountOf(body.data.username);
    if (subject === 'unavailable') return refuse(res, 'unavailable');
    if (subject === null || subject === user.id) return refuse(res, 'member-not-found');
    const people = await readCoopGoalPeople(goal.data, [user.id, subject]);
    if (people === null) return refuse(res, 'unavailable');
    if (!people.has(user.id) || !people.has(subject)) return refuse(res, 'member-not-found');
    const report = await submitSocialReport(user.id, subject, body.data.category, body.data.note ?? null);
    if (report === 'invalid') return fail(res, 400, 'VALIDATION_ERROR', 'This report cannot be recorded');
    if (report === 'unavailable') return refuse(res, 'unavailable');
    let left = false;
    if (body.data.leave && people.get(user.id) !== 'ended') {
      const ended = await endCoopGoalMembership(user.id, goal.data, user.id);
      left = ended.ok;
    }
    return ok(res, { reported: true, reportId: report.id, left }, 201);
  });

  return router;
}

function emptyOverview() {
  return {
    eligible: false,
    options: { targets: COOP_TARGETS, days: COOP_DAYS, maxPeople: COOP_MAX_MEMBERS },
    goals: [] as unknown[],
    invitations: [] as unknown[],
    finished: [] as unknown[],
  };
}

/** /api/v1/family/coop-goals — the verified Tutor's per-child opt-in. */
export function familyCoopGoalsRouter(): Router {
  const router = Router();
  router.use(requireAuth, requireRole(['parent']));
  router.use(async (_req, res, next) => {
    const user = authedUser(res);
    const roles = await getRolesForGate(user.id);
    if (!roles || await requiresMinorMentorSafeguards(user.id, roles)) {
      return fail(res, 403, 'PARENT_VERIFICATION_REQUIRED', 'Current adult identity verification is required');
    }
    return next();
  });

  router.get('/kids/:kidId', async (req, res) => {
    const kid = z.string().uuid().safeParse(req.params.kidId);
    if (!kid.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');
    const view = await readCoopGuardianView(authedUser(res).id, kid.data);
    if (!view.ok) return refuse(res, view.refusal);
    return ok(res, view.value);
  });

  router.put('/kids/:kidId', async (req, res) => {
    const kid = z.string().uuid().safeParse(req.params.kidId);
    const body = z.object({ enabled: z.boolean() }).strict().safeParse(req.body);
    if (!kid.success || !body.success) return fail(res, 400, 'VALIDATION_ERROR', 'Choose on or off');
    const guardian = authedUser(res).id;
    const saved = await setCoopGuardianConsent(guardian, kid.data, body.data.enabled);
    if (!saved.ok) return refuse(res, saved.refusal);
    const view = await readCoopGuardianView(guardian, kid.data);
    if (!view.ok) return refuse(res, view.refusal);
    return ok(res, view.value);
  });

  return router;
}
