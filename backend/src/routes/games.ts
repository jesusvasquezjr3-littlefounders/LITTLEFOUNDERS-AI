import { randomBytes } from 'node:crypto';
import { Router, type Response } from 'express';
import { z } from 'zod';
import { getConfig } from '../config.js';
import { BANDS, RunReport, type Band, type Mentor } from '../games/runReport.js';
import { fail, ok } from '../lib/http.js';
import { normalizeLocale, startOfLocalDayIso, type PlatformLocale } from '../lib/localDay.js';
import { authedUser, requireAuth, requireRole, type AuthedUser } from '../middleware/auth.js';
import type { AgeScreenState } from '../services/ageScreen.js';
import { readDataPracticeApplies } from '../services/dataPractices.js';
import { aiDebriefEnabled, requestGameLine } from '../services/games/aiDebrief.js';
import {
  claimAiLine, countSessionsSince, creditSession, endSession, hasPracticeConsent, readBests, readCatalog, readLimitsAsGuardian,
  readOwnRun, readOwnSession, readPlayLimits, readSave, recordAiCost, recordRun, saveSnapshot, setReflection, startSessionChecked,
  writeLimitsAsGuardian, type GameFailure, type SessionRow,
} from '../services/games/data.js';
import { selectLens } from '../services/games/lens.js';
import {
  capsFor, dailySessionCap, MAX_CREDIT_SECONDS, SESSION_TTL_MS, sessionState, type PlayLimits,
} from '../services/games/limits.js';
import { implausibleReason } from '../services/games/plausibility.js';
import { getRolesForGate } from '../services/insights.js';
import { resolveLearnerRegister } from '../services/learnerRegister.js';
import { REGISTERS } from '../services/learnerRegisterPolicy.js';
import { requiresMinorMentorSafeguards } from '../services/mentorSafety.js';
import { getOwnProfile } from '../services/supabaseRest.js';
import { getTutorPreferences } from '../services/tutorData.js';

/*
 * /api/v1/learn/games — games embedded in /learn (docs/games/KRV1-CONTRACT.md
 * section 3; design docs/games/KARTRUSH-INTEGRATION-DESIGN.md). Mounted inside
 * learnRouter's requireAuth + requireAgeScreen, behind a dedicated rate limiter
 * (app.ts), so heartbeats never draw on the pool lessons and sign-in use.
 *
 * The game is a sensor and the browser relays its reports with the learner's own
 * session; nothing here takes an account id from a body or a path. Races award
 * no XP, no coins and no streak credit and write no kc_attempt: these routes
 * only keep records, enforce the play limits and, behind two switches and a
 * guardian's consent, ask Oracle for one sealed line about a finished race.
 *
 * Failure modes, once, so each is the same everywhere:
 *   - a record that cannot be read is 502 DATA_UNAVAILABLE, never an empty
 *     success: an unreadable "sessions today" must not admit a learner past a cap;
 *   - a repeated run key is the stored run with 200, so a retry after a dropped
 *     response is always safe;
 *   - the AI line is optional; every failure of it is the authored line.
 *
 * /api/v1/family/play-limits is the verified Tutor's side: a guardian may only
 * LOWER the platform ceiling (0..2 sessions a day, 5..25 minutes a session).
 */

const DATA_UNAVAILABLE = 'DATA_UNAVAILABLE';
/** Largest save the database keeps (game_saves CHECK), measured on the compact JSON a client sends. */
const MAX_SAVE_BYTES = 65_536;
/** The practices a game session and its AI line stand on (database: game_records). */
const PLAY_PRACTICE = 'game_play_records';
const AI_PRACTICE = 'game_ai_debrief';

const GameId = z.string().regex(/^[a-z][a-z0-9_]{1,31}$/);
const Id = z.string().uuid();
const Empty = z.object({}).strict();
const HeartbeatBody = z.object({ visible: z.boolean(), focused: z.boolean() }).strict();
const ReflectionBody = z.object({ reply: z.enum(['a', 'b', 'unsure']) }).strict();
const SaveBody = z.object({ revision: z.number().int().min(0).max(1_000_000_000), data: z.record(z.string(), z.unknown()) }).strict();
const EndBody = z.object({ reason: z.enum(['left', 'soft', 'hard', 'idle']) }).strict();
const LimitsBody = z.object({
  maxSessionsPerDay: z.number().int().min(0).max(2),
  maxSessionMinutes: z.number().int().min(5).max(25),
}).strict();

