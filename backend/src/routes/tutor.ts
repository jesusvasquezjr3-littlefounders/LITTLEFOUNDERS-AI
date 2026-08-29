import { Router } from 'express';
import { z } from 'zod';
import { getConfig } from '../config.js';
import { authedUser, requireAuth, requireInternalKey } from '../middleware/auth.js';
import { fail, ok } from '../lib/http.js';
import { getRolesForGate } from '../services/insights.js';
import {
  getFullOwnProfile,
  getVerifiedKidLinks,
  serviceRest,
  type FullProfileRow,
} from '../services/supabaseRest.js';
import { getOwnLearnerIntelligence } from '../services/learningIntel.js';
import { tutorSocketUrl } from '../services/tutorToken.js';
import {
  ADAPTATIONS,
  CHARACTERS,
  BACKDROPS,
  DIORAMAS,
  addSessionXp,
  closeTutorSession,
  countSessionSegments,
  countSessionsSince,
  createTutorSession,
  getActiveVoiceConsent,
  getTutorPreferences,
  getTutorSegment,
  getTutorSession,
  grantVoiceConsent,
  insertSafetyFlag,
  insertTutorSegment,
  insertTutorTurn,
  listRecentSummaries,
  getLearnerMemory,
  writeLearnerMemory,
  searchOwnTurns,
  listSafetyFlags,
  listTutorSegments,
  listTutorSessions,
  listTutorTurns,
  recordSegmentResult,
  revokeVoiceConsent,
  setSessionSummary,
  tutorXpSince,
  upsertTutorPreferences,
  type SessionSummaryDigest,
  type TutorSegmentRow,
  type TutorSessionRow,
} from '../services/tutorData.js';
import {
  LIVE_TYPE_ALLOWLIST,
  resolveSkill,
  serveFromBank,
  serveFromCatalog,
  stripCandidate,
  verifyGeneratedSegment,
  type LadderCandidate,
} from '../services/tutorLadder.js';
import { getActiveKcs, getKcEdges } from '../services/pedagogy/kcData.js';
import { purgeExpiredTutorSessions } from '../services/tutorRetention.js';
import { buildSessionPlan } from '../services/pedagogy/sessionPlan.js';
import { buildTutorMap } from '../services/pedagogy/tutorMap.js';
import { recordAttempt, type AttemptOutcome } from '../services/pedagogy/recordAttempt.js';
import { normalizeSpokenNumber } from '../services/pedagogy/normalizeSpoken.js';
import { GRADERS, KEYLESS_GRADERS } from '../lesson-contract/registry.js';
import type { SegmentBase } from '../lesson-contract/core/types.js';
import { verdictFrom } from '../lesson-contract/core/types.js';

/*
 * The Tutor's API (/ORACLE.md). Two surfaces in one router file, and the split
 * is the important part:
 *
 *   /api/v1/tutor/*           browser-facing, requireAuth, caller-scoped
 *   /api/v1/tutor/internal/*  Oracle-facing, requireInternalKey, never a browser
 *
 * The internal half is mounted FIRST so `/internal/...` can never be shadowed
 * by a `/:something` route added later on the public half. That ordering is
 * load-bearing: a public route matching `/internal/sessions/:id` would hand a
 * browser the internal session context, which carries the consent state and
 * the resolved tier.
 */

const NOT_FOUND = 'NOT_FOUND';
const VALIDATION = 'VALIDATION_ERROR';

/** Daily caps (/ORACLE.md §15, §0 assumption 5). */
const MAX_SESSIONS_PER_DAY = 2;
/** Without a cap the tutor is the cheapest XP per minute and courses become optional (§8). */
const MAX_TUTOR_XP_PER_DAY = 120;
const PASS_THRESHOLD = 70;

function startOfTodayIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

/**
 * Tier band from a birth date. Mirrors `tierForBirthDate` in
 * `oracle/src/context/schema.ts`, and the mirroring is the point: the date is
 * read HERE and only the band travels, so Oracle never needs it.
 */
export function tierForBirthDate(birthDate: string | null, now = new Date()): 1 | 2 | 3 {
  if (!birthDate) return 2;
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return 2;
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - born.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < born.getUTCDate())) age -= 1;
  if (age < 0) return 2;
  if (age <= 7) return 1;
  if (age <= 9) return 2;
  return 3;
}

function normalizeLocale(raw: string | null | undefined): 'en-US' | 'es-MX' | 'pt-BR' {
  return raw === 'en-US' || raw === 'pt-BR' ? raw : 'es-MX';
}

async function profileOf(accessToken: string, userId: string): Promise<FullProfileRow | null> {
  const rows = await getFullOwnProfile(accessToken, userId);
  return rows?.[0] ?? null;
}

/** Whether the caller is a verified guardian of `kidId`. The app-layer half of §1.3. */
async function isVerifiedGuardian(parentId: string, kidId: string): Promise<boolean | null> {
  const links = await getVerifiedKidLinks(parentId);
  if (links === null) return null;
  return links.some((l) => l.kid_user_id === kidId);
}

interface PreflightResult {
  canStart: boolean;
  blockedBy: string | null;
  voiceAvailable: boolean;
  microphoneAvailable: boolean;
  /** Whether policy currently permits a minor's microphone at all (the DPA gate). */
  minorVoicePolicy?: 'allowed' | 'blocked';
}

const PREFLIGHT_DOWN: PreflightResult = {
  canStart: false,
  blockedBy: 'ORACLE_UNAVAILABLE',
  voiceAvailable: false,
  microphoneAvailable: false,
  minorVoicePolicy: 'blocked',
};

/**
 * Why a microphone is off, in the order that decides the copy.
 *
 * POLICY first: telling a family "ask a grown-up to allow it" when the answer
 * would still be no wastes their time and reads as a broken permission.
 */
function microphoneBlockedBy(
  isMinor: boolean,
  hasConsent: boolean,
  runtime: PreflightResult,
): string | null {
  if (isMinor && runtime.minorVoicePolicy === 'blocked') return 'POLICY_BLOCKED';
  if (isMinor && !hasConsent) return 'CONSENT_REQUIRED';
  if (!runtime.voiceAvailable) return 'VOICE_UNAVAILABLE';
  return null;
}

/**
 * Asks Oracle whether it can actually serve, BEFORE minting a token.
 *
 * A degraded Oracle must produce an honest disabled button, not a thirty-second
 * loading sequence that ends in a closed socket. A failed preflight is treated
 * as "cannot start" — an unreachable runtime is not a working one (§1.14).
 */
async function preflight(isMinor: boolean, wantsVoice: boolean): Promise<PreflightResult> {
  const { ORACLE_URL, ORACLE_INTERNAL_KEY, ORACLE_TIMEOUT_MS } = getConfig();
  try {
    const response = await fetch(`${ORACLE_URL}/api/v1/tutor/preflight`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-api-key': ORACLE_INTERNAL_KEY },
      body: JSON.stringify({ isMinor, wantsVoice }),
      signal: AbortSignal.timeout(ORACLE_TIMEOUT_MS),
    });
    if (!response.ok) return PREFLIGHT_DOWN;
    const body = (await response.json()) as { data?: PreflightResult | null };
    return body.data ?? PREFLIGHT_DOWN;
  } catch {
    return PREFLIGHT_DOWN;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Internal surface — Oracle only
// ────────────────────────────────────────────────────────────────────────────

function internalRouter(): Router {
  const router = Router();
  router.use(requireInternalKey);

  /**
   * Everything Oracle is allowed to know about a session.
   *
   * This is the ONE place a learner's derived state is assembled, and it is
   * why Oracle needs no database: the birth date is read here and discarded
   * here, only the tier band travels.
   */
  router.get('/sessions/:id', async (req, res) => {
    const sessionId = z.string().uuid().safeParse(req.params.id);
    if (!sessionId.success) return fail(res, 400, VALIDATION, 'Invalid session id');

    const session = await getTutorSession(sessionId.data);
    if (!session) return fail(res, 404, NOT_FOUND, 'No such session');
    if (session.ended_at !== null) return fail(res, 409, 'SESSION_CLOSED', 'This session has already ended');

    const prefs = await getTutorPreferences(session.user_id);
    if (prefs === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not read tutor preferences');

    const roles = await getRolesForGate(session.user_id);
    if (roles === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not resolve roles');
    const isMinor = roles.includes('kid');

    const consent = isMinor ? await getActiveVoiceConsent(session.user_id) : null;

    // A failed personalization read is NOT an empty one (/ORACLE.md §14). The
    // flag travels so the tutor can say it is still getting to know the
    // learner rather than silently behaving as though they know nothing.
    const states = await getOwnLearnerIntelligence(session.user_id);
    const intelDegraded = states === null;

    const courseContext =
      session.course_id || session.topic_id
        ? await resolveCourseContext(session.course_id, session.topic_id, session.locale)
        : null;

    /*
     * The memory digests (/ORACLE.md §4.1, 2026-08-28). Only the fields
     * Oracle's PreviousSessionSchema names travel; the internal course/topic
     * ids the digest also stores stay here. A failed read degrades to a tutor
     * with no memory — never to a refused session.
     */
    const recent = await listRecentSummaries(session.user_id, session.id);
    // V4: the curated learner brief (0053). Read failure degrades to no brief.
    const learnerBrief = await getLearnerMemory(session.user_id);

    /*
     * THE V3 BRAIN (migration 0052). The session plan (review debt + ZPD
     * frontier) and the per-KC posteriors are computed HERE, once, on the
     * decision clock — never inside a voice turn. Degrades to null while the
     * migration is unapplied, the seed is empty, or the flag is off, and a
     * null here is exactly what tells Oracle to behave as v2.
     */
    const pedagogyPlan = getConfig().TUTOR_V3_BRAIN
      ? await buildSessionPlan(session.user_id, session.tier, session.locale)
      : null;

    const previousSessions = (recent ?? []).map((row) => ({
      topic: row.summary.topic,
      skillKeys: row.summary.skillKeys.slice(0, 5),
      outcome: row.summary.outcome,
      gradedCorrect: row.summary.gradedCorrect,
      gradedTotal: row.summary.gradedTotal,
      daysAgo: daysAgo(row.ended_at),
    }));

    return ok(res, {
      sessionId: session.id,
      userId: session.user_id,
      tier: session.tier,
      locale: session.locale,
      // The nickname is the only name-shaped value that may travel
      // (/ORACLE.md §4.1). With none chosen, the tutor gets a neutral word
      // rather than the learner's display name.
      nickname: prefs.nickname ?? neutralNickname(session.locale),
      character: session.character,
      companion: session.companion,
      diorama: session.diorama,
      intent: session.intent,
      adaptations: prefs.adaptations,
      courseContext,
      skillKey: session.skill_key,
      previousSessions,
      /*
       * V4 SESSION DOSSIER (harness §4.3): the slow chamber's qualitative
       * knowledge of this learner, immutable for the whole session so the
       * fast chamber's prompt prefix stays cacheable. Written only by the
       * post-session review; a guardian can read it via RLS; every write is
       * ledgered.
       */
      learnerBrief,
      skillStates: (states ?? []).slice(0, 12).map((s) => ({
        skillKey: s.skillKey,
        masteryProbability: s.masteryProbability,
        uncertainty: s.uncertainty,
        evidenceCount: s.evidenceCount,
        recommendedAction: s.recommendedAction,
        reasonCode: s.reasonCode,
      })),
      isMinor,
      voiceConsent: consent !== null,
      intelDegraded,
      sessionPlan: pedagogyPlan?.plan ?? null,
      kcStates: pedagogyPlan?.kcStates ?? null,
    });
  });

  const TurnBody = z.object({
    sessionId: z.string().uuid(),
    seq: z.number().int().nonnegative(),
    speaker: z.enum(['learner', 'tutor', 'system']),
    text: z.string().max(4_000),
    emotion: z.string().max(32).nullish(),
    action: z.string().max(32).nullish(),
    audioPath: z.string().max(2_048).nullish(),
    source: z.enum(['model', 'scripted', 'stt']),
    moderation: z.record(z.string(), z.unknown()).optional(),
  });

  router.post('/turns', async (req, res) => {
    const parsed = TurnBody.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, VALIDATION, parsed.error.issues[0]?.message ?? 'Invalid turn');
    const recorded = await insertTutorTurn(parsed.data);
    return ok(res, { recorded });
  });

  const FlagBody = z.object({
    sessionId: z.string().uuid(),
    turnSeq: z.number().int().nonnegative().nullable(),
    category: z.string().min(1).max(64),
    severity: z.enum(['low', 'medium', 'high']),
    handled: z.enum(['scripted_response', 'turn_blocked', 'session_stopped']),
  });

  /*
   * V4: the post-session review's write path. Oracle destils what a session
   * taught us about the learner and PUTs it here; Core owns the limits, the
   * store and the ledger. Content rules are §1.9's: no surnames, no
   * locations — the writer's prompt forbids them and the schema caps length.
   */
  router.put('/learner-memory', async (req, res) => {
    const Body = z
      .object({
        userId: z.uuid(),
        sessionId: z.uuid().nullable(),
        stores: z
          .object({
            learner: z.string().min(1).max(1400).nullable(),
            pedagogy: z.string().min(1).max(2200).nullable(),
          })
          .strict(),
      })
      .strict();
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, VALIDATION, parsed.error.issues[0]?.message ?? 'Invalid request');
    }
    const { userId, sessionId, stores } = parsed.data;
    const results: Record<string, boolean> = {};
    for (const store of ['learner', 'pedagogy'] as const) {
      const content = stores[store];
      if (content === null) continue; // null = no update proposed for this store
      results[store] = await writeLearnerMemory({
        userId,
        store,
        content,
        actor: 'oracle-post-session-review',
        sessionId,
      });
    }
    return ok(res, { written: results });
  });

  /*
   * V4 episodic recall: literal excerpts from this learner's own history,
   * for the "¿te acuerdas de…?" moments. GIN-indexed, ~20 ms, no model.
   */
  router.get('/recall', async (req, res) => {
    const Q = z
      .object({ userId: z.uuid(), q: z.string().min(2).max(200) })
      .strict();
    const parsed = Q.safeParse({ userId: req.query.userId, q: req.query.q });
    if (!parsed.success) {
      return fail(res, 400, VALIDATION, parsed.error.issues[0]?.message ?? 'Invalid request');
    }
    const excerpts = await searchOwnTurns(parsed.data.userId, parsed.data.q, 3);
    return ok(res, { excerpts });
  });

  router.post('/flags', async (req, res) => {
    const parsed = FlagBody.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, VALIDATION, parsed.error.issues[0]?.message ?? 'Invalid flag');
    const session = await getTutorSession(parsed.data.sessionId);
    if (!session) return fail(res, 404, NOT_FOUND, 'No such session');
    const recorded = await insertSafetyFlag({ ...parsed.data, userId: session.user_id });
    return ok(res, { recorded });
  });

  const CloseBody = z.object({
    sessionId: z.string().uuid(),
    closeReason: z.enum([
      'completed',
      'soft_budget',
      'hard_budget',
      'learner_left',
      'abandoned',
      'consent_revoked',
      'safety_stop',
      'error',
    ]),
    turnCount: z.number().int().nonnegative(),
    segmentCount: z.number().int().nonnegative(),
    costUsd: z.number().nonnegative(),
  });

  router.post('/sessions/:id/close', async (req, res) => {
    const parsed = CloseBody.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, VALIDATION, parsed.error.issues[0]?.message ?? 'Invalid close');
    // `ended_at IS NULL` in the update means the FIRST close wins. A socket
    // that dies after a graceful farewell must not rewrite `completed` into
    // `learner_left`.
    const closed = await closeTutorSession(parsed.data);

    /*
     * THE MEMORY DIGEST, written when a close actually landed (/ORACLE.md
     * §4.1, 2026-08-28). Computed HERE, deterministically, from rows Core
     * already holds — never by a model and never from transcript text,
     * because this object is what the NEXT session's model context carries.
     * Best-effort after the close: a failed digest costs continuity, not the
     * session record.
     */
    if (closed) {
      const session = await getTutorSession(parsed.data.sessionId);
      if (session) {
        const segments = await listTutorSegments(session.id);
        const context =
          session.course_id || session.topic_id
            ? await resolveCourseContext(session.course_id, session.topic_id, session.locale)
            : null;
        await setSessionSummary(
          session.id,
          memoryDigest(session, segments, context?.topicTitle ?? context?.courseTitle ?? null),
        );
      }
    }
    return ok(res, { closed });
  });

  router.get('/consent/:userId', async (req, res) => {
    const userId = z.string().uuid().safeParse(req.params.userId);
    if (!userId.success) return fail(res, 400, VALIDATION, 'Invalid user id');
    const consent = await getActiveVoiceConsent(userId.data);
    return ok(res, { active: consent !== null });
  });

  /**
   * The nightly 90-day sweep (/ORACLE.md §12), called by
   * `.github/workflows/tutor-retention.yml`.
   *
   * It reports what it deleted rather than answering 204, because a retention
   * job that cannot prove it ran is indistinguishable from one that did not —
   * and this is the promise the legal brief makes on our behalf.
   */
  const PurgeBody = z.object({ limit: z.number().int().min(1).max(2000).default(500) }).strict();

  router.post('/retention/purge', async (req, res) => {
    const parsed = PurgeBody.safeParse(req.body ?? {});
    if (!parsed.success) return fail(res, 400, VALIDATION, parsed.error.issues[0]?.message ?? 'Invalid body');

    const result = await purgeExpiredTutorSessions(parsed.data.limit);
    if (result === null) {
      // NOT "nothing to delete". An unreachable database is how a 90-day
      // promise quietly becomes forever (§1.14).
      return fail(res, 502, 'DATA_UNAVAILABLE', 'The retention sweep could not run');
    }
    if (result.audioFailed > 0) {
      console.error(
        `[tutor-retention] ${result.audioFailed} audio file(s) survived their session:`,
        result.orphanedPaths,
      );
    }
    return ok(res, result);
  });

  const SegmentRequestBody = z.object({
    sessionId: z.string().uuid(),
    skillKey: z.string().min(1).max(128),
    difficulty: z.number().int().min(1).max(5),
    framing: z.string().min(1).max(240),
    rationale: z.string().min(1).max(400),
    /** v3: which knowledge component this segment gathers evidence for. */
    kcId: z.string().uuid().nullish(),
    /** v3: the controller strategy in force when it was requested. */
    strategy: z.string().max(16).nullish(),
    /**
     * V4 sprint 2 backlog (ROADMAP.md): a hint so the ladder can prefer a
     * VISUAL segment over its own frontier fallback. Best-effort — a miss
     * falls through to the ladder's ordinary behaviour, never an error.
     */
    preferredTypes: z.array(z.enum(['interest_peek', 'number_line'])).max(2).nullish(),
  });

  /** Provenance stamp for the v3 evidence join — grading reads these back. */
  const stampPedagogy = (
    provenance: Record<string, unknown>,
    data: { kcId?: string | null; strategy?: string | null },
  ): Record<string, unknown> => ({
    ...provenance,
    ...(data.kcId ? { kc_id: data.kcId } : {}),
    ...(data.strategy ? { strategy: data.strategy } : {}),
  });

  /**
   * Ladder tiers 1 and 2 (/ORACLE.md §7).
   *
   * On a miss this returns `needsGeneration` rather than an error, because a
   * miss is a normal state — most skills have no pack yet — and because tier 3
   * is Oracle's to author and Core's to verify.
   */
  router.post('/segments', async (req, res) => {
    const parsed = SegmentRequestBody.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, VALIDATION, parsed.error.issues[0]?.message ?? 'Invalid request');

    const session = await getTutorSession(parsed.data.sessionId);
    if (!session) return fail(res, 404, NOT_FOUND, 'No such session');

    const served = await listTutorSegments(session.id);
    if (served === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not read served segments');
    const alreadyServed = served.map((s) => String((s.payload as { id?: unknown }).id ?? ''));
    const nextSeq = served.length;

    /*
     * `unknown` IS AN ANSWER, and a better one than a guess.
     *
     * In an open conversation the tutor has no lesson plan and no skill states
     * to copy a key from, so it used to invent one — `making_change`,
     * `matematicas/sumar-con-monedas`, plausible and naming nothing. The prompt
     * now offers it this sentinel instead: say you do not know, and the system
     * decides. Skipping the by-name tiers is not a loss, because a key that
     * names nothing was never going to match them.
     */
    const namedSkill = parsed.data.skillKey === 'unknown' ? null : parsed.data.skillKey;
    const skill = namedSkill === null ? null : await resolveSkill(namedSkill);
    if (!skill && namedSkill !== null) {
      /*
       * A key that does not resolve is almost always one the MODEL invented.
       * The prompt never told it what a skillKey looks like, so it produced
       * things like `making_change` — and `resolveSkill` requires
       * `course-slug/topic-slug`, so tier 1 and tier 2 could never match and
       * every activity fell through to live generation. That is why the
       * twenty-three mapped knowledge components went unused in open sessions,
       * and why "Esa actividad ya no está lista" kept appearing.
       *
       * Logged rather than rejected: the fallbacks below still have a chance,
       * and refusing here would take away an activity rather than find one.
       * The line is what makes the frequency visible if it starts again.
       */
      console.warn(`[tutor] segment request named an unresolvable skill: ${parsed.data.skillKey}`);
    }

    let candidate: LadderCandidate | null = null;
    if (skill) {
      candidate = await serveFromCatalog({
        skill,
        locale: session.locale,
        difficulty: parsed.data.difficulty,
        excludeSegmentIds: alreadyServed,
        // Seeded on the session so a learner does not get lesson 1 every time,
        // but the sequence within one session stays stable.
        rotationSeed: hashSeed(session.id),
        preferredTypes: parsed.data.preferredTypes,
      });
    }
    if (!candidate) {
      candidate = namedSkill === null ? null : await serveFromBank({
        skillKey: namedSkill,
        tier: session.tier,
        locale: session.locale,
        preferredTypes: parsed.data.preferredTypes,
        difficulty: parsed.data.difficulty,
        excludeSegmentIds: alreadyServed,
      });
    }

    /*
     * THE GRAPH EARNS ITS KEEP: A PREREQUISITE THAT DOES HAVE CONTENT.
     *
     * Five of the twenty-eight knowledge components have no published topic
     * that teaches them — `kc.skill_key` is null on purpose, because mapping
     * one to an unrelated topic would serve confidently wrong content. Before
     * this, landing on one of those five meant tier 1 and tier 2 both missed,
     * live generation was the only path left, and when it failed the learner
     * got "Esa actividad ya no está lista" — observed on 2026-08-29 the moment
     * a conversation drifted onto goods-versus-services.
     *
     * But a knowledge component that nothing teaches almost always has a
     * PREREQUISITE that something does, and practising the prerequisite is a
     * pedagogically sound answer to "I have nothing at your level" — it is
     * what a human tutor does when the next step is not ready. So before
     * falling through to generation, walk one edge back and try the mapped
     * prerequisites of the KC this turn is about.
     *
     * ONE edge, not the transitive closure. Two steps back from what the tutor
     * just said is no longer about the conversation the learner is in, and a
     * recursive walk over a graph with cycles-by-mistake is a way to hang a
     * request rather than answer it.
     */
    if (!candidate && parsed.data.kcId) {
      const [edges, kcs] = await Promise.all([getKcEdges(), getActiveKcs()]);
      if (edges && kcs) {
        const byId = new Map(kcs.map((k) => [k.id, k]));
        const prerequisiteKeys = edges
          .filter((e) => e.dependent_kc_id === parsed.data.kcId)
          .map((e) => byId.get(e.prerequisite_kc_id)?.skill_key)
          .filter((k): k is string => typeof k === 'string' && k !== '');

        for (const key of prerequisiteKeys) {
          const fallbackSkill = await resolveSkill(key);
          if (!fallbackSkill) continue;
          candidate = await serveFromCatalog({
            skill: fallbackSkill,
            locale: session.locale,
            difficulty: parsed.data.difficulty,
            excludeSegmentIds: alreadyServed,
            rotationSeed: hashSeed(session.id),
            preferredTypes: parsed.data.preferredTypes,
          });
          if (candidate) {
            console.warn(
              `[tutor] no content for the active KC; served its prerequisite ${key} instead`,
            );
            break;
          }
        }
      }
    }

    /*
     * LAST RESORT BEFORE GENERATION: WHAT THE LEARNER IS ACTUALLY READY FOR.
     *
     * The model names the skill, and it can name one that does not exist. The
     * prompt now states the format and tells it to copy a key from its
     * context — but an OPEN conversation has no lesson plan and no skill
     * states to copy from, so it invents a plausible one. Observed 2026-08-29:
     * `mathematics/sumar-con-monedas`, correct in shape and naming a course
     * that has never existed.
     *
     * Rather than fall through to generation — the most fragile rung, and the
     * one that produced "Esa actividad ya no está lista" — ask the pedagogy
     * layer what this learner should be doing next. `continueTarget` is the
     * planner's own first pick: review debt if any is due, otherwise the
     * frontier. Serving that is not a guess, it is the answer the product
     * already computes for the CONTINUE button.
     *
     * It is deliberately LAST. A key that resolved, a bank pack, and the KC's
     * own prerequisites all describe what the tutor was talking about; this
     * one describes the learner instead, and is right only when nothing better
     * is available.
     */
    if (!candidate) {
      const map = await buildTutorMap(session.user_id, session.tier, session.locale);
      const frontierKey = map?.continueTarget?.skillKey ?? null;
      if (frontierKey !== null && frontierKey !== namedSkill) {
        const frontierSkill = await resolveSkill(frontierKey);
        if (frontierSkill) {
          candidate = await serveFromCatalog({
            skill: frontierSkill,
            locale: session.locale,
            difficulty: parsed.data.difficulty,
            excludeSegmentIds: alreadyServed,
            rotationSeed: hashSeed(session.id),
            preferredTypes: parsed.data.preferredTypes,
          });
          if (candidate) {
            console.warn(
              `[tutor] "${parsed.data.skillKey}" found nothing; served the learner's own next step ${frontierKey}`,
            );
          }
        }
      }
    }

    if (!candidate) {
      return ok(res, {
        needsGeneration: true,
        skillKey: parsed.data.skillKey,
        tier: session.tier,
        locale: session.locale,
        difficulty: parsed.data.difficulty,
        allowedTypes: [...LIVE_TYPE_ALLOWLIST],
      });
    }

    candidate.provenance = stampPedagogy(candidate.provenance, parsed.data);
    return persistAndServe(res, session.id, nextSeq, candidate, session.tier);
  });

  const VerifyBody = z.object({
    sessionId: z.string().uuid(),
    segment: z.record(z.string(), z.unknown()),
    provenance: z.record(z.string(), z.unknown()),
    kcId: z.string().uuid().nullish(),
    strategy: z.string().max(16).nullish(),
  });

  /**
   * Tier 3: verify a generated candidate and, only if it holds, persist it.
   *
   * The generator does not get to certify its own output. A candidate that
   * fails any check produces NOTHING (/ORACLE.md §7.3) — the caller falls back
   * and says so honestly rather than showing something generic.
   */
  router.post('/segments/verify', async (req, res) => {
    const parsed = VerifyBody.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, VALIDATION, parsed.error.issues[0]?.message ?? 'Invalid candidate');

    const session = await getTutorSession(parsed.data.sessionId);
    if (!session) return fail(res, 404, NOT_FOUND, 'No such session');

    const segment = parsed.data.segment as unknown as SegmentBase;
    const verification = verifyGeneratedSegment(segment, session.tier);
    if (!verification.ok) {
      return ok(res, { accepted: false, failures: verification.failures });
    }

    const seq = (await countSessionSegments(session.id)) ?? 0;
    return persistAndServe(
      res,
      session.id,
      seq,
      {
        origin: 'live',
        lessonId: null,
        segment,
        answer: (segment.answer as Record<string, unknown> | undefined) ?? null,
        provenance: stampPedagogy(
          { ...parsed.data.provenance, tier: 3, verification: verification.failures },
          parsed.data,
        ),
      },
      session.tier,
      verification.keyVerified,
    );
  });

  /**
   * v3 voice-check: a spoken answer, verified DETERMINISTICALLY (/ORACLE.md).
   *
   * Oracle calls this when the learner's turn plausibly contains an answer to
   * the open segment. Core normalizes the utterance to a number, runs the REAL
   * grader against the stored key, and records the evidence — no XP (XP stays
   * on the graded widget path), no model judgment anywhere.
   *
   * `recognized: false` is a first-class answer meaning "no number could be
   * read out of this", and the caller MUST treat it as a plain conversation
   * turn. Child speech through STT is noisy; unparseable is never wrong.
   */
  const VoiceCheckBody = z
    .object({
      sessionId: z.string().uuid(),
      utterance: z.string().min(1).max(500),
      strategy: z.string().max(16).nullish(),
    })
    .strict();

  /**
   * The voice-checkable set. The first three take a `{value}` submission and
   * run through their real grader; the money trays are special-cased — the
   * SPOKEN answer to a tray is the amount ("son tres pesos"), not a list of
   * coins, so the verdict is exact arithmetic against the payload's own
   * numbers (target, or paid_with − price), which is the same source the
   * grader itself reads.
   */
  const VOICE_CHECK_TYPES = new Set(['number_input', 'count_objects', 'estimate_slider', 'coin_count', 'make_change']);
  const TRAY_TYPES = new Set(['coin_count', 'make_change']);

  const trayExpected = (segment: SegmentBase): number | null => {
    const payload = segment.payload as { target?: unknown; price?: unknown; paid_with?: unknown };
    if (typeof payload.target === 'number') return payload.target;
    if (typeof payload.price === 'number' && typeof payload.paid_with === 'number') {
      return payload.paid_with - payload.price;
    }
    return null;
  };

  router.post('/segments/:segmentId/voice-check', async (req, res) => {
    const segmentId = z.string().uuid().safeParse(req.params.segmentId);
    if (!segmentId.success) return fail(res, 400, VALIDATION, 'Invalid segment id');
    const parsed = VoiceCheckBody.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, VALIDATION, parsed.error.issues[0]?.message ?? 'Invalid body');

    const row = await getTutorSegment(segmentId.data);
    if (!row) return fail(res, 404, NOT_FOUND, 'No such segment');
    if (row.session_id !== parsed.data.sessionId) return fail(res, 403, 'FORBIDDEN', 'Segment is not in this session');

    const session = await getTutorSession(row.session_id);
    if (!session) return fail(res, 404, NOT_FOUND, 'No such session');
    if (session.ended_at !== null) return fail(res, 409, 'SESSION_CLOSED', 'This session has already ended');

    const segment = row.payload as unknown as SegmentBase;
    const isTray = TRAY_TYPES.has(segment.type);
    // Trays carry an EMPTY key by design (self-contained payloads); the other
    // checkable types need their stored key to grade at all.
    if (!VOICE_CHECK_TYPES.has(segment.type) || (!isTray && row.answer === null)) {
      return ok(res, { checkable: false, recognized: false });
    }

    const value = normalizeSpokenNumber(parsed.data.utterance, session.locale);
    if (value === null) return ok(res, { checkable: true, recognized: false });

    const withKey: SegmentBase = { ...segment, answer: row.answer ?? undefined };
    let score: number;
    if (isTray) {
      const expected = trayExpected(segment);
      if (expected === null) return ok(res, { checkable: false, recognized: false });
      score = Math.abs(value - expected) <= 0.005 ? 100 : 0;
    } else {
      const grader = GRADERS[segment.type];
      if (!grader) return ok(res, { checkable: false, recognized: false });
      let outcome: { score: number };
      try {
        outcome = grader(withKey, { value });
      } catch {
        return ok(res, { checkable: true, recognized: false });
      }
      score = Math.max(0, Math.min(100, Math.round(outcome.score)));
    }

    const provenance = row.provenance ?? {};
    const kcId = typeof provenance.kc_id === 'string' ? provenance.kc_id : null;
    let pedagogy: AttemptOutcome | null = null;
    if (kcId && getConfig().TUTOR_V3_BRAIN) {
      pedagogy = await recordAttempt({
        userId: session.user_id,
        sessionId: session.id,
        segmentId: row.id,
        kcId,
        segment: withKey,
        submission: { value },
        score,
        attemptNumber: Math.max(1, row.attempts + 1),
        source: 'voice_check',
        strategy: parsed.data.strategy ?? null,
      });
    }

    return ok(res, {
      checkable: true,
      recognized: true,
      value,
      correct: score >= PASS_THRESHOLD,
      score,
      misconceptionCode: pedagogy?.misconceptionCode ?? null,
      pKnownAfter: pedagogy?.pKnownAfter ?? null,
    });
  });

  return router;
}