const invalid = (res: Response) => fail(res, 400, 'VALIDATION_ERROR', 'The request does not match the contract');
const unavailable = (res: Response) => fail(res, 502, DATA_UNAVAILABLE, 'Could not reach the game records');

/** One answer per named database refusal; an unreadable answer is 502, never a pass. */
function refuse(res: Response, failure: GameFailure) {
  if (failure === 'UNAVAILABLE') return unavailable(res);
  switch (failure.refused) {
    case 'GAME_SESSION_NOT_FOUND': case 'GAME_GUARDIAN_NOT_LINKED': return fail(res, 404, 'NOT_FOUND', 'Not found');
    case 'GAME_SESSION_CLOSED': return fail(res, 409, 'SESSION_CLOSED', 'This session has ended');
    case 'GAME_SESSION_EXPIRED': return fail(res, 410, 'SESSION_EXPIRED', 'This session has expired');
    case 'GAME_INVALID': return fail(res, 400, 'VALIDATION_ERROR', 'The request does not match the contract');
    default: return unavailable(res);
  }
}

interface LearnerContext {
  locale: PlatformLocale;
  band: Band;
  /** The Mentor the learner chose, or null when they never opened the picker. */
  mentor: Mentor | null;
}

const EPOCH = new Date(0).toISOString();
const BAND_ORDER: readonly Band[] = BANDS;

/** The locale, age band and chosen Mentor, each read from the learner's own record; null when any read fails. */
async function learnerContext(user: AuthedUser, ageScreen: AgeScreenState): Promise<LearnerContext | null> {
  const [profile, register, prefs] = await Promise.all([
    getOwnProfile(user.accessToken, user.id),
    resolveLearnerRegister(user.id, ageScreen),
    getTutorPreferences(user.id),
  ]);
  if (!profile || !register || !prefs) return null;
  const chosen = prefs.updated_at !== EPOCH && (['rho', 'zara', 'liruf', 'dina'] as const).find((m) => m === prefs.character);
  return { locale: normalizeLocale(profile[0]?.locale), band: REGISTERS[register].copyBand, mentor: chosen || null };
}

/** Everything that decides whether this learner may play right now, read before anything is written. */
async function playState(user: AuthedUser, gameId: string, ctx: LearnerContext) {
  const [limits, used, practice] = await Promise.all([
    readPlayLimits(user.id),
    countSessionsSince(user.id, gameId, startOfLocalDayIso(ctx.locale)),
    readDataPracticeApplies(user.id, PLAY_PRACTICE),
  ]);
  // A practice answer that cannot be read is neither yes nor no: the caller says so (502), never "not available".
  if (!limits || used === null || practice === null) return null;
  const cap = dailySessionCap(limits);
  return { limits, used, cap, practice, remaining: Math.max(0, cap - used) };
}