/**
 * One closed session, digested for the next one's memory. Topic title,
 * skill keys, a closed outcome, two counters — nothing anyone said.
 */
function memoryDigest(
  session: TutorSessionRow,
  segments: TutorSegmentRow[] | null,
  topicTitle: string | null,
): SessionSummaryDigest {
  const skillKeys = new Set<string>();
  if (session.skill_key) skillKeys.add(session.skill_key);
  let gradedTotal = 0;
  let gradedCorrect = 0;
  for (const segment of segments ?? []) {
    const provenance = segment.provenance ?? {};
    const key = provenance['skill_key'] ?? provenance['skillKey'];
    if (typeof key === 'string' && key) skillKeys.add(key);
    if (segment.score !== null) {
      gradedTotal += 1;
      if (segment.score >= PASS_THRESHOLD) gradedCorrect += 1;
    }
  }
  const reason = session.close_reason;
  const outcome: SessionSummaryDigest['outcome'] =
    reason === 'safety_stop'
      ? 'stopped'
      : reason === 'completed' || reason === 'soft_budget' || reason === 'hard_budget'
        ? 'completed'
        : 'left';
  return {
    topic: topicTitle,
    courseId: session.course_id,
    topicId: session.topic_id,
    skillKeys: [...skillKeys].slice(0, 5),
    outcome,
    gradedCorrect: Math.min(gradedCorrect, 50),
    gradedTotal: Math.min(gradedTotal, 50),
  };
}

/** Days since an ISO timestamp, clamped to the retention window. */
function daysAgo(iso: string, now = Date.now()): number {
  return Math.max(0, Math.min(90, Math.floor((now - new Date(iso).getTime()) / 86_400_000)));
}

/** Hash a uuid into a small non-negative integer, for stable rotation. */
function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash;
}

async function persistAndServe(
  res: Parameters<typeof ok>[0],
  sessionId: string,
  seq: number,
  candidate: LadderCandidate,
  tier: number,
  keyVerifiedOverride?: boolean,
): Promise<unknown> {
  // A catalog or bank segment was human-published, so its key is verified by
  // construction. A live one is verified only if re-execution said so.
  const keyVerified = keyVerifiedOverride ?? candidate.origin !== 'live';

  const row = await insertTutorSegment({
    sessionId,
    seq,
    origin: candidate.origin,
    lessonId: candidate.lessonId,
    segmentType: candidate.segment.type,
    payload: candidate.segment as unknown as Record<string, unknown>,
    answer: candidate.answer,
    keyVerified,
    provenance: candidate.provenance,
    // Sample live segments into the human review queue (/ORACLE.md §7.3). This
    // does not protect the first learner; it is what catches a SYSTEMATIC
    // defect before it reaches the thousandth.
    reviewStatus: candidate.origin === 'live' && shouldSampleForReview() ? 'pending' : null,
  });
  if (!row) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not record the segment');

  void tier;
  return ok(res, {
    segmentId: row.id,
    seq,
    origin: candidate.origin,
    segment: stripCandidate(candidate.segment),
    keyVerified,
  });
}