export function gamesRouter(): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    if (Object.keys(req.query).length > 0) return invalid(res);
    const user = authedUser(res);
    const catalog = await readCatalog();
    const ctx = await learnerContext(user, res.locals.ageScreen as AgeScreenState);
    if (!catalog || !ctx) return unavailable(res);
    const games = [];
    for (const entry of catalog.filter((g) => g.status === 'live')) {
      const state = await playState(user, entry.gameId, ctx);
      if (!state) return unavailable(res);
      const bandFits = BAND_ORDER.indexOf(ctx.band) >= BAND_ORDER.indexOf(entry.minBand);
      games.push({
        gameId: entry.gameId,
        status: 'live' as const,
        sessionsRemainingToday: state.remaining,
        enabled: bandFits && state.cap > 0 && state.practice,
      });
    }
    return ok(res, { games });
  });

  router.post('/:gameId/sessions', async (req, res) => {
    const gameId = GameId.safeParse(req.params.gameId);
    if (!gameId.success) return fail(res, 404, 'GAME_UNKNOWN', 'No such game');
    if (!Empty.safeParse(req.body ?? {}).success) return invalid(res);
    const user = authedUser(res);
    const catalog = await readCatalog();
    if (!catalog) return unavailable(res);
    const entry = catalog.find((g) => g.gameId === gameId.data && g.status === 'live');
    if (!entry) return fail(res, 404, 'GAME_UNKNOWN', 'No such game');

    const ctx = await learnerContext(user, res.locals.ageScreen as AgeScreenState);
    if (!ctx) return unavailable(res);
    const state = await playState(user, entry.gameId, ctx);
    if (!state) return unavailable(res);
    // Not allowed to play at all: a younger band than the game's, a guardian who set zero sessions, or a
    // migrated child whose Tutor has not yet said yes to game records (OD-9 4.2). One answer for all three.
    if (BAND_ORDER.indexOf(ctx.band) < BAND_ORDER.indexOf(entry.minBand) || state.cap === 0 || !state.practice) {
      return fail(res, 403, 'GAME_DISABLED', 'This game is not available for this account');
    }
    // Read what the session will carry BEFORE creating it, so a failed read never burns a slot of the day.
    const [save, bests] = await Promise.all([readSave(user.id, entry.gameId), readBests(user.id, entry.gameId)]);
    if (!save || !bests) return unavailable(res);

    const config = getConfig();
    const created = await startSessionChecked({
      userId: user.id,
      gameId: entry.gameId,
      sinceIso: startOfLocalDayIso(ctx.locale),
      cap: state.cap,
      sessionRef: randomBytes(24).toString('base64url'),
      mentor: ctx.mentor,
      locale: ctx.locale,
      band: ctx.band,
      clientBuild: config.KARTRUSH_BUILD,
      maxMinutes: state.limits.maxSessionMinutes,
      expiresAtIso: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    });
    if (!created) return unavailable(res);
    if (created.status === 'cap_reached') {
      // The reset instant, not a vague "tomorrow": the learner's next local midnight.
      return fail(res, 429, 'GAME_DAILY_LIMIT', 'You have played all of today\'s sessions', {
        resetsAt: startOfLocalDayIso(ctx.locale, new Date(), 1),
      });
    }
    const { session } = created;
    // A refresh or a quick trip away reopens the learner's latest session (same id) and costs no slot, so the
    // count is read again rather than assumed to have grown; if that read fails, assume a new session.
    const usedNow = await countSessionsSince(user.id, entry.gameId, startOfLocalDayIso(ctx.locale));
    return ok(res, {
      sessionId: session.id,
      sessionRef: session.session_ref,
      game: { url: config.KARTRUSH_URL, build: config.KARTRUSH_BUILD },
      mentor: session.mentor,
      band: session.band,
      caps: capsFor(session.max_minutes),
      save,
      bests,
      sessionsRemainingToday: Math.max(0, state.cap - (usedNow ?? state.used + 1)),
    }, 201);
  });

  /** The learner's own session, refused with the contract's answer when it is not open (or not theirs). */
  async function openSession(res: Response, gameId: string, sessionId: string): Promise<SessionRow | null> {
    const row = await readOwnSession(authedUser(res).id, gameId, sessionId);
    if (row === null) { unavailable(res); return null; }
    if (row === 'none') { fail(res, 404, 'NOT_FOUND', 'Not found'); return null; }
    if (row.ended_at !== null) { fail(res, 409, 'SESSION_CLOSED', 'This session has ended'); return null; }
    if (new Date(row.expires_at).getTime() <= Date.now()) { fail(res, 410, 'SESSION_EXPIRED', 'This session has expired'); return null; }
    return row;
  }

  router.post('/:gameId/sessions/:sid/heartbeat', async (req, res) => {
    const gameId = GameId.safeParse(req.params.gameId);
    const sid = Id.safeParse(req.params.sid);
    const body = HeartbeatBody.safeParse(req.body);
    if (!gameId.success || !sid.success || !body.success) return invalid(res);
    const user = authedUser(res);
    // The database credits min(elapsed, 90 s) only when visible AND focused, under the session's row lock.
    const credited = await creditSession(sid.data, user.id, body.data.visible && body.data.focused, MAX_CREDIT_SECONDS);
    if (!credited.ok) return refuse(res, credited.failure);
    const row = credited.value;
    if (row.ended_at !== null) return fail(res, 409, 'SESSION_CLOSED', 'This session has ended');
    const now = new Date(row.now).getTime();
    if (new Date(row.expires_at).getTime() <= now) {
      await endSession(sid.data, user.id, 'hard');
      return fail(res, 410, 'SESSION_EXPIRED', 'This session has expired');
    }
    const state = sessionState({
      activeSeconds: row.active_seconds,
      maxSessionMinutes: row.max_minutes,
      idleGapMs: now - new Date(row.prev_active_at).getTime(),
    });
    // Out of time or away too long: the session ends here, so a later run report for it is refused (409).
    if (state === 'hard' || state === 'idle') await endSession(sid.data, user.id, state);
    return ok(res, { activeSeconds: row.active_seconds, state });
  });

  router.post('/:gameId/sessions/:sid/runs', async (req, res) => {
    const gameId = GameId.safeParse(req.params.gameId);
    const sid = Id.safeParse(req.params.sid);
    const report = RunReport.safeParse(req.body);
    if (!gameId.success || !sid.success || !report.success) return invalid(res);
    // A report no real race could produce. The reason is not echoed: it would only teach a client the rules.
    if (implausibleReason(report.data) !== null) return fail(res, 422, 'RUN_IMPLAUSIBLE', 'This result could not be recorded');
    const user = authedUser(res);
    const lens = selectLens(report.data);
    const recorded = await recordRun({ sessionId: sid.data, userId: user.id, gameId: gameId.data, report: report.data, lens });
    if (!recorded.ok) return refuse(res, recorded.failure);
    // The run is stored; a failed read after it is a 502 the client may retry safely (a repeat returns this run).
    const bests = await readBests(user.id, gameId.data);
    if (!bests) return unavailable(res);
    const run = recorded.value;
    const aiAvailable = aiDebriefEnabled() && run.ai_line_at === null && await hasPracticeConsent(user.id, AI_PRACTICE);
    // 201 for a run stored now, 200 for the stored run a repeated key returns (RUN_DUPLICATE).
    return ok(res, { runId: run.run_id, lens: run.lens, newBest: run.new_best, bests, aiAvailable }, run.duplicate ? 200 : 201);
  });

  router.post('/:gameId/sessions/:sid/runs/:runId/reflection', async (req, res) => {
    const gameId = GameId.safeParse(req.params.gameId);
    const sid = Id.safeParse(req.params.sid);
    const runId = Id.safeParse(req.params.runId);
    const body = ReflectionBody.safeParse(req.body);
    if (!gameId.success || !sid.success || !runId.success || !body.success) return invalid(res);
    const stored = await setReflection(authedUser(res).id, sid.data, runId.data, body.data.reply);
    if (stored === null) return unavailable(res);
    return stored ? ok(res, { ok: true }) : fail(res, 404, 'NOT_FOUND', 'Not found');
  });

  router.post('/:gameId/sessions/:sid/runs/:runId/debrief', async (req, res) => {
    const gameId = GameId.safeParse(req.params.gameId);
    const sid = Id.safeParse(req.params.sid);
    const runId = Id.safeParse(req.params.runId);
    if (!gameId.success || !sid.success || !runId.success || !Empty.safeParse(req.body ?? {}).success) return invalid(res);
    const user = authedUser(res);
    const run = await readOwnRun(user.id, sid.data, runId.data);
    if (run === null) return unavailable(res);
    if (run === 'none') return fail(res, 404, 'NOT_FOUND', 'Not found');

    const authored = () => ok(res, { source: 'authored' as const, text: null });
    // Both switches and the guardian's consent, or the authored line. The model is never reached otherwise.
    if (!aiDebriefEnabled() || !await hasPracticeConsent(user.id, AI_PRACTICE)) return authored();
    const session = await readOwnSession(user.id, gameId.data, sid.data);
    if (session === null || session === 'none' || session.mentor === null) return authored();
    const claimed = await claimAiLine(user.id, run.id, startOfLocalDayIso(session.locale), getConfig().GAME_AI_DAILY_LINES);
    if (!claimed.ok || !claimed.value) return authored();
    const line = await requestGameLine({ mentor: session.mentor, locale: session.locale, band: session.band, lens: run.lens });
    if (!line) return authored();
    await recordAiCost(user.id, run.id, line.costUsd);
    return ok(res, { source: 'ai' as const, text: line.text });
  });

  router.put('/:gameId/sessions/:sid/save', async (req, res) => {
    const gameId = GameId.safeParse(req.params.gameId);
    const sid = Id.safeParse(req.params.sid);
    const body = SaveBody.safeParse(req.body);
    if (!gameId.success || !sid.success || !body.success) return invalid(res);
    if (Buffer.byteLength(JSON.stringify(body.data.data)) > MAX_SAVE_BYTES) {
      return fail(res, 413, 'PAYLOAD_TOO_LARGE', 'The save is too large');
    }
    const user = authedUser(res);
    if (!await openSession(res, gameId.data, sid.data)) return undefined;
    const saved = await saveSnapshot(user.id, gameId.data, body.data.revision, body.data.data);
    // The database measures the stored text, which can be slightly larger than the compact JSON checked above.
    if (!saved.ok) {
      return saved.failure !== 'UNAVAILABLE' && saved.failure.refused === 'GAME_INVALID'
        ? fail(res, 413, 'PAYLOAD_TOO_LARGE', 'The save is too large')
        : refuse(res, saved.failure);
    }
    if (!saved.value.ok) {
      // Both places carry the current revision: the contract names `data`, the error object is where clients read the rest.
      return res.status(409).json({
        data: { revision: saved.value.revision },
        error: { code: 'SAVE_CONFLICT', message: 'The save changed elsewhere', revision: saved.value.revision },
      });
    }
    return ok(res, { revision: saved.value.revision });
  });

  router.post('/:gameId/sessions/:sid/end', async (req, res) => {
    const gameId = GameId.safeParse(req.params.gameId);
    const sid = Id.safeParse(req.params.sid);
    const body = EndBody.safeParse(req.body);
    if (!gameId.success || !sid.success || !body.success) return invalid(res);
    const user = authedUser(res);
    // Ownership is the database's: it names the learner and refuses a session that is not theirs.
    const owned = await readOwnSession(user.id, gameId.data, sid.data);
    if (owned === null) return unavailable(res);
    if (owned === 'none') return fail(res, 404, 'NOT_FOUND', 'Not found');
    const ended = await endSession(sid.data, user.id, body.data.reason);
    if (!ended.ok) return refuse(res, ended.failure);
    return ok(res, { ok: true });
  });

  return router;
}

/**
 * /api/v1/family/play-limits — the verified Tutor's per-child limits, by the
 * same gate as the Family Hub's other child settings: a parent role, a current
 * verified adult identity, and a verified link to this exact child (404
 * otherwise, so another family's child is never confirmed to exist).
 */
export function familyPlayLimitsRouter(): Router {
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
    const kid = Id.safeParse(req.params.kidId);
    if (!kid.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');
    const view = await readLimitsAsGuardian(authedUser(res).id, kid.data);
    return view.ok ? ok(res, view.value) : refuse(res, view.failure);
  });

  router.put('/kids/:kidId', async (req, res) => {
    const kid = Id.safeParse(req.params.kidId);
    const body = LimitsBody.safeParse(req.body);
    if (!kid.success || !body.success) return fail(res, 400, 'VALIDATION_ERROR', 'Choose 0 to 2 sessions and 5 to 25 minutes');
    const limits: PlayLimits = body.data;
    const saved = await writeLimitsAsGuardian(authedUser(res).id, kid.data, limits);
    return saved.ok ? ok(res, saved.value) : refuse(res, saved.failure);
  });

  return router;
}