function shouldSampleForReview(): boolean {
  return Math.random() < getConfig().TUTOR_LIVE_REVIEW_SAMPLE_RATE;
}

interface CourseTitleRow {
  id: string;
  title: Record<string, string>;
}

async function resolveCourseContext(
  courseId: string | null,
  topicId: string | null,
  locale: string,
): Promise<{ courseId: string | null; courseTitle: string | null; topicId: string | null; topicTitle: string | null } | null> {
  const pick = (title: Record<string, string> | undefined): string | null =>
    title?.[locale] ?? title?.['es-MX'] ?? Object.values(title ?? {})[0] ?? null;

  const course = courseId
    ? (await serviceRest<CourseTitleRow[]>(`/courses?id=eq.${encodeURIComponent(courseId)}&select=id,title&limit=1`))?.[0]
    : undefined;
  const topic = topicId
    ? (await serviceRest<CourseTitleRow[]>(`/topics?id=eq.${encodeURIComponent(topicId)}&select=id,title&limit=1`))?.[0]
    : undefined;

  if (!course && !topic) return null;
  return {
    courseId: course?.id ?? null,
    courseTitle: pick(course?.title),
    topicId: topic?.id ?? null,
    topicTitle: pick(topic?.title),
  };
}

/** A friendly word, not a name, for a learner who has not chosen a nickname. */
function neutralNickname(locale: string): string {
  if (locale === 'en-US') return 'Explorer';
  if (locale === 'pt-BR') return 'Explorador';
  return 'Explorador';
}

// ────────────────────────────────────────────────────────────────────────────
// Public surface
// ────────────────────────────────────────────────────────────────────────────

export function tutorRouter(): Router {
  const router = Router();

  // FIRST, so no later `/:param` route can shadow it.
  router.use('/internal', internalRouter());

  router.use(requireAuth);

  // ── Personalization ───────────────────────────────────────────────────────

  router.get('/preferences', async (_req, res) => {
    const user = authedUser(res);
    const prefs = await getTutorPreferences(user.id);
    if (prefs === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not read preferences');
    return ok(res, {
      character: prefs.character,
      companion: prefs.companion,
      diorama: prefs.diorama,
      backdrop: prefs.backdrop,
      nickname: prefs.nickname,
      adaptations: prefs.adaptations,
      /*
       * Whether this learner has ever SAVED a preference — which, since the
       * picker's Done now always persists, means "has been offered the
       * picker". The client used to remember this in localStorage only, so a
       * cleared browser re-opened the picker forever. The epoch sentinel is
       * `getTutorPreferences`' own marker for "no row yet"; no schema change.
       */
      personalized: prefs.updated_at !== new Date(0).toISOString(),
      // The catalog travels WITH the preferences so the picker is driven by
      // the server, never by a hard-coded list in the client that drifts the
      // moment a diorama is added (/ORACLE.md §0 assumption 1).
      catalog: {
        characters: [...CHARACTERS],
        dioramas: [...DIORAMAS],
        backdrops: [...BACKDROPS],
        adaptations: [...ADAPTATIONS],
        // rho and zara have working mouths; liruf and dina do not
        // (/TUTOR_3D.md §3.1). All four are selectable (owner decision 4) and
        // the UI needs to know which get the closer framing.
        articulates: ['rho', 'zara'],
      },
    });
  });

  const PreferencesBody = z
    .object({
      character: z.enum(CHARACTERS).optional(),
      companion: z.enum(CHARACTERS).nullable().optional(),
      diorama: z.enum(DIORAMAS).optional(),
      backdrop: z.enum(BACKDROPS).optional(),
      nickname: z
        .string()
        .trim()
        .min(1)
        .max(24)
        .regex(/^[\p{L}\p{N}][\p{L}\p{N} '_-]*$/u, 'nickname.invalid')
        .nullable()
        .optional(),
      adaptations: z.array(z.enum(ADAPTATIONS)).max(ADAPTATIONS.length).optional(),
    })
    .strict();

  router.put('/preferences', async (req, res) => {
    const parsed = PreferencesBody.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, VALIDATION, parsed.error.issues[0]?.message ?? 'Invalid preferences');
    const user = authedUser(res);

    if (parsed.data.companion && parsed.data.character && parsed.data.companion === parsed.data.character) {
      return fail(res, 400, VALIDATION, 'The companion cannot be the same character as the tutor');
    }

    const saved = await upsertTutorPreferences(user.id, parsed.data);
    if (!saved) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not save preferences');
    const prefs = await getTutorPreferences(user.id);
    if (prefs === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not read preferences back');
    return ok(res, {
      character: prefs.character,
      companion: prefs.companion,
      diorama: prefs.diorama,
      backdrop: prefs.backdrop,
      nickname: prefs.nickname,
      adaptations: prefs.adaptations,
    });
  });

  // ── The learning map (Tutor v3) ───────────────────────────────────────────

  /**
   * The KC graph as this learner sees it — the SAME graph the session planner
   * traverses, so the map and the tutor can never disagree about "where were
   * we". 502 on an upstream failure (§1.14: a missing map is not an empty
   * one); an unseeded graph yields an empty map, which the client says
   * honestly.
   */
  router.get('/map', async (_req, res) => {
    const user = authedUser(res);
    if (!getConfig().TUTOR_V3_BRAIN) return ok(res, { nodes: [], edges: [], continueTarget: null, review: { count: 0 } });

    const profile = await profileOf(user.accessToken, user.id);
    if (!profile) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not read profile');

    const map = await buildTutorMap(user.id, tierForBirthDate(profile.birth_date), normalizeLocale(profile.locale));
    if (map === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not read the learning map');
    return ok(res, map);
  });

  // ── The offer screen (/ORACLE.md §9.2) ────────────────────────────────────

  router.get('/offers', async (_req, res) => {
    const user = authedUser(res);
    const profile = await profileOf(user.accessToken, user.id);
    const locale = normalizeLocale(profile?.locale);

    const roles = await getRolesForGate(user.id);
    if (roles === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not resolve roles');
    const isMinor = roles.includes('kid');

    /*
     * Voice availability is resolved HERE, before the session starts, because
     * the offer screen carries the "talk out loud" checkbox. Discovering that
     * the microphone is unavailable only after the session opens means the
     * learner ticked a box that did nothing, which is worse than a checkbox
     * that was honestly absent.
     */
    const consent = isMinor ? await getActiveVoiceConsent(user.id) : null;
    const runtime = await preflight(isMinor, true);

    const states = await getOwnLearnerIntelligence(user.id);

    // Cold start is the NORMAL case right now, not an edge case: the courses
    // sit in `review`, so most learners have no evidence at all. The offer set
    // says so honestly instead of inventing a weakness.
    const weak =
      states
        ?.filter((s) => s.recommendedAction === 'remediate' || s.recommendedAction === 'practice')
        .filter((s) => s.evidenceCount >= 3 && s.uncertainty <= 0.35)
        .slice(0, 3) ?? [];

    /*
     * CONTINUITY. The latest memory digest (see the close handler) becomes a
     * "continue where you left off" opening — the ids it kept internally are
     * exactly what a new session needs to reopen the same ground. Best-effort:
     * no digest, no chip, and the offer screen is what it always was.
     */
    const recent = await listRecentSummaries(user.id);
    const last = recent?.[0] ?? null;

    /*
     * The flagged skill's HUMAN title, for the one chip that shows it. The
     * client used to run the raw slug through a regex (`readableSkill`) and
     * show "Ahorro con meta" carved out of "financial-education/ahorro-con-
     * meta" — passable in Spanish, wrong the moment a slug and its title
     * diverge. Resolved only for the first entry because only the first is
     * ever rendered.
     */
    const flagged = weak[0];
    const flaggedContext =
      flagged && (flagged.courseId || flagged.topicId)
        ? await resolveCourseContext(flagged.courseId, flagged.topicId, locale)
        : null;

    return ok(res, {
      locale,
      lastSession: last
        ? {
            topic: last.summary.topic,
            courseId: last.summary.courseId,
            topicId: last.summary.topicId,
            skillKey: last.summary.skillKeys[0] ?? null,
            outcome: last.summary.outcome,
            daysAgo: daysAgo(last.ended_at),
          }
        : null,
      intelDegraded: states === null,
      /** Whether Oracle can serve at all right now — the button is honest about it. */
      canStart: runtime.canStart,
      startBlockedBy: runtime.canStart ? null : runtime.blockedBy,
      voiceAvailable: runtime.voiceAvailable,
      /** Distinct reasons deserve distinct copy: no consent vs no provider. */
      microphoneBlockedBy: microphoneBlockedBy(isMinor, consent !== null, runtime),
      // The tutor offers, never diagnoses. The client renders these as
      // invitations, and declining is not recorded as a fact about anyone.
      weakSkills: weak.map((s, index) => ({
        skillKey: s.skillKey,
        title:
          index === 0 ? (flaggedContext?.topicTitle ?? flaggedContext?.courseTitle ?? null) : null,
        courseId: s.courseId,
        topicId: s.topicId,
        recommendedAction: s.recommendedAction,
        reasonCode: s.reasonCode,
      })),
      // A closed, human-written question set. Never a free-text box (§9.2).
      faqIds: ['what_is_saving', 'why_prices_change', 'what_is_a_budget', 'how_does_a_loan_work'],
      canAskOpen: true,
    });
  });

  // ── Sessions ──────────────────────────────────────────────────────────────

  const StartBody = z
    .object({
      intent: z.enum(['course_topic', 'weak_skill', 'faq', 'open', 'diagnostic']),
      courseId: z.string().uuid().nullish(),
      topicId: z.string().uuid().nullish(),
      skillKey: z.string().min(1).max(128).nullish(),
      wantsVoice: z.boolean().default(false),
    })
    .strict();

  router.post('/sessions', async (req, res) => {
    const parsed = StartBody.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, VALIDATION, parsed.error.issues[0]?.message ?? 'Invalid request');
    const user = authedUser(res);

    const roles = await getRolesForGate(user.id);
    if (roles === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not resolve roles');
    const isMinor = roles.includes('kid');

    const profile = await profileOf(user.accessToken, user.id);
    if (!profile) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not read profile');

    const started = await countSessionsSince(user.id, startOfTodayIso());
    if (started === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not read session history');
    /*
     * THE DAILY CAP IS A PRODUCT PROMISE TO PARENTS, NOT A RATE LIMIT — a
     * tutor that sends a child away is the anti-addiction stance the product
     * takes deliberately, so this number is not weakened and is not made
     * configurable by env, where it would drift.
     *
     * Staff are exempt because they are not the people it protects, and
     * because the alternative was worse: iterating on the Tutor means starting
     * sessions, and with a cap of two the person fixing it is locked out after
     * two attempts and cannot see their own next change until tomorrow. That
     * is how a defect survives — not because nobody could fix it, but because
     * nobody could look at it twice in one evening.
     */
    const isStaff = roles.includes('admin') || roles.includes('superadmin');
    if (!isStaff && started >= MAX_SESSIONS_PER_DAY) {
      return fail(res, 429, 'SESSION_LIMIT', 'You have used all of today’s tutor sessions');
    }

    // THE MICROPHONE GATE. Blocking, not a flag (/ORACLE.md §4.3). A minor with
    // no active guardian consent gets a working, silent session — never a
    // session that quietly opens a microphone.
    const consent = isMinor ? await getActiveVoiceConsent(user.id) : null;
    const wantsVoice = parsed.data.wantsVoice && (!isMinor || consent !== null);

    const runtime = await preflight(isMinor, wantsVoice);
    if (!runtime.canStart) {
      return fail(res, 503, runtime.blockedBy ?? 'ORACLE_UNAVAILABLE', 'The tutor is not available right now');
    }

    const prefs = await getTutorPreferences(user.id);
    if (prefs === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not read preferences');

    const session = await createTutorSession({
      userId: user.id,
      locale: normalizeLocale(profile.locale),
      tier: tierForBirthDate(profile.birth_date),
      character: prefs.character,
      companion: prefs.companion,
      diorama: prefs.diorama,
      intent: parsed.data.intent,
      courseId: parsed.data.courseId ?? null,
      topicId: parsed.data.topicId ?? null,
      skillKey: parsed.data.skillKey ?? null,
      voiceUsed: wantsVoice && runtime.microphoneAvailable,
      consentId: consent?.id ?? null,
    });
    if (!session) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not start the session');

    const { url, expiresAt } = tutorSocketUrl(session.id, user.id);
    return ok(
      res,
      {
        sessionId: session.id,
        socketUrl: url,
        socketExpiresAt: expiresAt,
        character: session.character,
        companion: session.companion,
        diorama: session.diorama,
        backdrop: prefs.backdrop,
        locale: session.locale,
        voiceAvailable: runtime.voiceAvailable,
        microphoneAvailable: wantsVoice && runtime.microphoneAvailable,
        // So the UI can explain a silent session rather than looking broken.
        microphoneBlockedBy: microphoneBlockedBy(isMinor, consent !== null, runtime),
      },
      201,
    );
  });

  router.get('/sessions', async (_req, res) => {
    const user = authedUser(res);
    const sessions = await listTutorSessions(user.id);
    if (sessions === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not read sessions');
    return ok(res, { sessions: sessions.map(summarizeSession) });
  });

  /**
   * A fresh single-use socket token for a session whose connection dropped
   * (/ORACLE.md §3.2 resume, owner sign-off 2026-08-28). Oracle parks the
   * dropped orchestrator for a grace window; this is the other half — the
   * ONLY way a browser gets back in, because the original token was burned on
   * first use by design.
   *
   * Owner only, deliberately narrower than the transcript route: a guardian
   * may READ a child's finished conversation, but a live microphone-bearing
   * socket belongs to the learner alone. No daily-cap check — resuming is not
   * a new session. No preflight — Oracle answers for itself at the handshake,
   * and a resume racing a degraded Oracle should fail at the socket with a
   * named close code rather than be guessed at here.
   */
  router.post('/sessions/:id/resume', async (req, res) => {
    const sessionId = z.string().uuid().safeParse(req.params.id);
    if (!sessionId.success) return fail(res, 400, VALIDATION, 'Invalid session id');
    const user = authedUser(res);

    const session = await getTutorSession(sessionId.data);
    if (!session) return fail(res, 404, NOT_FOUND, 'No such session');
    if (session.user_id !== user.id) return fail(res, 403, 'FORBIDDEN', 'This is not your session');
    if (session.ended_at !== null) {
      // The park expired, or the session closed cleanly. Either way there is
      // nothing to re-attach to, and minting a token for a closed session
      // would only buy the learner a SESSION_NOT_FOUND at the socket.
      return fail(res, 409, 'SESSION_CLOSED', 'This session has already ended');
    }

    const { url, expiresAt } = tutorSocketUrl(session.id, user.id);
    return ok(res, { sessionId: session.id, socketUrl: url, socketExpiresAt: expiresAt });
  });

  /** A full transcript, for replay (/ORACLE.md §12). Owner or verified guardian. */
  router.get('/sessions/:id', async (req, res) => {
    const sessionId = z.string().uuid().safeParse(req.params.id);
    if (!sessionId.success) return fail(res, 400, VALIDATION, 'Invalid session id');
    const user = authedUser(res);

    const session = await getTutorSession(sessionId.data);
    if (!session) return fail(res, 404, NOT_FOUND, 'No such session');

    if (session.user_id !== user.id) {
      const guardian = await isVerifiedGuardian(user.id, session.user_id);
      if (guardian === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not verify guardianship');
      // Parent visibility is a product invariant, and so is its converse:
      // nobody else reads a child's conversation.
      if (!guardian) return fail(res, 403, 'FORBIDDEN', 'This is not your session');
    }

    const [turns, segments] = await Promise.all([listTutorTurns(session.id), listTutorSegments(session.id)]);
    if (turns === null || segments === null) {
      return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not read the transcript');
    }

    return ok(res, {
      session: summarizeSession(session),
      turns,
      // stripCandidate, not the raw row: `tutor_segments.answer` is
      // service-role-only and must not reach a client even on a replay.
      segments: segments.map((s) => ({
        segmentId: s.id,
        seq: s.seq,
        origin: s.origin,
        segment: stripCandidate(s.payload as unknown as SegmentBase),
        score: s.score,
        xpAwarded: s.xp_awarded,
      })),
    });
  });

  // ── Grading (/ORACLE.md §8) ───────────────────────────────────────────────

  const GradeBody = z
    .object({
      answer: z.unknown(),
      attemptNumber: z.number().int().min(1).max(3).default(1),
      hintsUsed: z.number().int().min(0).max(2).default(0),
    })
    .strict();

  router.post('/segments/:segmentId/grade', async (req, res) => {
    const segmentId = z.string().uuid().safeParse(req.params.segmentId);
    if (!segmentId.success) return fail(res, 400, VALIDATION, 'Invalid segment id');
    const parsed = GradeBody.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, VALIDATION, parsed.error.issues[0]?.message ?? 'Invalid submission');
    const user = authedUser(res);

    const row = await getTutorSegment(segmentId.data);
    if (!row) return fail(res, 404, NOT_FOUND, 'No such segment');

    const session = await getTutorSession(row.session_id);
    if (!session) return fail(res, 404, NOT_FOUND, 'No such session');
    if (session.user_id !== user.id) return fail(res, 403, 'FORBIDDEN', 'This is not your segment');

    const segment = row.payload as unknown as SegmentBase;
    const withKey: SegmentBase = { ...segment, answer: row.answer ?? undefined };

    const grader = GRADERS[segment.type];
    if (!grader || (withKey.answer === undefined && !KEYLESS_GRADERS.has(segment.type))) {
      return fail(res, 422, 'UNSUPPORTED_SEGMENT', 'This segment cannot be graded');
    }

    let outcome: { score: number; feedback_md?: string };
    try {
      outcome = grader(withKey, parsed.data.answer);
    } catch {
      // A grader that throws is our bug, not the learner's. Score zero, allow
      // a retry, and never surface a stack trace to a child.
      outcome = { score: 0 };
    }

    const penalised = Math.round(outcome.score * (1 - Math.min(parsed.data.hintsUsed, 2) * 0.1));
    const score = Math.max(0, Math.min(100, penalised));
    const verdict = verdictFrom(score, PASS_THRESHOLD, outcome.feedback_md);

    /*
     * XP is payable ONLY when the key survived re-execution (/ORACLE.md §8).
     * A live segment whose key could not be independently re-derived still
     * teaches — the learner sees the feedback — but it awards nothing, because
     * awarding progress for a result the server could not verify is how a
     * generated exercise quietly corrupts a child's record.
     */
    const baseXp = typeof segment.xp === 'number' ? segment.xp : 0;
    let xp = row.key_verified ? Math.round((score / 100) * baseXp) : 0;

    if (xp > 0) {
      const earnedToday = await tutorXpSince(user.id, startOfTodayIso());
      if (earnedToday === null) {
        // Refuse rather than default to zero-earned-today, which would let the
        // cap be bypassed by any transient read failure (§1.14).
        return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not read today’s tutor XP');
      }
      xp = Math.max(0, Math.min(xp, MAX_TUTOR_XP_PER_DAY - earnedToday));
    }

    const recorded = await recordSegmentResult({
      segmentId: row.id,
      score,
      xpAwarded: xp,
      attempts: parsed.data.attemptNumber,
    });
    if (!recorded) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not record the result');
    if (xp > 0) await addSessionXp(session.id, xp);

    /*
     * THE V3 EVIDENCE JOIN. When the segment was served for a knowledge
     * component (provenance.kc_id, stamped at serve time), this grade is also
     * pedagogy: misconception diagnosis, BKT update, FSRS review — all on the
     * grade clock, never the voice turn. Best-effort AFTER the grade landed:
     * a pedagogy failure is logged loudly inside recordAttempt and costs
     * adaptation quality, never the learner's score or XP.
     *
     * The signed `echo` rides back through the client into Oracle's
     * segment_graded frame — that signature is what stops a client from
     * fabricating pedagogy events (it could already fabricate its own score;
     * it must not be able to steer the strategy machine too).
     */
    const provenance = row.provenance ?? {};
    const kcId = typeof provenance.kc_id === 'string' ? provenance.kc_id : null;
    let pedagogy: AttemptOutcome | null = null;
    if (kcId && getConfig().TUTOR_V3_BRAIN) {
      pedagogy = await recordAttempt({
        userId: user.id,
        sessionId: row.session_id,
        segmentId: row.id,
        kcId,
        segment: withKey,
        submission: parsed.data.answer,
        score,
        attemptNumber: parsed.data.attemptNumber,
        source: 'segment_grade',
        strategy: typeof provenance.strategy === 'string' ? provenance.strategy : null,
      });
    }

    return ok(res, {
      verdict,
      xpAwarded: xp,
      scoresXp: row.key_verified,
      dailyXpCap: MAX_TUTOR_XP_PER_DAY,
      pedagogy: pedagogy
        ? {
            kcId: pedagogy.kcId,
            correct: pedagogy.correct,
            pKnownAfter: pedagogy.pKnownAfter,
            misconceptionCode: pedagogy.misconceptionCode,
            reviewDueAt: pedagogy.reviewDueAt,
            echo: pedagogy.echo,
          }
        : null,
    });
  });

  // ── Consent (/ORACLE.md §4.3) ─────────────────────────────────────────────

  const ConsentBody = z
    .object({
      kidUserId: z.string().uuid(),
      /** The exact wording the guardian was shown. Stored verbatim. */
      consentText: z.string().min(40).max(4_000),
      locale: z.enum(['en-US', 'es-MX', 'pt-BR']),
    })
    .strict();

  router.post('/consent', async (req, res) => {
    const parsed = ConsentBody.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, VALIDATION, parsed.error.issues[0]?.message ?? 'Invalid consent');
    const user = authedUser(res);

    const guardian = await isVerifiedGuardian(user.id, parsed.data.kidUserId);
    if (guardian === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not verify guardianship');
    // Only a VERIFIED guardian may grant. Not a parent-in-general, not the
    // child, and not an admin acting on their behalf.
    if (!guardian) return fail(res, 403, 'FORBIDDEN', 'Only a verified guardian can grant this consent');

    /*
     * POLICY BEFORE PERSISTENCE (/ORACLE.md §16, the DPA decision).
     *
     * While `TUTOR_VOICE_FOR_MINORS` is off, a granted consent buys the family
     * NOTHING — the socket refuses the microphone anyway — and costs them
     * something real: this row stores the wording verbatim as the record of
     * what a guardian agreed to, and that wording is a placeholder awaiting
     * counsel. Collecting an unreviewed agreement for a capability we do not
     * offer is worse than not collecting it, so the write is refused here as
     * well as hidden in the UI. Two independent guards, because the UI one is
     * a rendering decision and this one is the record.
     *
     * Revocation below is deliberately NOT gated the same way: a consent
     * granted before the flag flipped must always be withdrawable.
     */
    const policy = await preflight(true, true);
    // `!== 'allowed'`, not `=== 'blocked'`. The field is optional on the wire,
    // so an Oracle that omits it — an older build, a truncated payload — must
    // read as "no" rather than as permission. Absent is not consent.
    if (policy.minorVoicePolicy !== 'allowed') {
      return fail(
        res,
        409,
        'POLICY_BLOCKED',
        'Microphone consent is not being collected yet',
      );
    }

    const row = await grantVoiceConsent({
      userId: parsed.data.kidUserId,
      grantedBy: user.id,
      consentText: parsed.data.consentText,
      locale: parsed.data.locale,
    });
    if (!row) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not record consent');
    return ok(res, { granted: true, grantedAt: row.granted_at }, 201);
  });

  router.get('/consent/:kidUserId', async (req, res) => {
    const kidUserId = z.string().uuid().safeParse(req.params.kidUserId);
    if (!kidUserId.success) return fail(res, 400, VALIDATION, 'Invalid user id');
    const user = authedUser(res);

    if (kidUserId.data !== user.id) {
      const guardian = await isVerifiedGuardian(user.id, kidUserId.data);
      if (guardian === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not verify guardianship');
      if (!guardian) return fail(res, 403, 'FORBIDDEN', 'Not your dependant');
    }

    /*
     * The consent state and the POLICY are different facts and the surface
     * needs both. Without the policy the control can only offer a switch, and
     * a guardian who flips it has agreed to placeholder wording in exchange
     * for a microphone that stays shut — a permission that does nothing reads
     * as a broken product at best and a dark pattern at worst.
     *
     * Read even when a consent already exists, because the answer changes what
     * the guardian is told about a consent they already granted.
     */
    const [consent, policy] = await Promise.all([
      getActiveVoiceConsent(kidUserId.data),
      preflight(true, true),
    ]);
    return ok(res, {
      active: consent !== null,
      grantedAt: consent?.granted_at ?? null,
      locale: consent?.locale ?? null,
      // `PREFLIGHT_DOWN` reports 'blocked', so an unreachable Oracle degrades
      // to the honest, conservative answer rather than to an optimistic one —
      // and anything that is not an explicit 'allowed' reads the same way.
      policy: policy.minorVoicePolicy === 'allowed' ? 'allowed' : 'blocked',
    });
  });

  router.delete('/consent/:kidUserId', async (req, res) => {
    const kidUserId = z.string().uuid().safeParse(req.params.kidUserId);
    if (!kidUserId.success) return fail(res, 400, VALIDATION, 'Invalid user id');
    const user = authedUser(res);

    // A learner may always revoke their OWN. A guardian may revoke a
    // dependant's. Revocation is deliberately easier than granting.
    if (kidUserId.data !== user.id) {
      const guardian = await isVerifiedGuardian(user.id, kidUserId.data);
      if (guardian === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not verify guardianship');
      if (!guardian) return fail(res, 403, 'FORBIDDEN', 'Not your dependant');
    }

    const revoked = await revokeVoiceConsent(kidUserId.data, user.id);
    if (!revoked) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not revoke consent');
    return ok(res, { revoked: true });
  });

  // ── Guardian visibility (/ORACLE.md §12) ──────────────────────────────────

  router.get('/kids/:kidUserId/sessions', async (req, res) => {
    const kidUserId = z.string().uuid().safeParse(req.params.kidUserId);
    if (!kidUserId.success) return fail(res, 400, VALIDATION, 'Invalid user id');
    const user = authedUser(res);

    const guardian = await isVerifiedGuardian(user.id, kidUserId.data);
    if (guardian === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not verify guardianship');
    if (!guardian) return fail(res, 403, 'FORBIDDEN', 'Not your dependant');

    const [sessions, flags] = await Promise.all([
      listTutorSessions(kidUserId.data),
      listSafetyFlags(kidUserId.data),
    ]);
    if (sessions === null || flags === null) {
      return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not read the child’s tutor history');
    }

    return ok(res, {
      sessions: sessions.map(summarizeSession),
      // Guardian-visible on purpose: a child disclosing distress to a tutor is
      // precisely the case where a parent must find out.
      safetyFlags: flags,
    });
  });

  return router;
}

function summarizeSession(session: {
  id: string;
  locale: string;
  character: string;
  companion: string | null;
  diorama: string;
  intent: string;
  started_at: string;
  ended_at: string | null;
  close_reason: string | null;
  turn_count: number;
  segment_count: number;
  xp_awarded: number;
}) {
  return {
    id: session.id,
    locale: session.locale,
    character: session.character,
    companion: session.companion,
    diorama: session.diorama,
    intent: session.intent,
    startedAt: session.started_at,
    endedAt: session.ended_at,
    closeReason: session.close_reason,
    turnCount: session.turn_count,
    segmentCount: session.segment_count,
    xpAwarded: session.xp_awarded,
  };
}
