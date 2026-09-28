import { requireAgeScreen } from '../middleware/ageScreen.js';
import { readAgeScreen, type AgeScreenState } from '../services/ageScreen.js';
import { knownMentorAgeTier, MentorAgeTier, readMentorAgeCalibration, recordMentorAgeCalibration, resolveInternalMentorAge } from '../services/mentorAgeCalibration.js';
import { Router } from 'express';
import { z } from 'zod';
import { getConfig } from '../config.js';
import { authedUser, requireAuth, requireInternalKey } from '../middleware/auth.js';
import { fail, ok } from '../lib/http.js';
import { getRolesForGate } from '../services/insights.js';
import { resolveMentorSafety } from '../services/mentorSafety.js';
import {
  getFullOwnProfile,
  getVerifiedKidLinks,
  getVerifiedGuardiansOfKid,
  insertAuditLog,
  serviceRest,
  type FullProfileRow,
} from '../services/supabaseRest.js';
import { getOwnLearnerIntelligence } from '../services/learningIntel.js';
import {
  CLOSING_SCRIPTS,
  decideOpening,
  getPreviousClosedSession,
  recordSessionEndSignal,
  SESSION_OPENINGS,
  SessionEndReportBody,
} from '../services/pedagogy/sessionEnd.js';
import {
  BehavioralTelemetryReportBody,
  CONTEXT_OPTIONAL_FIELDS,
  getTelemetryKillSwitch,
  recordTelemetryFirings,
} from '../services/pedagogy/behavioralTelemetry.js';
import {
  AllianceReportBody,
  BOND_PROXY_ANSWERS,
  getAllianceKillSwitch,
  getAllianceRow,
  recordAllianceClose,
  SelfExplanationReportBody,
  writeBondProxy,
  ALLIANCE_THRESHOLDS,
} from '../services/pedagogy/alliance.js';
import {
  decideContinuity,
  deleteDispositionProfile,
  DispositionObservationBody,
  explainProfile,
  getDispositionProfile,
  listRecentPersonaSessions,
  purgeStaleDispositionProfiles,
  recordDispositionBondProxy,
  recordDispositionClose,
  toOracleProjection,
} from '../services/pedagogy/disposition.js';
import {
  getSpacedReviewKillSwitch,
  recordSpacedReviewClose,
  SpacedReviewReportBody,
} from '../services/pedagogy/spacedReview.js';
import {
  dialogueBandFor,
  DialogueCalibrationReportBody,
  getDialogueKillSwitch,
  recordDialogueCalibrationClose,
  resolveDialogueCalibration,
  type DialogueCalibration,
} from '../services/pedagogy/dialogueCalibration.js';
import { tutorSocketUrl } from '../services/tutorToken.js';
import {
  ADAPTATIONS,
  CHARACTERS,
  BACKDROPS,
  DIORAMAS,
  addTutorSessionCost,
  awardTutorXp,
  closeTutorSession,
  countTutorSessionsSince,
  startTutorSessionChecked,
  getActiveVoiceConsent,
  getTutorPreferences,
  getTutorSegment,
  getTutorSession,
  grantVoiceConsent,
  insertSafetyFlag,
  insertTutorSegmentChecked,
  insertTutorTrajectory,
  insertTutorTurn,
  listRecentSummaries,
  getLearnerMemory,
  writeLearnerMemoryPair,
  // The parental approval gate (/ORACLE.md §20, migration 0068).
  parkLearnerMemoryProposal,
  listPendingLearnerMemoryProposals,
  getLearnerMemoryProposal,
  decideLearnerMemoryProposal,
  type LearnerMemoryProposalRow,
  searchOwnTurns,
  // Class V artifacts (migration 0069, TUTOR_INSTRUMENTS.md §3.6).
  getTutorPlan,
  writeTutorPlan,
  insertNotebookEntry,
  listNotebookEntries,
  listSafetyFlags,
  listPlacementSafetyFlags,
  listTutorSegments,
  listTutorSessions,
  listTutorTurns,
  getTutorRetentionStatus,
  markSegmentVoiceChecked,
  recordSegmentResult,
  RETENTION_SWEEP_AUDIT_ACTION,
  revokeVoiceConsent,
  setSessionSummary,
  upsertTutorPreferences,
  type SessionSummaryDigest,
  type TutorSegmentRow,
  type TutorSessionRow,
} from '../services/tutorData.js';
import {
  collectSegmentProse,
  LIVE_TYPE_ALLOWLIST,
  resolveSkill,
  serveFromBank,
  serveFromCatalog,
  stripCandidate,
  verifyGeneratedSegment,
  type LadderCandidate,
} from '../services/tutorLadder.js';
import { classifyLiveContent, type ContentRiskCategory } from '../services/pedagogy/contentRisk.js';
import {
  admitLiveCandidate,
  getLiveContentGate,
  insertLiveSegmentChecked,
  liveGenerationOpen,
  recordLadderEvent,
  sessionSafetyFlagCount,
  type LadderRoute,
} from '../services/pedagogy/liveContentGovernance.js';
import {
  getActiveKcs,
  getKcEdges,
  getKcBySkillKey,
  getKcAttemptsForSessions,
  getKcTitlesByIds,
  type KcRow,
  type Localized,
} from '../services/pedagogy/kcData.js';
import { purgeExpiredTutorSessions } from '../services/tutorRetention.js';
import { buildSessionPlan } from '../services/pedagogy/sessionPlan.js';
import { buildMasteryEvidence } from '../services/pedagogy/masteryEvidence.js';
import { revealsAnswerKey } from '../services/pedagogy/answerReveal.js';
import { buildTutorMap } from '../services/pedagogy/tutorMap.js';
import { recordTurnHonesty } from '../services/pedagogy/turnHonesty.js';
import { recordAttempt, type AttemptOutcome } from '../services/pedagogy/recordAttempt.js';
import { buildSessionNarrative, type SessionNarrative } from '../services/pedagogy/sessionNarrative.js';
import { normalizeSpokenNumber } from '../services/pedagogy/normalizeSpoken.js';
import { GRADERS, KEYLESS_GRADERS } from '../lesson-contract/registry.js';
import type { SegmentBase } from '../lesson-contract/core/types.js';
import { verdictFrom } from '../lesson-contract/core/types.js';
import { runEvaluationPass } from '../services/pedagogy/evaluationLoop.js';

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
/** C.4 / OD-18 (2026-09-24): no eligible reviewer exists for this account's memory notes. */
const MEMORY_REVIEW_INELIGIBLE = 'MEMORY_REVIEW_INELIGIBLE';

/**
 * A closed, human-written question set. Never a free-text box (§9.2).
 *
 * Found by adversarial review, round 40 (2026-08-30, HIGH): this list used
 * to exist ONLY as an inline literal in the `/offers` response — the actual
 * gate at session-start time (`StartBody` below) validated `skillKey` as any
 * `string.min(1).max(128)`, regardless of `intent`. A crafted `POST
 * /sessions` with `{ intent: 'faq', skillKey: <anything> }` was accepted,
 * and that string reached Oracle's `plan.ts` as the lesson's `objective` —
 * a live prompt-injection channel directly contradicting this comment's own
 * "never a free-text box" claim. Shared here so `/offers` and `StartBody`'s
 * `.superRefine` below can never drift apart.
 */
const FAQ_IDS = ['what_is_saving', 'why_prices_change', 'what_is_a_budget', 'how_does_a_loan_work'] as const;

/** Daily caps (/ORACLE.md §15, §0 assumption 5). */
const MAX_SESSIONS_PER_DAY = 2;
/**
 * The staff exemption's "effectively unlimited" cap, capped ITSELF at
 * Postgres's `int4` ceiling.
 *
 * Found live, testing as a real logged-in `admin` account, 2026-08-30
 * (HIGH): every staff attempt to start a Tutor session failed with a 502
 * ("Could not start the session"), because `start_tutor_session_checked`
 * (`database/migrations/0057_atomic_tutor_session_cap.sql`) declares
 * `p_cap int` — Postgres's 32-bit `int4`, max 2147483647 — and this route
 * was passing `Number.MAX_SAFE_INTEGER` (9007199254740991) as the staff
 * cap. PostgREST coercing that value into the function's own parameter
 * type threw `ERROR: integer out of range` (confirmed directly: `SELECT
 * 9007199254740991::int` fails with that exact message), `serviceRest`
 * correctly returned null on the failure, and the route correctly turned
 * that into a loud 502 rather than a silent wrong success — but the net
 * effect was that the ONE escape hatch the route's own comment describes
 * ("the person fixing it is locked out... nobody could look at it twice
 * in one evening") could never be used at all. `2147483647` is still
 * unreachable by any real per-day session count.
 */
const STAFF_SESSION_CAP = 2_147_483_647;
/**
 * The ONE definition of "this account is staff, so the USAGE limits do not
 * apply to it".
 *
 * Extracted 2026-09-01, when the exemption grew from one limit (the daily
 * session cap, below) to also cover the session's own duration and turn
 * budget in Oracle. The expression was already written inline twice; a third
 * copy in a different file, evaluated at a different moment, is the shape
 * AGENTS.md §1.14 records under hand-tuned constants drifting apart — and a
 * role set that disagreed between "may start another session" and "may keep
 * this one open" would be invisible until someone was cut off mid-test by
 * exactly the limit they had been exempted from.
 *
 * SCOPE, deliberately: `admin` as well as `superadmin`, matching what the
 * session cap has always exempted rather than inventing a second, narrower
 * set for the new half of the same feature. Both roles are granted, never
 * self-served (§1.4), and `superadmin` is additionally DB-restricted to
 * `@littlefounders.ai` addresses (§1.3), so the blast radius is a staff list
 * somebody deliberately wrote.
 *
 * WHAT THIS DOES NOT EXEMPT, and must never be extended to: the
 * platform-wide daily spend ceiling (`DAILY_SPEND_CEILING_USD`,
 * `oracle/src/session/spend-guard.ts`). That control exists precisely for
 * the runaway case, and an unattended staff session with no session cap, no
 * duration cap and no turn cap is the single most plausible way to produce
 * one. Nor does it touch moderation, consent, or the §1.9 PII boundary —
 * those are safety, not usage.
 */
export function isStaffRoles(roles: readonly string[]): boolean {
  return roles.includes('admin') || roles.includes('superadmin');
}
/** Without a cap the tutor is the cheapest XP per minute and courses become optional (§8). */
const MAX_TUTOR_XP_PER_DAY = 120;
const PASS_THRESHOLD = 70;

/**
 * Start of "today" in the calendar day the LEARNER experiences, not the
 * server's UTC day.
 *
 * Found by adversarial review, round 34 (2026-08-30, MEDIUM-HIGH,
 * systematic — not a rare boundary case). This used to be a plain
 * `Date.UTC(...)` midnight, and UTC midnight falls in the afternoon or
 * evening local time for all three of this platform's locales (roughly
 * 13:00-21:00 depending on locale and DST). So an entirely ordinary
 * morning session and evening session, both on the SAME local calendar
 * day, were treated as two different cap windows — letting a third or
 * fourth session through on what is, for that learner, still today. This
 * was reachable through completely ordinary use, every day, for the large
 * majority of the real user base, not an edge case near a boundary.
 *
 * There is no stored per-user timezone (a bigger feature than this fix
 * adds), so the locale maps to one representative IANA zone — an
 * approximation for `en-US`, which spans several US timezones, but still
 * strictly more correct than a UTC boundary for the other two locales, and
 * no worse than UTC was for the one it cannot represent precisely.
 */
const LOCALE_TIMEZONE: Record<'en-US' | 'es-MX' | 'pt-BR', string> = {
  'es-MX': 'America/Mexico_City',
  'pt-BR': 'America/Sao_Paulo',
  'en-US': 'America/New_York',
};

/**
 * `daysAhead` (default 0, "today") lets the SAME offset-derivation serve the
 * daily cap's own reset instant: `daysAhead: 1` is "tomorrow's local
 * midnight" — the exact moment `MAX_SESSIONS_PER_DAY` allows another session,
 * because `sinceIso` above is this same function's `daysAhead: 0`. `Date.UTC`
 * accepts an out-of-range day and rolls the month/year forward correctly, so
 * a request on the last day of the month needs no special case.
 *
 * Reuses `now`'s own UTC offset for the target day rather than recomputing
 * it for that day specifically — the same approximation this function's own
 * header comment already accepts for `daysAhead: 0` (no DST-transition-day
 * correction). A SESSION_LIMIT reset estimate off by an hour on the handful
 * of nights a locale's clocks change is a UI approximation, not a cap
 * enforcement bug — the cap itself is still enforced against the real
 * boundary computed fresh on the request that matters.
 */
export function startOfLocalDayIso(
  locale: 'en-US' | 'es-MX' | 'pt-BR',
  now: Date = new Date(),
  daysAhead = 0,
): string {
  const timeZone = LOCALE_TIMEZONE[locale];
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  // The clock reading `now` HAS in `timeZone`, reinterpreted as if it were
  // UTC, reveals that zone's current UTC offset — derived from `now` itself
  // rather than a fixed table, so it is correct across a DST transition.
  // `% 24` guards against `Intl`'s documented midnight-as-"24" quirk under
  // `hour12: false`.
  const asIfUtcMs = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  const offsetMs = asIfUtcMs - now.getTime();
  const localMidnightUtcMs =
    Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + daysAhead, 0, 0, 0) - offsetMs;
  return new Date(localMidnightUtcMs).toISOString();
}

/**
 * The wire shape of the SESSION_LIMIT refusal's one extra field (§1.9
 * clarity — a vague "come back tomorrow" cannot tell a child whether the
 * wait is ten minutes or nearly a day).
 *
 * Kept as a validated schema rather than a bare `.toISOString()` call so a
 * regression in the day-ahead arithmetic above — `daysAhead` silently
 * dropped, a sign flip, `now` passed instead of the intended instant — fails
 * LOUDLY here (a 500, caught by every gate that hits this route) instead of
 * reaching a child's screen as a countdown to a moment already in the past.
 */
const SessionLimitResetAt = z
  .string()
  .datetime()
  .refine((iso) => new Date(iso).getTime() > Date.now(), 'resetAt must be in the future');

function normalizeLocale(raw: string | null | undefined): 'en-US' | 'es-MX' | 'pt-BR' {
  return raw === 'en-US' || raw === 'pt-BR' ? raw : 'es-MX';
}

/**
 * True when a nickname is the learner's own real name, or contains it.
 *
 * Found by adversarial review, 2026-08-30 (HIGH): `PreferencesBody`'s
 * nickname regex only excludes punctuation (`/^[\p{L}\p{N}][\p{L}\p{N}
 * '_-]*$/u`) — it accepts SPACES, so a clean two-word name with no comma or
 * period sails through untouched. The existing rejection test only proved
 * this for `'Ana Vasquez, Jr.'`, which fails on the comma, not on being a
 * full name; a bare `'Ana Vasquez'` — literally a real learner's own
 * `display_name` — was never checked against anything. That nickname is
 * "the only name-shaped value that may travel" into the model context
 * (`tutor.ts`'s own comment, a few lines below where it is read), and
 * `oracle/src/context/schema.ts`'s `NicknameSchema` doc calls it "a place to
 * hide a surname" — this closes the one place nothing ever checked that.
 *
 * Word-based rather than whole-string, so "Vasquez" alone (the surname on
 * its own, §1.9's specific example) is caught exactly as "Ana Vasquez" is,
 * without also rejecting a nickname that merely shares a short, common word
 * with the real name by coincidence.
 */
function looksLikeRealName(nickname: string, displayName: string): boolean {
  const wordsOf = (s: string): string[] =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 3);
  const realWords = new Set(wordsOf(displayName));
  if (realWords.size === 0) return false;
  return wordsOf(nickname).some((w) => realWords.has(w));
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

/**
 * C.4 / OD-18 (24 September 2026): WHO may review a persistent LEARNER-store
 * memory note about this account. Resolved from server-held evidence — roles
 * read with the service role, verified guardian links, the stored age-screen
 * declaration — never from anything the caller says about itself.
 *
 *   'guardian-review'  a verified guardian link exists, or the account still
 *                      carries the legacy `kid` role (the conservative hold
 *                      for legacy kid records with no link): the existing
 *                      guardian proposal flow reviews the note.
 *   'self-review'      an independent screened teen (a stored 13_to_17
 *                      declaration, no protected origin, no `kid` role, no
 *                      verified guardian link): the teen is the reviewer of
 *                      their own notes, through their own learner session.
 *   'adult-direct'     a screened adult declaration: the existing ungated
 *                      write behaviour is preserved (OD-18 changes nothing
 *                      for adults).
 *   'hold'             every other state — a missing age declaration, an
 *                      under-13/origin-marked account with no guardian link
 *                      to review it — refuses the write: fail closed. Never
 *                      silently auto-approved.
 *
 * `null` means one of the reads itself failed. Callers refuse that as 502
 * DATA_UNAVAILABLE rather than folding it into any of the four outcomes
 * (§1.14 — a role read that failed must not silently reclassify a child as
 * an adult).
 */
type MemoryReviewClass = 'guardian-review' | 'self-review' | 'adult-direct' | 'hold';

async function classifyMemoryReview(userId: string): Promise<MemoryReviewClass | null> {
  const [roles, guardians, age] = await Promise.all([
    getRolesForGate(userId),
    getVerifiedGuardiansOfKid(userId),
    readAgeScreen(userId),
  ]);
  if (
    roles === null ||
    !Array.isArray(guardians) ||
    !z.array(z.string().uuid()).safeParse(guardians).success ||
    age === null
  ) {
    return null;
  }
  if (roles.includes('kid') || guardians.length > 0) return 'guardian-review';
  // `readAgeScreen` forces the band to 'under_13' whenever the protected-origin
  // marker is present, so the band alone decides the remaining populations.
  if (age.ageBand === '13_to_17') return 'self-review';
  if (age.ageBand === 'adult') return 'adult-direct';
  return 'hold';
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
  originRestricted = false,
): string | null {
  if (originRestricted) return 'POLICY_BLOCKED';
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
    const screening = await readAgeScreen(session.user_id);
    if (!screening) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not resolve age screening');
    if (screening.required) return fail(res, 403, 'AGE_SCREEN_REQUIRED', 'Complete age screening first');
    const calibration = await resolveInternalMentorAge(session.user_id, screening);
    if (!calibration) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not resolve mentor age calibration');
    if (calibration.tier === null) return fail(res, 403, 'MENTOR_AGE_CALIBRATION_REQUIRED', 'Complete mentor age calibration first');
    if (calibration.tier !== session.tier) return fail(res, 409, 'SESSION_AGE_CHANGED', 'Start a session with the confirmed teaching register');

    const prefs = await getTutorPreferences(session.user_id);
    if (prefs === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not read tutor preferences');

    const roles = await getRolesForGate(session.user_id);
    if (roles === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not resolve roles');
    const { isMinor, originRestricted } = await resolveMentorSafety(session.user_id, roles);

    const consent = isMinor && !originRestricted ? await getActiveVoiceConsent(session.user_id) : null;

    // A failed personalization read is NOT an empty one (/ORACLE.md §14). The
    // flag travels so the tutor can say it is still getting to know the
    // learner rather than silently behaving as though they know nothing.
    const states = await getOwnLearnerIntelligence(session.user_id);
    const intelDegraded = states === null;

    let courseContext =
      session.course_id || session.topic_id
        ? await resolveCourseContext(session.course_id, session.topic_id, session.locale)
        : null;

    /*
     * `weak_skill` WITHOUT a course/topic link — the common shape (round 47,
     * 2026-08-30, HIGH): `OfferChips.tsx`'s "continue" chip sends only
     * `skillKey` whenever the prior session had no course/topic. With
     * `courseContext` null, `buildPlan` (oracle/src/tutor/plan.ts) fell
     * through to the raw `skill_key` slug — e.g.
     * `financial-education/la-gran-cosecha-de-monedas-del-festival`, a
     * narrative lesson-title fragment, not a description — as the WHOLE
     * lesson objective, embedded unfenced in the system prompt. `kc.title` is
     * OUR clean, localized catalog text for exactly this skill_key and was
     * never looked up on this path. Resolved here into the SAME field
     * `course_topic` already uses, so `buildPlan`'s existing fallback chain
     * picks up a readable title with no change to Oracle's wire schema.
     * `session.skill_key` is guaranteed to name a real KC by this point — the
     * `POST /sessions` handler now refuses to start a `weak_skill` session
     * whose skillKey does not (see that check's own comment) — so this is a
     * plain lookup, not a second validation.
     */
    if (courseContext === null && session.intent === 'weak_skill' && session.skill_key) {
      const kc = await getKcBySkillKey(session.skill_key);
      if (kc.status === 'found') {
        const title =
          kc.kc.title[session.locale as keyof typeof kc.kc.title] ??
          kc.kc.title['es-MX'] ??
          Object.values(kc.kc.title)[0] ??
          null;
        if (title !== null) {
          courseContext = { courseId: null, courseTitle: null, topicId: null, topicTitle: title };
        }
      }
      // Neither 'not_found' (should not happen given the POST-time check,
      // short of the KC being deleted in between) nor 'error' gets a special
      // branch: both degrade to the pre-existing raw-skillKey fallback in
      // `buildPlan` rather than refusing an already-running session — a
      // failed or missing lookup here costs a less-readable objective, never
      // the session itself.
    }

    /*
     * The memory digests (/ORACLE.md §4.1, 2026-08-28). Only the fields
     * Oracle's PreviousSessionSchema names travel; the internal course/topic
     * ids the digest also stores stay here. A failed read degrades to a tutor
     * with no memory — never to a refused session.
     */
    const recent = await listRecentSummaries(session.user_id, session.id);
    /*
     * V4: the curated learner brief (0053). A read failure is NOT an empty
     * brief (/AGENTS.md, round 28, 2026-08-30, HIGH) — `learnerBriefDegraded`
     * travels alongside it so Oracle's post-session review can refuse to
     * treat "we could not read it" as "this learner has none" and overwrite
     * real accumulated memory with a note written from a false premise.
     */
    const learnerBriefResult = await getLearnerMemory(session.user_id);
    const learnerBriefDegraded = learnerBriefResult === null;
    const learnerBrief = learnerBriefResult ?? { learner: null, pedagogy: null };

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

    /*
     * C.16: the re-engagement a silent dropout or a budget interruption in the
     * learner's PREVIOUS session queued for this return. Decided here from
     * Core's own rows; a failed read opens with the plain greeting, never
     * with a guess about what happened last time.
     */
    const previousClose = await getPreviousClosedSession(session.user_id, session.id);
    const opening =
      previousClose === undefined
        ? 'greeting'
        : decideOpening(previousClose, {
            course_id: session.course_id,
            topic_id: session.topic_id,
            skill_key: session.skill_key,
          });

    /*
     * The optional context fields the CALLING Oracle can parse (it names them
     * in `x-oracle-context-fields`). Oracle's context schema is `.strict()`,
     * so a field an older Oracle does not know would make it refuse every
     * session: an optional field is sent only when it was announced, which
     * makes the Core/Oracle deploy order irrelevant. Kept identical to
     * Oracle's CONTEXT_OPTIONAL_FIELDS by `npm run telemetry:check`.
     */
    const accepts = new Set(
      String(req.get('x-oracle-context-fields') ?? '')
        .split(',')
        .map((f) => f.trim())
        .filter((f) => (CONTEXT_OPTIONAL_FIELDS as readonly string[]).includes(f)),
    );
    /*
     * C.9/C.19 Appendix F Stage 7 AUTOMATIC ROLLBACK: while the Behavioral
     * Telemetry Layer's kill-switch condition holds (or a trip is unresolved),
     * Oracle runs it in shadow — measuring, never acting. Evaluated only for
     * an Oracle that can receive it.
     */
    const killSwitch = accepts.has('behavioralTelemetryMode') ? await getTelemetryKillSwitch() : null;
    /*
     * C.7 / C.15: the learner's disposition projection, this persona's
     * continuity and the Alliance Controller's Stage 7 verdict — each only
     * for an Oracle that announced it can parse it. SERVER-SIDE ONLY: Oracle
     * keeps them out of the sealed model context. A FAILED read is not an
     * empty profile (§1.14): the projection travels as null (nothing is
     * changed) and the continuity as null (the ordinary opening), never as a
     * guess about this learner.
     */
    const wantsDisposition = accepts.has('dispositionProfile') || accepts.has('allianceContinuity');
    const dispositionRow = wantsDisposition ? await getDispositionProfile(session.user_id) : undefined;
    const recentPersonas = accepts.has('allianceContinuity') ? await listRecentPersonaSessions(session.user_id, session.id) : null;
    const allianceContinuity =
      accepts.has('allianceContinuity') && dispositionRow !== undefined && recentPersonas !== null
        ? decideContinuity(dispositionRow, recentPersonas, session.character as 'dina' | 'liruf' | 'rho' | 'zara', new Date())
        : null;
    const allianceKillSwitch = accepts.has('allianceMode') ? await getAllianceKillSwitch() : null;
    /*
     * C.11 Appendix F Stage 7: the spaced-review router's automatic rollback
     * verdict — evaluated only for an Oracle that can receive it.
     */
    const spacedReviewSwitch = accepts.has('spacedReviewMode') ? await getSpacedReviewKillSwitch() : null;
    /*
     * C.17: the dialogue register. The band is derived HERE from Core's own
     * age evidence (the birth date never travels); the variant comes from the
     * adults-only H.7 experiment or is the SPEC's calibrated default. Anything
     * unexpected sends null — Oracle then uses the tier fallback, never a
     * guess about this learner's age.
     */
    let dialogueCalibration: DialogueCalibration | null = null;
    if (accepts.has('dialogueCalibration')) {
      try {
        const { band, age } = dialogueBandFor({ birthDate: calibration.birthDate, screening, tier: session.tier });
        const dialogueSwitch = await getDialogueKillSwitch();
        dialogueCalibration = await resolveDialogueCalibration({
          userId: session.user_id,
          band,
          age,
          roles,
          screening,
          eligibleBands: getConfig().MENTOR_DIALOGUE_EXPERIMENT_BANDS,
          rollback: dialogueSwitch.rollback,
        });
      } catch (error) {
        console.error('[tutor] dialogue calibration could not be decided — the tier fallback applies:', error);
        dialogueCalibration = null;
      }
    }

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
      learnerBriefDegraded,
      skillStates: (states ?? []).slice(0, 12).map((s) => ({
        skillKey: s.skillKey,
        masteryProbability: s.masteryProbability,
        uncertainty: s.uncertainty,
        evidenceCount: s.evidenceCount,
        recommendedAction: s.recommendedAction,
        reasonCode: s.reasonCode,
      })),
      isMinor,
      /*
       * The USAGE-limit exemption, travelling as a single derived boolean —
       * never the role list itself. Oracle has no business knowing WHICH
       * staff role this is, only that the duration and turn budgets do not
       * bind it (`session/budget.ts`), and the narrowest true thing is the
       * one to send. Same shape and same reasoning as `isMinor` directly
       * above: a policy flag derived here, where the roles are already read
       * and already fail closed on an unreadable answer (502, line ~396),
       * so an unknown role can never arrive at Oracle as "staff".
       */
      isStaff: isStaffRoles(roles),
      voiceConsent: consent !== null,
      intelDegraded,
      sessionPlan: pedagogyPlan?.plan ?? null,
      kcStates: pedagogyPlan?.kcStates ?? null,
      ...(accepts.has('opening') ? { opening } : {}),
      ...(killSwitch !== null ? { behavioralTelemetryMode: killSwitch.mode } : {}),
      ...(accepts.has('dispositionProfile')
        ? { dispositionProfile: dispositionRow ? toOracleProjection(dispositionRow) : null }
        : {}),
      ...(accepts.has('allianceContinuity') ? { allianceContinuity } : {}),
      ...(allianceKillSwitch !== null ? { allianceMode: allianceKillSwitch.mode } : {}),
      ...(spacedReviewSwitch !== null ? { spacedReviewMode: spacedReviewSwitch.mode } : {}),
      ...(accepts.has('dialogueCalibration') ? { dialogueCalibration } : {}),
    });
  });

  /**
   * V4's live sequence board, exactly as Oracle computed it. Validated at
   * the edge like everything else here (§1.6) — a `.strict()` closed shape,
   * mirroring `oracle/src/ws/protocol.ts`'s `WireSequenceBoard`. Found by
   * adversarial review, round 35 (2026-08-30, HIGH): no field for this
   * existed at all, so a session that drew a board lost it silently on
   * replay and on the guardian transcript viewer (migration 0058).
   */
  const SequenceWhiteboardBody = z
    .object({
      kind: z.literal('sequence'),
      start: z.number(),
      steps: z
        .array(z.object({ op: z.enum(['add', 'subtract', 'multiply_percent']), value: z.number() }).strict())
        .min(1)
        .max(8),
      unit: z.enum(['day', 'week', 'month', 'year']),
      values: z.array(z.number()),
      label: z.string().max(60),
      currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
    })
    .strict();

  /**
   * `compare` and `marked_line` — two static quantities side by side, and
   * one or more values placed on a line between two references, SHIPPED
   * 2026-09-01 (ORACLE.md §20.5's "Two more kinds"), mirroring
   * `oracle/src/ws/protocol.ts`'s `WireWhiteboard`. Same rigor as
   * `SequenceWhiteboardBody` above: a `.strict()` closed shape per kind, so
   * this endpoint refuses a malformed board rather than silently persisting
   * one. Found missing entirely during the `categories` merge (2026-09-01):
   * this endpoint validated `sequence` and (once added) `categories`, but
   * never gained a `compare`/`marked_line` branch when THOSE kinds shipped —
   * so a live `compare`/`marked_line` turn would have failed this
   * `.safeParse` on `POST /turns` and lost its board silently on replay, the
   * exact round-35 class this file's own header comment warns about, for a
   * kind added without the matching backend update.
   */
  const CompareWhiteboardBody = z
    .object({
      kind: z.literal('compare'),
      left: z.object({ label: z.string().max(60), value: z.number() }).strict(),
      right: z.object({ label: z.string().max(60), value: z.number() }).strict(),
      difference: z.number(),
      greater: z.enum(['left', 'right', 'tie']),
      label: z.string().max(60),
      currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
    })
    .strict();

  const MarkedLineWhiteboardBody = z
    .object({
      kind: z.literal('marked_line'),
      min: z.number(),
      max: z.number(),
      marks: z
        .array(z.object({ value: z.number(), label: z.string().max(60), position: z.number() }).strict())
        .min(1)
        .max(4),
      label: z.string().max(60),
      currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
    })
    .strict();

  /**
   * The `categories` kind — a comparison across named things at one moment
   * rather than one quantity over time (the first bounded slice of "UI
   * generativa acotada", blueprint §10.4 — ORACLE.md §20.5), mirroring
   * `oracle/src/ws/protocol.ts`'s `WireCategoriesBoard`. Same rigor as
   * `SequenceWhiteboardBody` above: a `.strict()` closed shape, so this
   * endpoint refuses a malformed board rather than silently persisting one.
   */
  const CategoriesWhiteboardBody = z
    .object({
      kind: z.literal('categories'),
      categories: z
        .array(z.object({ label: z.string().max(40), value: z.number() }).strict())
        .min(2)
        .max(6),
      values: z.array(z.number()),
      label: z.string().max(60),
      currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
    })
    .strict();

  /**
   * The `tokens` kind — discrete, denominated objects on the table rather than
   * a chart (/TUTOR_INSTRUMENTS.md, Sprint 6), mirroring
   * `oracle/src/ws/protocol.ts`'s tokens member. `subtotals` and `total` are
   * SERVER-COMPUTED (`oracle/src/tutor/whiteboard.ts`'s `computeTokens`): the
   * sum of a pile is the arithmetic the learner is doing, so the model is given
   * no field to assert it, exactly as it is given no `greater` on a comparison.
   * `currency` is non-nullable here alone, because a coin with no currency is
   * not money and its denomination could not be verified against anything.
   */
  const TokensWhiteboardBody = z
    .object({
      kind: z.literal('tokens'),
      groups: z
        .array(z.object({ denomination: z.number(), count: z.number().int() }).strict())
        .min(1)
        .max(6),
      subtotals: z.array(z.number()),
      total: z.number(),
      label: z.string().max(60),
      currency: z.enum(['MXN', 'USD', 'BRL']),
    })
    .strict();

  /*
   * WAVE 1 INSTRUMENTS (/TUTOR_INSTRUMENTS.md Sprints 7-8), each mirroring its
   * member of `oracle/src/ws/protocol.ts`'s `WireWhiteboard`. Every one carries
   * at least one SERVER-COMPUTED field the model-facing schema deliberately
   * lacks — a bar model's widths, a flow's `kept`, a goal's `remaining`, a
   * worked example's values and its check — because in each case that number is
   * the thing the learner is working out.
   */
  const BarModelWhiteboardBody = z
    .object({
      kind: z.literal('bar_model'),
      whole: z.object({ label: z.string().max(40), value: z.number() }).strict(),
      parts: z
        .array(z.object({ label: z.string().max(40), value: z.number().nullable() }).strict())
        .min(2)
        .max(3),
      widths: z.array(z.number()),
      unknownIndex: z.number().int().nullable(),
      label: z.string().max(60),
      currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
    })
    .strict();

  const PartWholeWhiteboardBody = z
    .object({
      kind: z.literal('part_whole'),
      whole: z.object({ label: z.string().max(40), value: z.number() }).strict(),
      left: z.object({ label: z.string().max(40), value: z.number() }).strict(),
      right: z.object({ label: z.string().max(40), value: z.number() }).strict(),
      label: z.string().max(60),
      currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
    })
    .strict();

  const FlowWhiteboardBody = z
    .object({
      kind: z.literal('flow'),
      income: z.object({ label: z.string().max(40), value: z.number() }).strict(),
      spent: z.object({ label: z.string().max(40), value: z.number() }).strict(),
      keptLabel: z.string().max(40),
      kept: z.number(),
      label: z.string().max(60),
      currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
    })
    .strict();

  const GoalBarWhiteboardBody = z
    .object({
      kind: z.literal('goal_bar'),
      goal: z.object({ label: z.string().max(40), value: z.number() }).strict(),
      saved: z.object({ label: z.string().max(40), value: z.number() }).strict(),
      remaining: z.number(),
      savedFraction: z.number(),
      label: z.string().max(60),
      currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
    })
    .strict();

  const WorkedWhiteboardBody = z
    .object({
      kind: z.literal('worked'),
      start: z.number(),
      steps: z.array(z.object({ op: z.enum(['add', 'subtract']), value: z.number() }).strict()).min(1).max(4),
      values: z.array(z.number()),
      checkValue: z.number(),
      label: z.string().max(60),
      currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
    })
    .strict();

  /* The canonical primary-maths vocabulary (/TUTOR_INSTRUMENTS.md §3.1). */
  const TenFrameWhiteboardBody = z
    .object({
      kind: z.literal('ten_frame'),
      count: z.number().int(),
      frames: z.array(z.number().int()),
      label: z.string().max(60),
    })
    .strict();

  const OpenNumberLineWhiteboardBody = z
    .object({
      kind: z.literal('open_number_line'),
      from: z.number(),
      to: z.number(),
      jumps: z.array(z.object({ value: z.number() }).strict()).min(1).max(5),
      stops: z.array(z.number()),
      positions: z.array(z.number()),
      label: z.string().max(60),
      currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
    })
    .strict();

  const ArrayWhiteboardBody = z
    .object({
      kind: z.literal('array'),
      rows: z.number().int(),
      columns: z.number().int(),
      unitValue: z.number(),
      total: z.number(),
      cells: z.number().int(),
      label: z.string().max(60),
      currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
    })
    .strict();

  const FractionStripWhiteboardBody = z
    .object({
      kind: z.literal('fraction_strip'),
      rows: z
        .array(z.object({ denominator: z.number().int(), highlighted: z.number().int() }).strict())
        .min(2)
        .max(4),
      shares: z.array(z.number()),
      label: z.string().max(60),
    })
    .strict();

  const PartitionWhiteboardBody = z
    .object({
      kind: z.literal('partition'),
      whole: z.number(),
      splits: z.array(z.object({ label: z.string().max(40), denominator: z.number().int() }).strict()).min(2).max(3),
      pieceValues: z.array(z.number()),
      label: z.string().max(60),
      currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
    })
    .strict();

  /* Decision and comparison (/TUTOR_INSTRUMENTS.md §3.2 families D and F). */
  const TableWhiteboardBody = z
    .object({
      kind: z.literal('table'),
      options: z
        .array(z.object({ label: z.string().max(40), price: z.number(), units: z.number() }).strict())
        .min(2)
        .max(4),
      unitPrices: z.array(z.number()),
      bestIndex: z.number().int(),
      label: z.string().max(60),
      currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
    })
    .strict();

  const ScaleWhiteboardBody = z
    .object({
      kind: z.literal('scale'),
      left: z.object({ label: z.string().max(60), value: z.number() }).strict(),
      right: z.object({ label: z.string().max(60), value: z.number() }).strict(),
      tilt: z.enum(['left', 'right', 'level']),
      difference: z.number(),
      label: z.string().max(60),
      currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
    })
    .strict();

  const TwoBinsWhiteboardBody = z
    .object({
      kind: z.literal('two_bins'),
      binLabels: z.tuple([z.string().max(40), z.string().max(40)]),
      items: z.array(z.object({ label: z.string().max(40), bin: z.number().int() }).strict()).min(2).max(8),
      counts: z.tuple([z.number().int(), z.number().int()]),
      label: z.string().max(60),
    })
    .strict();

  const VennWhiteboardBody = z
    .object({
      kind: z.literal('venn'),
      leftLabel: z.string().max(40),
      rightLabel: z.string().max(40),
      items: z
        .array(z.object({ label: z.string().max(40), side: z.enum(['left', 'right', 'both']) }).strict())
        .min(2)
        .max(8),
      left: z.number().int(),
      right: z.number().int(),
      both: z.number().int(),
      label: z.string().max(60),
    })
    .strict();

  const RankingWhiteboardBody = z
    .object({
      kind: z.literal('ranking'),
      items: z.array(z.object({ label: z.string().max(40), value: z.number() }).strict()).min(2).max(5),
      direction: z.enum(['asc', 'desc']),
      order: z.array(z.number().int()),
      label: z.string().max(60),
      currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
    })
    .strict();

  const OutcomesWhiteboardBody = z
    .object({
      kind: z.literal('outcomes'),
      good: z.object({ label: z.string().max(40), detail: z.string().max(110) }).strict(),
      bad: z.object({ label: z.string().max(40), detail: z.string().max(110) }).strict(),
      label: z.string().max(60),
    })
    .strict();

  const TradeWhiteboardBody = z
    .object({
      kind: z.literal('trade'),
      left: z.object({ who: z.string().max(30), gives: z.string().max(40), gets: z.string().max(40) }).strict(),
      right: z.object({ who: z.string().max(30), gives: z.string().max(40), gets: z.string().max(40) }).strict(),
      label: z.string().max(60),
    })
    .strict();

  const ChanceWhiteboardBody = z
    .object({
      kind: z.literal('chance'),
      outcomes: z.array(z.object({ label: z.string().max(40), weight: z.number().int() }).strict()).min(2).max(3),
      shares: z.array(z.number()),
      label: z.string().max(60),
    })
    .strict();

  /* Operations and real-money artefacts (/TUTOR_INSTRUMENTS.md §3.2 C and F). */
  const DealWhiteboardBody = z
    .object({ kind: z.literal('deal'), total: z.number().int(), bins: z.array(z.string().max(40)).min(2).max(6), perBin: z.number().int(), remainder: z.number().int(), label: z.string().max(60) })
    .strict();
  const ChangeWhiteboardBody = z
    .object({ kind: z.literal('change'), price: z.number(), paid: z.number(), change: z.number(), label: z.string().max(60), currency: z.enum(['MXN', 'USD', 'BRL']) })
    .strict();
  const RegroupWhiteboardBody = z
    .object({ kind: z.literal('regroup'), fromDenomination: z.number(), fromCount: z.number().int(), intoDenomination: z.number(), intoCount: z.number().int(), label: z.string().max(60), currency: z.enum(['MXN', 'USD', 'BRL']) })
    .strict();
  const EquationBarWhiteboardBody = z
    .object({ kind: z.literal('equation_bar'), left: z.array(z.object({ label: z.string().max(40), value: z.number() }).strict()).min(1).max(3), right: z.array(z.object({ label: z.string().max(40), value: z.number() }).strict()).min(1).max(3), total: z.number(), label: z.string().max(60), currency: z.enum(['MXN', 'USD', 'BRL']).nullable() })
    .strict();
  const ReceiptWhiteboardBody = z
    .object({ kind: z.literal('receipt'), lines: z.array(z.object({ label: z.string().max(40), value: z.number() }).strict()).min(1).max(6), total: z.number(), label: z.string().max(60), currency: z.enum(['MXN', 'USD', 'BRL']) })
    .strict();
  const LedgerWhiteboardBody = z
    .object({ kind: z.literal('ledger'), entries: z.array(z.object({ label: z.string().max(40), amount: z.number(), direction: z.enum(['in', 'out']) }).strict()).min(2).max(6), balances: z.array(z.number()), final: z.number(), label: z.string().max(60), currency: z.enum(['MXN', 'USD', 'BRL']) })
    .strict();
  const PriceTagWhiteboardBody = z
    .object({ kind: z.literal('price_tag'), item: z.string().max(40), price: z.number(), units: z.number(), discountPercent: z.number().int().nullable(), unitPrice: z.number(), finalPrice: z.number(), label: z.string().max(60), currency: z.enum(['MXN', 'USD', 'BRL']) })
    .strict();
  const InventoryWhiteboardBody = z
    .object({ kind: z.literal('inventory'), item: z.string().max(40), start: z.number().int(), sold: z.number().int(), left: z.number().int(), label: z.string().max(60) })
    .strict();
  const BudgetPlateWhiteboardBody = z
    .object({ kind: z.literal('budget_plate'), budget: z.number(), items: z.array(z.object({ label: z.string().max(40), value: z.number() }).strict()).min(2).max(5), spent: z.number(), remaining: z.number(), overBy: z.number(), label: z.string().max(60), currency: z.enum(['MXN', 'USD', 'BRL']) })
    .strict();

  /* Early years and time — the last of the Class I catalog. */
  const PictographWhiteboardBody = z
    .object({ kind: z.literal('pictograph'), rows: z.array(z.object({ label: z.string().max(40), count: z.number().int() }).strict()).min(2).max(4), unitValue: z.number(), totals: z.array(z.number()), label: z.string().max(60), currency: z.enum(['MXN', 'USD', 'BRL']).nullable() })
    .strict();
  const BeadStringWhiteboardBody = z
    .object({ kind: z.literal('bead_string'), count: z.number().int(), rows: z.array(z.number().int()), label: z.string().max(60) })
    .strict();
  const TallyWhiteboardBody = z
    .object({ kind: z.literal('tally'), groups: z.array(z.object({ label: z.string().max(40), count: z.number().int() }).strict()).min(2).max(5), fives: z.array(z.tuple([z.number().int(), z.number().int()])), label: z.string().max(60) })
    .strict();
  const FractionCircleWhiteboardBody = z
    .object({ kind: z.literal('fraction_circle'), denominator: z.number().int(), highlighted: z.number().int(), share: z.number(), label: z.string().max(60) })
    .strict();
  const StackWhiteboardBody = z
    .object({ kind: z.literal('stack'), columns: z.array(z.object({ label: z.string().max(40), parts: z.array(z.object({ label: z.string().max(40), value: z.number() }).strict()).min(2).max(3) }).strict()).min(2).max(3), totals: z.array(z.number()), max: z.number(), label: z.string().max(60), currency: z.enum(['MXN', 'USD', 'BRL']).nullable() })
    .strict();
  const SequenceCompareWhiteboardBody = z
    .object({ kind: z.literal('sequence_compare'), unit: z.enum(['day', 'week', 'month', 'year']), tracks: z.tuple([z.object({ label: z.string().max(40), start: z.number(), steps: z.array(z.object({ op: z.enum(['add', 'subtract', 'multiply_percent']), value: z.number() }).strict()) }).strict(), z.object({ label: z.string().max(40), start: z.number(), steps: z.array(z.object({ op: z.enum(['add', 'subtract', 'multiply_percent']), value: z.number() }).strict()) }).strict()]), values: z.array(z.array(z.number())), label: z.string().max(60), currency: z.enum(['MXN', 'USD', 'BRL']).nullable() })
    .strict();
  const TimelineWhiteboardBody = z
    .object({ kind: z.literal('timeline'), unit: z.enum(['day', 'week', 'month', 'year']), span: z.number().int(), events: z.array(z.object({ label: z.string().max(40), at: z.number().int() }).strict()).min(2).max(5), positions: z.array(z.number()), label: z.string().max(60) })
    .strict();
  const CycleWhiteboardBody = z
    .object({ kind: z.literal('cycle'), steps: z.array(z.string().max(40)).min(3).max(5), label: z.string().max(60) })
    .strict();
  const BeforeAfterWhiteboardBody = z
    .object({ kind: z.literal('before_after'), what: z.string().max(40), before: z.number(), after: z.number(), delta: z.number(), direction: z.enum(['up', 'down', 'same']), label: z.string().max(60), currency: z.enum(['MXN', 'USD', 'BRL']).nullable() })
    .strict();
  /** Class II, S9 (/TUTOR_INSTRUMENTS.md §3.3) — no computed field: nothing is server-derived, see `WhiteboardGrabSchema`'s own comment (oracle/src/tutor/turnSchema.ts). */
  const GrabWhiteboardBody = z
    .object({
      kind: z.literal('grab'),
      binLabels: z.array(z.string().max(40)).min(2).max(4),
      items: z.array(z.string().max(40)).min(2).max(8),
      label: z.string().max(60),
    })
    .strict();
  /** Class II, S9 — no computed field, see `WhiteboardFillSchema`'s own comment (oracle/src/tutor/turnSchema.ts). */
  const FillWhiteboardBody = z
    .object({
      kind: z.literal('fill'),
      container: z.enum(['ten_frame', 'bar', 'jar']),
      capacity: z.number().int().min(1).max(20),
      label: z.string().max(60),
    })
    .strict();
  /** Class II, S10 — NOT ungraded: `values` is server-computed, same as `sequence_compare`'s own two-track shape generalised to 2-3 branches. */
  const WhatifWhiteboardBody = z
    .object({
      kind: z.literal('whatif'),
      start: z.number(),
      unit: z.enum(['day', 'week', 'month', 'year']),
      branches: z
        .array(
          z
            .object({
              label: z.string().max(30),
              steps: z.array(z.object({ op: z.enum(['add', 'subtract', 'multiply_percent']), value: z.number() }).strict()),
            })
            .strict(),
        )
        .min(2)
        .max(3),
      values: z.array(z.array(z.number())),
      label: z.string().max(60),
      currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
    })
    .strict();
  /** Class II, S10 — NOT ungraded: ONE `sequence`, server-computed in a single pass, split at `givenCount` into the tutor's shown prefix and the learner's revealed suffix. */
  const YourTurnWhiteboardBody = z
    .object({
      kind: z.literal('your_turn'),
      start: z.number(),
      steps: z
        .array(z.object({ op: z.enum(['add', 'subtract', 'multiply_percent']), value: z.number() }).strict())
        .min(2)
        .max(7),
      givenCount: z.number().int().min(1).max(7),
      unit: z.enum(['day', 'week', 'month', 'year']),
      values: z.array(z.number()),
      label: z.string().max(60),
      currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
    })
    .strict();

  const WhiteboardBody = z.discriminatedUnion('kind', [
    SequenceWhiteboardBody,
    CompareWhiteboardBody,
    MarkedLineWhiteboardBody,
    CategoriesWhiteboardBody,
    TokensWhiteboardBody,
    BarModelWhiteboardBody,
    PartWholeWhiteboardBody,
    FlowWhiteboardBody,
    GoalBarWhiteboardBody,
    WorkedWhiteboardBody,
    TenFrameWhiteboardBody,
    OpenNumberLineWhiteboardBody,
    ArrayWhiteboardBody,
    FractionStripWhiteboardBody,
    PartitionWhiteboardBody,
    TableWhiteboardBody,
    ScaleWhiteboardBody,
    TwoBinsWhiteboardBody,
    VennWhiteboardBody,
    RankingWhiteboardBody,
    OutcomesWhiteboardBody,
    TradeWhiteboardBody,
    ChanceWhiteboardBody,
    DealWhiteboardBody,
    ChangeWhiteboardBody,
    RegroupWhiteboardBody,
    EquationBarWhiteboardBody,
    ReceiptWhiteboardBody,
    LedgerWhiteboardBody,
    PriceTagWhiteboardBody,
    InventoryWhiteboardBody,
    BudgetPlateWhiteboardBody,
    PictographWhiteboardBody,
    BeadStringWhiteboardBody,
    TallyWhiteboardBody,
    FractionCircleWhiteboardBody,
    StackWhiteboardBody,
    SequenceCompareWhiteboardBody,
    TimelineWhiteboardBody,
    CycleWhiteboardBody,
    BeforeAfterWhiteboardBody,
    GrabWhiteboardBody,
    FillWhiteboardBody,
    WhatifWhiteboardBody,
    YourTurnWhiteboardBody,
  ]);

  /**
   * v3's tray-demonstration steps, exactly as it was validated before ever
   * reaching a turn (`oracle/src/tutor/turnSchema.ts`'s `DemoStepSchema`) —
   * mirroring `WhiteboardBody` immediately above, edge-validated the same
   * way every request body is (§1.6). Found while investigating ORACLE.md
   * §19.5's "replaying `demonstrate` animations" backlog item, 2026-09-01:
   * no field for this existed at all, so a session where the tutor
   * demonstrated on the money tray lost that fact silently on replay and on
   * the guardian transcript viewer (migration 0067).
   */
  const DemonstrateBody = z
    .array(
      z
        .object({
          // Widened to 4 families 2026-09-02 (/TUTOR_INSTRUMENTS.md Sprint 2) —
          // see `DemoStepSchema`'s own comment (oracle/src/tutor/turnSchema.ts)
          // for what each new verb moves and why the vocabulary stayed flat.
          kind: z.enum(['add', 'remove', 'pause', 'place', 'assign', 'pair', 'move']),
          denomination: z.number().positive().max(10_000).optional(),
          ms: z.number().int().min(100).max(2_000).optional(),
          item: z.string().min(1).max(64).optional(),
          bucket: z.string().min(1).max(64).optional(),
          left: z.string().min(1).max(64).optional(),
          right: z.string().min(1).max(64).optional(),
          value: z.number().optional(),
        })
        .strict(),
    )
    .min(1)
    .max(8);

  /*
   * C.18 — the Mentor turn's honesty facts (answer-reveal and anti-
   * sycophancy instrumentation). HAND-MIRRORED from Oracle's `TurnHonesty`
   * (oracle/src/tutor/feedbackHonesty.ts) and the `tutor_turn_honesty`
   * CHECK lists; `npm run honesty:check` (root) keeps the three identical.
   * Strict inside, optional outside: an Oracle build that predates it sends
   * none and nothing changes.
   */
  const TurnHonestyBody = z
    .object({
      sequenceKind: z.enum(['hint_ladder', 'repair', 'open_activity', 'none']),
      hintLevel: z.enum(['reask', 'indirect', 'misconception', 'fill_blank', 'tell']).nullable(),
      revealSanctioned: z.boolean(),
      revealSelfAnswered: z.boolean(),
      revealPhrase: z.boolean(),
      openSegmentId: z.string().min(1).max(64).nullable(),
      verdictContext: z.enum(['after_incorrect', 'after_correct', 'after_unsound_claim']).nullable(),
      falseAffirmationCaught: z.boolean(),
      falseAffirmationDelivered: z.boolean(),
      praise: z.enum(['specific', 'generic']).nullable(),
    })
    .strict();

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
    whiteboard: WhiteboardBody.nullish(),
    demonstrate: DemonstrateBody.nullish(),
    /**
     * Class V (migration 0069, TUTOR_INSTRUMENTS.md §3.6): "persist the
     * board this turn just drew as the learner's ongoing plan." Only
     * meaningful alongside a non-null `whiteboard` — see the handler below.
     */
    savePlan: z.boolean().nullish(),
    /**
     * Class III / S17 (TUTOR_INSTRUMENTS.md §3.4, migration 0070): the
     * pre-authored roleplay scene id this turn started, when it started
     * one — the identical live-only-field gap `demonstrate` above closes,
     * closed the same way. A closed id, not free text; capped generously
     * rather than pinned to the current one-scene enum, so a wider frontend
     * catalog never needs a backend redeploy to be storable.
     */
    roleplayScene: z.string().min(1).max(64).nullish(),
    /** Class III `point_at` (2026-09-04): the array index `action: "point"` reached for, if any. */
    pointAt: z.number().int().min(0).nullish(),
    /** C.18: see `TurnHonestyBody`. Only meaningful on a tutor turn. */
    honesty: TurnHonestyBody.nullish(),
  });

  router.post('/turns', async (req, res) => {
    const parsed = TurnBody.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, VALIDATION, parsed.error.issues[0]?.message ?? 'Invalid turn');
    const recorded = await insertTutorTurn(parsed.data);

    /*
     * C.18: the Mentor-integrity row (tutor_turn_honesty), with Core's own
     * key-based reveal check. Best-effort and independent of the turn write,
     * like the plan save below: a lost honesty row costs the dashboard one
     * data point, never the learner a reported failure.
     */
    if (recorded && parsed.data.speaker === 'tutor' && parsed.data.honesty) {
      const honestyRecorded = await recordTurnHonesty({
        sessionId: parsed.data.sessionId,
        turnSeq: parsed.data.seq,
        text: parsed.data.text,
        honesty: parsed.data.honesty,
      }).catch(() => false);
      if (!honestyRecorded) {
        console.warn(`[tutor] honesty row did not land for session ${parsed.data.sessionId} turn ${parsed.data.seq}`);
      }
    }

    /*
     * Class V (migration 0069, TUTOR_INSTRUMENTS.md §3.6): a turn that drew
     * a board and marked it as the plan persists it — a plain overwrite,
     * never a merge (write_tutor_plan's own comment explains why that is
     * safe here and would not be for learner_memory). Best-effort and
     * independent of the turn write above: a plan save failing must not
     * turn a turn the learner already saw into a reported failure.
     */
    if (parsed.data.savePlan && parsed.data.whiteboard) {
      const session = await getTutorSession(parsed.data.sessionId);
      if (session) {
        const saved = await writeTutorPlan({
          userId: session.user_id,
          content: parsed.data.whiteboard,
          sessionId: parsed.data.sessionId,
        });
        if (!saved) {
          console.warn(`[tutor] plan save did not land for session ${parsed.data.sessionId}`);
        }
      }
    }

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
   * locations. Enforced upstream, in Oracle, BEFORE this call is ever made —
   * the writer's prompt forbids them, a regex re-check catches digit/URL-
   * shaped identifiers, and (round 42, 2026-08-30) a content-moderation
   * judge catches what the regex cannot (a surname or a school name has
   * neither shape). This endpoint's own job is only the length caps and the
   * atomic write (`writeLearnerMemoryPair`, `tutorData.ts`) — it does not, and
   * should not, re-run content checks Oracle already ran.
   */
  /*
   * `expectedBefore` — round 51 (2026-08-30, MEDIUM): without this, this
   * route's own `writeLearnerMemory` call had no way to compare against
   * anything but a value it had just re-read itself, which can never lose a
   * race against a genuinely concurrent session (see that function's own
   * comment). Oracle now sends the belief its proposal was actually
   * computed from — `learnerBrief`, read at session start — so a session
   * that overlapped another one's write correctly reports 'conflict'
   * instead of silently discarding it.
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
        expectedBefore: z
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
    const { userId, sessionId, stores, expectedBefore } = parsed.data;

    // C.4 / OD-18 (24 September 2026): the reviewer of a memory note is
    // resolved from server-held evidence, not from the request. A verified
    // guardian link or a legacy `kid` role keeps the guardian-review flow. An
    // independent screened teen (13_to_17, no link, no protected origin)
    // parks the note as a SELF-review item the teen decides on through their
    // own learner session — never silently auto-approved. An account with
    // unknown or under-13 age evidence and no guardian link is a conservative
    // hold: the whole write is refused, both stores. A screened adult keeps
    // the existing direct write.
    //
    // GAP-FIX-R2 (C.4, OD-18): BOTH stores go through that review. The
    // pedagogy note ("what teaching works with this child") is the second of
    // C.4's two memory notes and model-written prose about the same child; it
    // used to write straight through for every minor with nobody seeing it.
    const review = await classifyMemoryReview(userId);
    if (review === null) {
      return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not resolve memory review eligibility');
    }
    if (review === 'hold') {
      return fail(res, 403, MEMORY_REVIEW_INELIGIBLE, 'No memory-note reviewer is eligible for this account');
    }
    const requiresReview = review !== 'adult-direct';

    const gatedStores = requiresReview ? { learner: null, pedagogy: null } : stores;
    const pending: ('learner' | 'pedagogy')[] = requiresReview
      ? (['learner', 'pedagogy'] as const).filter((store) => stores[store] !== null)
      : [];
    if (pending.length > 0) {
      const parked = await parkLearnerMemoryProposal({
        userId,
        sessionId,
        proposals: pending.map((store) => ({
          store,
          proposed: stores[store] as string,
          expectedBefore: expectedBefore[store],
        })),
      });
      // Refused, not degraded. A proposal that failed to park is a note that
      // vanished; reporting it as landed would mean nothing ever retries it.
      if (!parked) {
        return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not record the memory note for review');
      }
    }

    /*
     * ONE call, not one per store — round 61 (2026-08-30, MEDIUM), closed as
     * round 75. This used to loop and await `writeLearnerMemory` once per
     * store, which is two transactions with a real window between them, and a
     * session starting in that window read one brand-new note beside one
     * stale one. A `null` store still means "this review proposed nothing
     * here" and is still absent from `written`; that skip now happens inside
     * the RPC (a NULL proposal, never a NULL write) instead of here. See
     * `writeLearnerMemoryPair` and migration 0061.
     */
    const written = await writeLearnerMemoryPair({
      userId,
      stores: gatedStores,
      expectedBefore,
      actor: 'oracle-post-session-review',
      sessionId,
    });
    /*
     * `pending` is a THIRD answer, not a dressed-up version of either other
     * one. A parked store is absent from `written` — it was not written — but
     * it did not FAIL either, and Oracle's `updateLearnerMemory` requires
     * every proposed store to report success or it logs "the write did not
     * land". Without this field a gated write would be indistinguishable from
     * a broken one, forever, on every kid session (§1.14).
     */
    return ok(res, { written, pending });
  });

  /*
   * V4 episodic recall: literal excerpts from this learner's own history,
   * for the "¿te acuerdas de…?" moments. GIN-indexed, ~20 ms, no model.
   */
  router.get('/recall', async (req, res) => {
    const Q = z
      .object({
        userId: z.uuid(),
        q: z.string().min(2).max(200),
        // Optional: an Oracle deployed ahead of this route degrades to the
        // `searchOwnTurns` default (es-MX) rather than a refused request —
        // round 29, 2026-08-30, see database/migrations/0056.
        locale: z.enum(['en-US', 'es-MX', 'pt-BR']).optional(),
      })
      .strict();
    const parsed = Q.safeParse({ userId: req.query.userId, q: req.query.q, locale: req.query.locale });
    if (!parsed.success) {
      return fail(res, 400, VALIDATION, parsed.error.issues[0]?.message ?? 'Invalid request');
    }
    const excerpts = await searchOwnTurns(parsed.data.userId, parsed.data.q, 3, parsed.data.locale);
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

  /*
   * V4 HARNESS BACKLOG: TRAJECTORY EMISSION (/ORACLE.md §20, ROADMAP.md
   * "Remaining harness phases", migration 0065). A durable, queryable record
   * of what the deterministic pedagogical controller
   * (`oracle/src/tutor/controller.ts`) actually decided across a real
   * session — which strategy fired, on what mastery estimate, over which
   * skill — for OFFLINE study of the Tutor's own pedagogy. Backstage only:
   * nothing here reaches a model, a screen, or a parent view, and this
   * endpoint changes nothing about what a live session does.
   *
   * Same closed-vocabulary posture as `/flags` and `/turns`: every field is a
   * bounded enum, number or identifier (§13 of /ORACLE.md — never a
   * free-text or arbitrary-JSON channel). Oracle sends the WHOLE session's
   * steps in one call, fire-and-forget after the session ends
   * (`oracle/src/session/trajectory.ts`), so this route is never on a live
   * turn's critical path.
   */
  const STRATEGY_VALUES = [
    'DIRECT',
    'WORKED',
    'FADED',
    'SOCRATIC',
    'FLUENCY',
    'SPACED',
    'PROBE',
    'REMEDIATE',
    'RESCUE',
    'ELABORATE',
    'TRANSFER',
    'CELEBRATE',
  ] as const;

  const TrajectoryStepBody = z
    .object({
      turnSeq: z.number().int().min(1),
      /*
       * `stated_misconception` was always in Oracle's own vocabulary
       * (`oracle/src/session/trajectory.ts` records it for every learner
       * turn that states a wrong idea) and never in this one, so every
       * session containing one had its WHOLE batch refused with a 400 — the
       * steps most relevant to C.10's remediation evidence were exactly the
       * ones that never landed. Accepted now; the DB CHECK is widened by the
       * matching contract migration (`*_trajectory_stated_misconception_kind.sql`).
       */
      eventKind: z.enum(['activity_result', 'voice_result', 'conversation_turn', 'stated_misconception', 'entry_opened']),
      // Never null in practice — the controller always seeds a real strategy
      // before `decide()` can be called at all — but the wire shape is not
      // where that invariant should be enforced twice; Zod validates the
      // vocabulary, the DB's NOT NULL is the actual guarantee.
      strategyBefore: z.enum(STRATEGY_VALUES),
      strategy: z.enum(STRATEGY_VALUES),
      skillName: z.string().min(1).max(64).nullable(),
      scaffolding: z.number().int().min(0).max(3),
      difficulty: z.number().int().min(1).max(5),
      pKnown: z.number().min(0).max(1).nullable(),
      misconceptionCode: z.string().min(1).max(64).nullable(),
      kcId: z.uuid().nullable(),
      kcMode: z.enum(['new', 'review', 'probe', 'remediation']).nullable(),
      /*
       * C.10 — the evidence behind a consequential decision (Extended
       * Mastery Engine event log). Optional so a batch from an Oracle build
       * that predates them still lands; when present they are validated as
       * a unit (all three set, or all three null) by the refine below.
       */
      evidenceRule: z.enum(['mastery', 'remediation', 'rescue']).nullable().optional(),
      evidenceObservations: z.number().int().min(0).max(100).nullable().optional(),
      evidenceRequired: z.number().int().min(1).max(5).nullable().optional(),
      // GAP-FIX-R2 (Appendix D §2.6): which correct answers the chain set aside; travels with the evidence.
      evidenceDiscounted: z.enum(['none', 'too_fast', 'hint_assisted', 'too_fast_and_hint_assisted']).nullable().optional(),
      masteryRevoked: z.boolean().optional(),
    })
    .strict()
    .refine((step) => (step.evidenceDiscounted ?? null) === null || (step.evidenceRule ?? null) !== null, {
      message: 'evidenceDiscounted travels with evidenceRule',
    })
    .refine(
      (step) =>
        (step.evidenceRule ?? null) === null
          ? (step.evidenceObservations ?? null) === null && (step.evidenceRequired ?? null) === null
          : step.evidenceObservations != null && step.evidenceRequired != null,
      { message: 'evidenceRule, evidenceObservations and evidenceRequired travel together' },
    );

  // Capped generously above anything a real 25-minute session budget could
  // ever produce (idle-nudge/listen-silence floors alone put real sessions
  // in the low dozens of turns) — high enough to never clip a real batch,
  // low enough that a malformed caller cannot force an unbounded insert.
  const TrajectoryBody = z
    .object({
      userId: z.uuid(),
      sessionId: z.uuid(),
      steps: z.array(TrajectoryStepBody).min(1).max(200),
    })
    .strict();

  router.post('/trajectory', async (req, res) => {
    const parsed = TrajectoryBody.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, VALIDATION, parsed.error.issues[0]?.message ?? 'Invalid trajectory batch');
    }
    const { userId, sessionId, steps } = parsed.data;
    const recorded = await insertTutorTrajectory(userId, sessionId, steps);
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
    /*
     * C.16 / C.8 / C.12 (Appendix F §1.1–1.2). OPTIONAL so an Oracle deployed
     * before this Core still closes; each is validated against its closed
     * vocabulary (hand-mirrored — `npm run session-end:check`), and a bad
     * value refuses the close like any other malformed field.
     */
    closingScript: z.enum(CLOSING_SCRIPTS).optional(),
    opening: z.enum(SESSION_OPENINGS).optional(),
    endSignal: SessionEndReportBody.optional(),
    /*
     * C.9/C.19 (Appendix F §1.2): the Behavioral Telemetry Layer's counts and
     * firings. OPTIONAL (an older Oracle, or the layer switched off); strict
     * inside, so an emotion label or an unknown outcome refuses the close.
     */
    behavioralTelemetry: BehavioralTelemetryReportBody.optional(),
    /*
     * C.15 / C.14 / C.7 (Appendix F §1.2): the Alliance Controller's record,
     * the self-explanation events and this session's disposition
     * observations. OPTIONAL (an older Oracle, or a component switched off);
     * strict inside, so an emotion label or the learner's words refuse the
     * close.
     */
    alliance: AllianceReportBody.optional(),
    selfExplanation: SelfExplanationReportBody.optional(),
    disposition: DispositionObservationBody.optional(),
    /*
     * C.11 / C.17 (Appendix F §1.1–1.2): the spaced-review routing decisions
     * with the inputs the rule read, and the dialogue register the session
     * ran with its counts. OPTIONAL (an older Oracle, or C.11 switched off);
     * strict inside, so learner text, an unknown label, a routing that does
     * not fit its tier or a register that does not fit its variant refuses
     * the close.
     */
    spacedReview: SpacedReviewReportBody.optional(),
    dialogueCalibration: DialogueCalibrationReportBody.optional(),
  });

  router.post('/sessions/:id/close', async (req, res) => {
    const parsed = CloseBody.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, VALIDATION, parsed.error.issues[0]?.message ?? 'Invalid close');
    // `ended_at IS NULL` in the update means the FIRST close wins. A socket
    // that dies after a graceful farewell must not rewrite `completed` into
    // `learner_left` — and, since round 98, the caller is told WHICH of
    // those happened rather than only whether the HTTP call itself
    // succeeded (`closeTutorSession`'s own comment).
    const outcome = await closeTutorSession(parsed.data);
    const closed = outcome !== 'failed';

    /*
     * THE MEMORY DIGEST, written when a close actually landed (/ORACLE.md
     * §4.1, 2026-08-28). Computed HERE, deterministically, from rows Core
     * already holds — never by a model and never from transcript text,
     * because this object is what the NEXT session's model context carries.
     * Best-effort after the close: a failed digest costs continuity, not the
     * session record.
     */
    /*
     * C.8/C.12: the signal's firings, written only by the close that actually
     * landed (first close wins, like the row itself). Best-effort: a failed
     * write costs Trigger Rate data points, never the close.
     */
    if (outcome === 'closed' && parsed.data.endSignal && parsed.data.endSignal.events.length > 0) {
      const owner = await getTutorSession(parsed.data.sessionId);
      if (owner) {
        const written = await recordSessionEndSignal({
          sessionId: owner.id,
          character: owner.character,
          events: parsed.data.endSignal.events,
        });
        if (!written) console.warn(`[tutor] session-end signal NOT recorded for session ${owner.id}`);
      }
    }

    /*
     * C.9/C.19: the telemetry firings, written only by the close that
     * actually landed. Best-effort: a failed write costs Repair Initiation
     * data points, never the close.
     */
    const telemetry = parsed.data.behavioralTelemetry;
    if (outcome === 'closed' && telemetry && telemetry.events.length > 0) {
      const owner = await getTutorSession(parsed.data.sessionId);
      if (owner) {
        const written = await recordTelemetryFirings({
          sessionId: owner.id,
          character: owner.character,
          events: telemetry.events,
        });
        if (!written) console.warn(`[tutor] behavioral-telemetry firings NOT recorded for session ${owner.id}`);
      }
    }

    /*
     * C.15 / C.14 / C.7: the alliance record, the self-explanation ledger and
     * the disposition profile, written only by the close that actually
     * landed. Best-effort: a failed write costs metric data points or one
     * session's contribution to the profile, never the close.
     */
    if (outcome === 'closed') {
      const owner = await getTutorSession(parsed.data.sessionId);
      if (owner) {
        if (parsed.data.alliance || parsed.data.selfExplanation) {
          const written = await recordAllianceClose({
            sessionId: owner.id,
            character: owner.character,
            alliance: parsed.data.alliance,
            selfExplanation: parsed.data.selfExplanation,
          });
          if (!written) console.warn(`[tutor] alliance / self-explanation record NOT fully written for session ${owner.id}`);
        }
        const telemetryEvents = parsed.data.behavioralTelemetry?.events;
        const answered = (telemetryEvents ?? []).filter((e) => e.outcome === 'aligned' || e.outcome === 'misaligned');
        const seEvents = (parsed.data.selfExplanation?.events ?? []).filter(
          (e) => e.mode === 'act' && e.firstQuality !== null && e.firstQuality !== 'unanswered' && e.firstQuality !== 'help',
        );
        const folded = await recordDispositionClose(owner.user_id, parsed.data.disposition ?? null, {
          character: owner.character as 'dina' | 'liruf' | 'rho' | 'zara',
          closeReason: parsed.data.closeReason,
          endedAt: new Date().toISOString(),
          disengagementFired: telemetryEvents === undefined ? null : telemetryEvents.length > 0,
          checkInMisaligned: answered.length === 0 ? null : answered.some((e) => e.outcome === 'misaligned'),
          selfExplanationPrompts: seEvents.length,
          selfExplanationFirstPass: seEvents.filter((e) => e.firstQuality === 'concept').length,
        });
        if (!folded) console.warn(`[tutor] disposition profile NOT updated for session ${owner.id}`);
        /*
         * C.11: the routing log, and the hand-off of every knowledge component
         * the session did not retire to the cross-session scheduler. C.17: the
         * register row. Best-effort: a failed write costs audit rows or one
         * early review, never the close.
         */
        if (parsed.data.spacedReview) {
          const routed = await recordSpacedReviewClose({
            sessionId: owner.id,
            userId: owner.user_id,
            character: owner.character,
            report: parsed.data.spacedReview,
            closedAt: new Date(),
          });
          if (!routed.recorded) console.warn(`[tutor] spaced-review routing NOT fully recorded for session ${owner.id}`);
        }
        if (parsed.data.dialogueCalibration) {
          const written = await recordDialogueCalibrationClose({
            sessionId: owner.id,
            character: owner.character,
            report: parsed.data.dialogueCalibration,
          });
          if (!written) console.warn(`[tutor] dialogue calibration NOT recorded for session ${owner.id}`);
        }
      }
    }

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
    // `alreadyClosed` is new (round 98): `closed` alone cannot tell Oracle's
    // `finish()` apart from a real update, which is exactly the signal it
    // needs to stop reporting a lost race as a success.
    return ok(res, { closed, alreadyClosed: outcome === 'already-closed' });
  });

  /*
   * A PAID CALL THAT LANDS AFTER THE CLOSE STILL BELONGS TO THE SESSION.
   *
   * Round 78 (2026-08-30). The post-session review makes its own real call to
   * the pedagogical model, and Oracle fires it fire-and-forget AFTER
   * `closeSession` has already persisted `cost_usd` — in the graceful
   * `finish()` path and in the dropped-connection `finalizeParked()` path
   * alike. So the one number §15 promises measures the session's spend
   * ("before it is a surprise") was, for every session with a real
   * conversation in it, missing that call. This route is how the cost gets
   * home: an ADDITION, done in Postgres (migration `0062`), never a
   * read-add-write here.
   *
   * `reason` is a closed vocabulary rather than free text so a second
   * background contributor has to be added deliberately — and so this log
   * line says which surface spent the money.
   */
  const SessionCostBody = z
    .object({
      costUsd: z.number().positive().finite(),
      reason: z.enum(['post_session_review']),
    })
    .strict();

  router.post('/sessions/:id/cost', async (req, res) => {
    const sessionId = z.string().uuid().safeParse(req.params.id);
    if (!sessionId.success) return fail(res, 400, VALIDATION, 'Invalid session id');
    const parsed = SessionCostBody.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, VALIDATION, parsed.error.issues[0]?.message ?? 'Invalid cost');

    const total = await addTutorSessionCost(sessionId.data, parsed.data.costUsd);
    if (total === null) {
      // LOUD, and never a 500: the caller is a best-effort background task
      // that must not retry, so this line is the only trace an uncounted
      // cost leaves (§1.0, "in blind flight").
      console.warn(
        `[tutor] session cost NOT recorded (${parsed.data.reason}, $${parsed.data.costUsd.toFixed(6)}) ` +
          `for session ${sessionId.data} — no such session, or the write failed`,
      );
      return ok(res, { recorded: false, costUsd: null });
    }
    return ok(res, { recorded: true, costUsd: total });
  });

  router.get('/consent/:userId', async (req, res) => {
    const userId = z.string().uuid().safeParse(req.params.userId);
    if (!userId.success) return fail(res, 400, VALIDATION, 'Invalid user id');
    const roles = await getRolesForGate(userId.data);
    if (roles === null) return ok(res, { active: false });
    const { originRestricted } = await resolveMentorSafety(userId.data, roles);
    const consent = originRestricted ? null : await getActiveVoiceConsent(userId.data);
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

  /*
   * THE SWEEP'S OWN WATCHER, on the INTERNAL surface (2026-09-01).
   *
   * `/ORACLE.md` §15.2 item 4 closed the data half of this — every purge that
   * reaches the database writes `tutor.retention.swept` to `audit_logs`,
   * including a batch that deleted nothing, and
   * `GET /admin/tutor/retention-status` reads it back for a human. What it
   * explicitly left owner-side was "something that actually polls this route
   * on a schedule and alerts". This is the endpoint that makes the poller
   * possible.
   *
   * WHY A SECOND ROUTE RATHER THAN POLLING THE ADMIN ONE. The admin route
   * needs a staff SESSION, which a scheduled runner does not have and should
   * not be given — minting one would mean a long-lived staff credential in a
   * CI secret, which is precisely the credential-copying that
   * `tutor-retention.yml`'s own header rejects for the purge. The internal
   * surface is already reachable the way that workflow reaches it: stand
   * inside the container over `railway ssh`, call 127.0.0.1 with the
   * `INTERNAL_API_KEY` that is ALREADY in that process's environment, and
   * copy no credential anywhere.
   *
   * BOTH ROUTES CALL THE SAME `getTutorRetentionStatus()`, deliberately. The
   * staleness threshold (`RETENTION_STALE_HOURS`) must exist in exactly one
   * place: a watcher that re-implemented "36 hours" in bash would be a second
   * hand-tuned constant that drifts from the first the day either moves, which
   * is the failure AGENTS.md §1.14 records for independently-tuned values. The
   * only thing this route adds is who is allowed to ask.
   *
   * A failed READ stays a 502, never a reassuring 200 — same as the admin
   * route, and for the same §1.14 reason: "the database is unreachable" and
   * "the sweep has never run" are different facts and the watcher must be able
   * to tell them apart.
   */
  router.get('/retention/status', async (_req, res) => {
    const status = await getTutorRetentionStatus();
    if (!status) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not load the retention sweep status');
    return ok(res, status);
  });

  /*
   * C.21 / C.24: ONE PASS OF THE EVALUATION LOOP (Appendix E §3.1 Tier 3).
   * Scores every ended, unscored session against the transcript rubric,
   * recomputes every consolidated signal, opens or refreshes flags for the
   * named owners, and stores the snapshot the staff dashboard reads.
   * Called hourly by .github/workflows/mentor-evaluation-loop.yml from inside
   * the container (the key never leaves it). No model call: zero spend.
   * A pass that could not read everything answers 200 with status 'partial'
   * (and says what it could not do); one that could not record itself is a 502.
   */
  const EvaluationBody = z.object({ limit: z.number().int().min(1).max(5000).default(500) }).strict();
  router.post('/evaluation/run', async (req, res) => {
    const parsed = EvaluationBody.safeParse(req.body ?? {});
    if (!parsed.success) return fail(res, 400, VALIDATION, parsed.error.issues[0]?.message ?? 'Invalid body');
    const result = await runEvaluationPass({ trigger: 'schedule', limit: parsed.data.limit });
    if (result.status === 'failed') return fail(res, 502, 'DATA_UNAVAILABLE', 'The evaluation pass could not record its run');
    return ok(res, {
      status: result.status,
      runId: result.runId,
      scored: result.scoring.scored,
      failed: result.scoring.failed,
      backlogBefore: result.scoring.backlogBefore,
      signals: result.signals,
      flags: result.flags,
    });
  });

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
    /*
     * C.7 (S06.15 lane review): the learner disposition profile's retention
     * (a profile not updated for 365 days is deleted) rides this nightly
     * sweep, so the promise has a scheduled job and not only an operator
     * command. It is reported, never swallowed: `null` means the delete could
     * not run (the workflow warns), which is different from "nothing due".
     * It does not fail the session sweep, which has already committed.
     */
    const dispositionProfilesPurged = await purgeStaleDispositionProfiles();
    if (dispositionProfilesPurged === null) {
      console.error('[tutor-retention] disposition-profile retention FAILED — stale profiles were not deleted this run');
    }
    /*
     * ORACLE.md §15.2 item 4 (closed 2026-08-31): the sweep's own monitoring.
     * Written on every reply that reaches here — INCLUDING a batch that
     * deletes zero sessions — because "ran and found nothing due" and "never
     * ran" must stay distinguishable (§1.14); only the absence of this row
     * for too long (`getTutorRetentionStatus`, services/tutorData.ts) means
     * the workflow itself has stopped firing. `actorId: null` because this is
     * a scheduled job, not a staff click — see `insertAuditLog`'s own comment.
     */
    const audited = await insertAuditLog(null, RETENTION_SWEEP_AUDIT_ACTION, 'tutor_sessions', {
      sessionsDeleted: result.sessionsDeleted,
      audioDeleted: result.audioDeleted,
      audioFailed: result.audioFailed,
      audioRetained: result.audioRetained,
      dispositionProfilesPurged,
    });
    if (!audited) {
      // The purge already committed, so this must not become a caller-facing
      // failure — but a sweep with no audit row is invisible to the very
      // staleness check this exists to feed. audit_logs is the only record.
      console.error('[tutor-retention] audit write FAILED — the sweep ran but will not show as having run');
    }
    return ok(res, { ...result, dispositionProfilesPurged });
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
     *
     * MIRRORS `oracle/src/tutor/turnSchema.ts`'s `PREFERRED_SEGMENT_TYPES` —
     * widened together 2026-09-02 (/TUTOR_INSTRUMENTS.md Sprint 1) from
     * `interest_peek`/`number_line` alone to the Lesson Engine's own `money`
     * family (9 types) plus `number_line`. Kept in agreement by
     * `agent/tools/check-preferred-types-parity.mjs`, not by convention alone
     * — the exact class of drift `check-instrument-parity.mjs` exists to catch
     * one layer up, applied here because oracle and backend share no types.
     */
    preferredTypes: z
      .array(
        z.enum([
          'coin_count',
          'make_change',
          'piggy_split',
          'needs_wants',
          'price_compare',
          'budget_fit',
          'savings_goal',
          'fair_trade',
          'interest_peek',
          'number_line',
        ]),
      )
      .max(3)
      .nullish(),
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

    /*
     * RETRY-ON-CLAIM-CONFLICT (RUNBOOK.md Round 109). The ladder below
     * reads a SNAPSHOT of "already served" that cannot cheaply be made
     * atomic with it — three tiers of PostgREST round trips cannot run
     * inside the Postgres function that claims the seq. So the atomicity
     * lives entirely in the FINAL claim (`insertTutorSegmentChecked`,
     * migration 0064): a concurrent winner is detected THERE, fresh, and
     * reported back as 'conflict' rather than as a hard failure. This loop
     * is what turns that signal into "reselect against the now-current
     * exclusion set" instead of a manufactured 502 — bounded, so a ladder
     * that keeps losing to a torrent of identical concurrent requests
     * eventually says so honestly rather than retrying forever.
     */
    const MAX_CLAIM_ATTEMPTS = 4;
    for (let attempt = 0; attempt < MAX_CLAIM_ATTEMPTS; attempt++) {
      const served = await listTutorSegments(session.id);
      if (served === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not read served segments');
      const alreadyServed = served.map((s) => String((s.payload as { id?: unknown }).id ?? ''));

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
      let namedSkill = parsed.data.skillKey === 'unknown' ? null : parsed.data.skillKey;
      /*
       * WHEN kcId IS PRESENT, THE CATALOG'S OWN skill_key WINS OVER WHATEVER
       * skillKey THE CALLER SEPARATELY ASSERTED.
       *
       * Found by adversarial review, round 58 (2026-08-30, HIGH): Oracle's
       * PROBE strategy (`controller.ts`'s `probeEntry()`) synthesizes a
       * request naming the PREREQUISITE's real `kcId` alongside the
       * INTERRUPTED (original) entry's own `skillKey` — the controller has no
       * way to look up the prerequisite's own skill_key, since it only knows
       * about KCs that are full entries in the session's own plan, not every
       * node in the graph. Because the wrong-but-real skillKey almost always
       * resolves immediately (it names the exact topic the learner was
       * already being taught, which is WHY it has content in the first
       * place), tier 1 served content about KC A while `stampPedagogy` (below)
       * stamped the evidence against KC B — corrupting KC B's BKT posterior,
       * misconception diagnosis and FSRS memory card with evidence that was
       * actually about a different skill, silently, on the ordinary PROBE
       * path that fires whenever a confident learner unexpectedly fails a
       * question with prerequisites. `kcId`, when present, always originates
       * from Core's own KC graph (via the v3 session plan Core itself
       * computed) — strictly more authoritative than a client-asserted
       * string — so resolving THIS KC's own catalog skill_key and using it
       * for content selection guarantees whatever gets served is always about
       * the exact KC the evidence will be attributed to. A no-op in the
       * ordinary case, where the two already agree.
       */
      let kcCatalog: KcRow[] | null = null;
      if (parsed.data.kcId) {
        kcCatalog = await getActiveKcs();
        const kc = kcCatalog?.find((k) => k.id === parsed.data.kcId);
        if (kc?.skill_key) namedSkill = kc.skill_key;
      }
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
      let route: LadderRoute = candidate ? 'named_skill' : 'none';

      /*
       * C.6: THE CURATED PACK FOR THIS EXACT KNOWLEDGE COMPONENT.
       *
       * A KC that no published topic teaches (`kc.skill_key` null) had no
       * human-approved content at all, so every activity about it was live
       * generation: the highest-predictability live demand there is. A
       * curated pack may target the KC itself (`kc:<kc key>`), and it is
       * tried before the prerequisite and frontier rungs because it is about
       * the exact KC the evidence will be filed under.
       */
      const activeKc = parsed.data.kcId ? kcCatalog?.find((k) => k.id === parsed.data.kcId) : undefined;
      if (!candidate && activeKc?.key) {
        candidate = await serveFromBank({
          skillKey: `kc:${activeKc.key}`,
          tier: session.tier,
          locale: session.locale,
          preferredTypes: parsed.data.preferredTypes,
          difficulty: parsed.data.difficulty,
          excludeSegmentIds: alreadyServed,
        });
        if (candidate) route = 'kc_pack';
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
        // `kcCatalog` was already fetched above when kcId is present — reused
        // here rather than fetched twice, with one retry if that first read
        // itself failed (a transient hiccup should not cost this whole rung).
        const [edges, kcs] = await Promise.all([getKcEdges(), kcCatalog ?? getActiveKcs()]);
        if (edges && kcs) {
          const byId = new Map(kcs.map((k) => [k.id, k]));
          const prerequisites = edges
            .filter((e) => e.dependent_kc_id === parsed.data.kcId)
            .map((e) => byId.get(e.prerequisite_kc_id))
            .filter((k): k is KcRow => k !== undefined);

          for (const prerequisite of prerequisites) {
            const key = typeof prerequisite.skill_key === 'string' && prerequisite.skill_key !== '' ? prerequisite.skill_key : null;
            // C.6: a prerequisite with no published topic may still have a
            // curated pack of its own.
            if (key === null) {
              if (prerequisite.key) {
                candidate = await serveFromBank({
                  skillKey: `kc:${prerequisite.key}`,
                  tier: session.tier,
                  locale: session.locale,
                  preferredTypes: parsed.data.preferredTypes,
                  difficulty: parsed.data.difficulty,
                  excludeSegmentIds: alreadyServed,
                });
              }
              if (candidate) {
                route = 'prerequisite';
                console.warn(`[tutor] no content for the active KC; served its prerequisite pack kc:${prerequisite.key} instead`);
                break;
              }
              continue;
            }
            const fallbackSkill = await resolveSkill(key);
            if (fallbackSkill) {
              candidate = await serveFromCatalog({
                skill: fallbackSkill,
                locale: session.locale,
                difficulty: parsed.data.difficulty,
                excludeSegmentIds: alreadyServed,
                rotationSeed: hashSeed(session.id),
                preferredTypes: parsed.data.preferredTypes,
              });
            }
            /*
             * TIER 2 FOR THE PREREQUISITE TOO. Found by adversarial review,
             * round 58 (2026-08-30, MEDIUM): this fallback only ever tried
             * `serveFromCatalog`, unlike the named-skill path above, which
             * tries the human-published bank when the catalog misses. A
             * prerequisite whose only real content lives in the bank was
             * unreachable from here — the ladder silently narrowed to
             * "catalog or generate" the moment it needed this rung, with no
             * signal that the bank was never even asked.
             */
            if (!candidate) {
              candidate = await serveFromBank({
                skillKey: key,
                tier: session.tier,
                locale: session.locale,
                preferredTypes: parsed.data.preferredTypes,
                difficulty: parsed.data.difficulty,
                excludeSegmentIds: alreadyServed,
              });
            }
            if (!candidate && prerequisite.key) {
              candidate = await serveFromBank({
                skillKey: `kc:${prerequisite.key}`,
                tier: session.tier,
                locale: session.locale,
                preferredTypes: parsed.data.preferredTypes,
                difficulty: parsed.data.difficulty,
                excludeSegmentIds: alreadyServed,
              });
            }
            if (candidate) {
              route = 'prerequisite';
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
          }
          // Tier 2 for the frontier fallback too (round 58, 2026-08-30,
          // MEDIUM) — see the identical comment on the prerequisite rung
          // above; this rung had the same catalog-only gap.
          if (!candidate) {
            candidate = await serveFromBank({
              skillKey: frontierKey,
              tier: session.tier,
              locale: session.locale,
              preferredTypes: parsed.data.preferredTypes,
              difficulty: parsed.data.difficulty,
              excludeSegmentIds: alreadyServed,
            });
          }
          if (candidate) {
            route = 'frontier';
            console.warn(
              `[tutor] "${parsed.data.skillKey}" found nothing; served the learner's own next step ${frontierKey}`,
            );
          }
        }
      }

      const eventKey = activeKc?.key ? `kc:${activeKc.key}` : namedSkill;
      if (!candidate) {
        /*
         * C.5 / Appendix E §3.1.1(b): the human-approved tiers missed. Live
         * generation is open only while its content-risk category is not
         * suspended (an uncalibrated or stale judge, a concordance or review
         * floor breached). The request's category is read from what the
         * Mentor asked for and the session's safety history; the item's own
         * category is decided again, and finally, at verification.
         */
        const flags = await sessionSafetyFlagCount(session.id);
        const requestRisk = classifyLiveContent({
          texts: [parsed.data.framing, parsed.data.rationale],
          reportedSignals: undefined,
          // An unreadable safety history is treated as a flagged one.
          sessionSafetyFlags: flags ?? 1,
        });
        const gate = liveGenerationOpen(await getLiveContentGate(), requestRisk.category);
        if (!gate.open) {
          void recordLadderEvent({
            outcome: 'live_suspended',
            route: 'none',
            kcId: parsed.data.kcId ?? null,
            skillKey: eventKey,
            tier: session.tier,
            locale: session.locale,
            riskCategory: requestRisk.category,
            reason: gate.reason,
          });
          return ok(res, { needsGeneration: false, liveSuspended: true, reason: gate.reason });
        }
        void recordLadderEvent({
          outcome: 'needs_generation',
          route: 'none',
          kcId: parsed.data.kcId ?? null,
          skillKey: eventKey,
          tier: session.tier,
          locale: session.locale,
          riskCategory: requestRisk.category,
        });
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
      const result = await persistAndServe(res, session.id, candidate, session.tier);
      if (result !== 'conflict') {
        void recordLadderEvent({
          outcome: candidate.origin === 'bank' ? 'bank' : 'catalog',
          route,
          kcId: parsed.data.kcId ?? null,
          skillKey: eventKey,
          tier: session.tier,
          locale: session.locale,
        });
      }
      if (result !== 'conflict') return result;
      // A concurrent request already claimed this exact candidate for this
      // session (migration 0064's fresh re-check) — loop and reselect
      // against the now-current exclusion set rather than surfacing a 502.
    }
    return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not record the segment after concurrent retries');
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
    const ladderEvent = (
      outcome: 'live_served' | 'live_refused',
      risk: ContentRiskCategory | null,
      reason: Parameters<typeof recordLadderEvent>[0]['reason'] = null,
    ) =>
      void recordLadderEvent({
        outcome,
        route: 'verify',
        kcId: parsed.data.kcId ?? null,
        skillKey: typeof parsed.data.provenance.skill_key === 'string' ? parsed.data.provenance.skill_key : null,
        tier: session.tier,
        locale: session.locale,
        riskCategory: risk,
        reason,
      });
    const verification = verifyGeneratedSegment(segment, session.tier);
    if (!verification.ok) {
      ladderEvent('live_refused', null, 'verification_failed');
      return ok(res, { accepted: false, failures: verification.failures });
    }

    /*
     * C.5: THE GOVERNANCE GATE (Appendix E §3.1.1). Core decides the item's
     * content-risk category itself (its own lexicon over the item and the
     * rationale, the session's recorded safety flags) and takes the union
     * with what Oracle reported, so a report can raise the category and
     * never lower it. The item is served only if that category is not
     * suspended and the judge that approved it is the calibrated one; the
     * sampling rate is the category's current (baseline or elevated) rate.
     */
    const flags = await sessionSafetyFlagCount(session.id);
    const risk = classifyLiveContent({
      texts: [
        collectSegmentProse(segment),
        typeof parsed.data.provenance.rationale === 'string' ? parsed.data.provenance.rationale : '',
      ],
      reportedSignals: parsed.data.provenance.risk_signals,
      sessionSafetyFlags: flags ?? 1,
    });
    const admission = admitLiveCandidate(
      await getLiveContentGate(),
      risk.category,
      parsed.data.provenance.judge_model,
      parsed.data.provenance.judge_prompt_hash,
    );
    if (!admission.admitted) {
      ladderEvent('live_refused', risk.category, admission.reason);
      return ok(res, { accepted: false, failures: [`live generation is not admitted: ${admission.reason}`] });
    }

    const candidate: LadderCandidate = {
      origin: 'live',
      lessonId: null,
      segment,
      answer: (segment.answer as Record<string, unknown> | undefined) ?? null,
      provenance: stampPedagogy(
        {
          ...parsed.data.provenance,
          tier: 3,
          verification: verification.failures,
          // Core's final classification replaces whatever Oracle reported.
          risk_category: risk.category,
          risk_signals: risk.signals,
          sampling: { rate: admission.rate, elevated: admission.elevated },
          calibration_id: admission.calibrationId,
        },
        parsed.data,
      ),
    };
    const live = {
      riskCategory: risk.category,
      riskSignals: risk.signals,
      sampleRate: admission.rate,
      elevated: admission.elevated,
      judgeModel: String(parsed.data.provenance.judge_model),
      judgePromptHash: String(parsed.data.provenance.judge_prompt_hash),
      calibrationId: admission.calibrationId,
      locale: session.locale,
    };

    /*
     * The SAME atomic claim `/segments` uses (migration 0064, RUNBOOK.md
     * Round 109) — this route used to compute its own `seq` with a separate
     * plain read (`countSessionSegments`), sharing the identical race. A
     * conflict here would mean this EXACT generated segment id was already
     * served to this session; two bounded retries recompute a fresh seq
     * rather than looping forever chasing a distinct candidate this route
     * has no way to re-author (unlike `/segments`, there is no ladder here
     * to re-run — the candidate is whatever Oracle already generated).
     */
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await persistAndServe(res, session.id, candidate, session.tier, verification.keyVerified, live);
      if (result !== 'conflict') {
        if (res.statusCode === 200) ladderEvent('live_served', risk.category);
        return result;
      }
    }
    return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not record the segment');
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

  /*
   * GAP-FIX-R2 (Frontend Bible 08 §2, §4; C.18): the KEY-BASED reveal check
   * for a Mentor turn's reply chips, BEFORE the turn is delivered. A chip is
   * sent as the learner's own words, so a chip that holds the open
   * activity's answer is a reveal one tap away. Oracle never holds the key;
   * this answers, per chip, `true` (reveals it), `false` or `null` (not
   * scorable) with the same `revealsAnswerKey` the honesty ledger scores
   * delivered turns with. Only a segment of THIS session is checked.
   */
  const RevealCheckBody = z
    .object({
      sessionId: z.uuid(),
      texts: z.array(z.string().min(1).max(200)).min(1).max(6),
    })
    .strict();
  router.post('/segments/:segmentId/reveal-check', async (req, res) => {
    const segmentId = z.string().uuid().safeParse(req.params.segmentId);
    if (!segmentId.success) return fail(res, 400, VALIDATION, 'Invalid segment id');
    const parsed = RevealCheckBody.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, VALIDATION, parsed.error.issues[0]?.message ?? 'Invalid body');
    const row = await getTutorSegment(segmentId.data);
    if (!row) return fail(res, 404, NOT_FOUND, 'No such segment');
    if (row.session_id !== parsed.data.sessionId) return fail(res, 403, 'FORBIDDEN', 'Segment is not in this session');
    return ok(res, {
      reveals: parsed.data.texts.map((text) => revealsAnswerKey({ segment: row.payload, answer: row.answer, text })),
    });
  });

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
      /*
       * THE MARKER `/grade` READS TO AVOID DOUBLE-COUNTING THIS SAME ANSWER
       * (found by adversarial review, 2026-08-30, HIGH). Only set once
       * `recordAttempt` has actually written evidence — never on its `null`
       * (a failed upstream read recorded nothing, and there is nothing here
       * to guard `/grade` against). Best-effort: logged, not fatal, because
       * the learner's spoken answer was already verified and the evidence it
       * DID write already landed — a lost PATCH here only reopens the
       * double-count window for a subsequent `/grade` call, it does not
       * undo real evidence.
       */
      if (pedagogy && !(await markSegmentVoiceChecked(row.id))) {
        console.error(`[tutor] voice-check: could not mark segment ${row.id} voice-checked — a later /grade call could double-count this evidence`);
      }
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

/**
 * `GET /offers`'s "continue where you left off" target, VERIFIED rather than
 * echoed straight from the digest.
 *
 * Found live (2026-08-31, CRITICAL): `last.summary.skillKeys[0]` used to
 * travel into `lastSession.skillKey` unchecked. `memoryDigest`'s `skillKeys`
 * come from `segment.provenance.skill_key` — the CONTENT LADDER's own bridge
 * identifier, `lower(courseSlug/topicSlug)` (migration 0036,
 * `tutorLadder.ts`'s `resolveSkill`) — stamped on every tier-1/tier-2 segment
 * REGARDLESS of the session's own intent. `courseId`/`topicId` (the digest's
 * OTHER two fields) are a different thing entirely: the intent's own
 * start-time parameters, null for `diagnostic`, `open`, and any `weak_skill`
 * start with no course/topic link (`OfferChips.tsx`'s map-driven `pickNode`,
 * among others). So the ordinary case — a session that started with neither
 * and then got taught real published content — closes with a `skillKey` and
 * NO `courseId`/`topicId`, and `OfferChips.tsx` reads "no ids" as "this must
 * be a KC-level resume", sending the content-ladder identifier as `{
 * intent: 'weak_skill', skillKey }`. `POST /sessions` checks THAT shape
 * against the `kc` table (`getKcBySkillKey`, correctly — `weak_skill`
 * promises a real pedagogy-graph target), and only 23 of several hundred
 * published topics carry a `kc.skill_key` at all
 * (`database/seeds/kc_graph.v1.json`): the overwhelming majority of
 * "continue" taps landed on `400 VALIDATION_ERROR "skillKey does not name a
 * real skill"` the instant the last session's topic was not one of those 23
 * — reproduced live on `financial-education/cobrar-y-dar-cambio`, which is
 * in fact a real, mapped `kc.skill_key` (`money.make-change-counting-up`)
 * and would have been ACCEPTED had it reached `POST /sessions` as a
 * `weak_skill` skillKey; the defect is that most topics are not so lucky.
 *
 * THE FIX REUSES THE PATH ALREADY PROVEN TO WORK rather than inventing a
 * third (per the incident's own instruction): `resolveSkill` is the SAME
 * function the ladder itself uses to turn this identifier back into a real,
 * PUBLISHED course/topic pair — it names one BY CONSTRUCTION, being
 * `courseSlug/topicSlug`. When it resolves, this returns a
 * `course_topic`-shaped target, which needs no KC at all, exactly mirroring
 * what a fresh `course_topic` start already does successfully. Only when NO
 * real course/topic remains (the topic was archived since — the catalog
 * prune of 2026-08-21 did this to 771 lessons) does this fall back to
 * checking the value against the KC graph itself (`getKcBySkillKey`, the
 * SAME check `POST /sessions` performs), so a genuine KC-only resume still
 * works. If NEITHER check names anything real, the skill key is dropped
 * (never a value `POST /sessions` is left to reject) — `OfferChips.tsx`
 * already hides the whole opening when both `topic` and `skillKey` come back
 * null (/AGENTS.md §1.14: nothing offered beats an offer that 400s the
 * instant it is accepted).
 *
 * Already-present `courseId`/`topicId` (an ordinary `course_topic` close, or
 * a `weak_skill` close that WAS given a course/topic link) are left exactly
 * as they were: that shape was never the broken one — `OfferChips.tsx`
 * already resumes it via `course_topic` without ever reading `skillKey` — so
 * resolving it a second time here would only spend a request confirming
 * what is already known to work.
 *
 * A `resolveSkill` miss and a transient read failure are indistinguishable
 * by construction (`resolveSkill` itself collapses them, exactly as its
 * other callers in this file already treat it) — acceptable here because
 * this endpoint is advisory only and never writes (the same posture
 * `sessionCapReached` above already takes): a real KC skillKey survives via
 * the `getKcBySkillKey` fallback either way, and the rare transient miss
 * costs one hidden chip, not a wrong answer. `getKcBySkillKey`'s OWN
 * `'error'` is kept apart from `'not_found'`, though: an unverifiable key is
 * passed through rather than guessed at, so a genuine backend blip surfaces
 * as the same honest failure `POST /sessions` would give it, never a
 * silently dropped offer.
 */
async function resolveLastSessionOffer(last: {
  summary: SessionSummaryDigest;
  ended_at: string;
}): Promise<{
  topic: string | null;
  courseId: string | null;
  topicId: string | null;
  skillKey: string | null;
  outcome: SessionSummaryDigest['outcome'];
  daysAgo: number;
}> {
  const { summary } = last;
  let courseId: string | null = summary.courseId;
  let topicId: string | null = summary.topicId;
  // Annotated explicitly: `skillKeys[0]` types as plain `string` (no
  // `noUncheckedIndexedAccess`), so without this TS collapses `?? null` out
  // of the inferred type and then rejects reassigning `null` to it below.
  let skillKey: string | null = summary.skillKeys[0] ?? null;

  if (!courseId && !topicId && skillKey) {
    const resolved = await resolveSkill(skillKey);
    if (resolved) {
      courseId = resolved.courseId;
      topicId = resolved.topicId;
    } else {
      const lookup = await getKcBySkillKey(skillKey);
      if (lookup.status === 'not_found') skillKey = null;
    }
  }

  return {
    topic: summary.topic,
    courseId,
    topicId,
    skillKey,
    outcome: summary.outcome,
    daysAgo: daysAgo(last.ended_at),
  };
}

/** Hash a uuid into a small non-negative integer, for stable rotation. */
function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash;
}

/**
 * Persists a chosen candidate through the atomic claim (migration 0064,
 * RUNBOOK.md Round 109) and answers the client — or reports `'conflict'`
 * without sending a response, so a caller with a ladder to re-run (`POST
 * /segments`) can reselect and retry instead of surfacing a manufactured
 * 502 for a concurrent request that legitimately lost a race it should
 * never have needed to run in the first place.
 *
 * `seq` is no longer a parameter: it used to be the CALLER's own
 * pre-ladder snapshot (`served.length`), which is exactly what raced under
 * concurrency. The atomic function now assigns it fresh, inside its own
 * lock, and this function reports back whatever it actually assigned
 * (`row.seq`) rather than a value computed before the claim.
 */
async function persistAndServe(
  res: Parameters<typeof ok>[0],
  sessionId: string,
  candidate: LadderCandidate,
  tier: number,
  keyVerifiedOverride?: boolean,
  /**
   * C.5: the governance facts of an admitted LIVE candidate. A live item is
   * claimed only through the governed function (segment + systematic
   * sampling decision + log row in one transaction); there is no path that
   * serves a live item without its sampling record.
   */
  live?: {
    riskCategory: ContentRiskCategory;
    riskSignals: readonly string[];
    sampleRate: number;
    elevated: boolean;
    judgeModel: string;
    judgePromptHash: string;
    calibrationId: string;
    locale: string;
  },
): Promise<unknown | 'conflict'> {
  // A catalog or bank segment was human-published, so its key is verified by
  // construction. A live one is verified only if re-execution said so.
  const keyVerified = keyVerifiedOverride ?? candidate.origin !== 'live';
  // Every real segment carries a non-empty `id` (serveFromCatalog/serveFromBank
  // filter on it, and SegmentBase declares it required) — the `null` branch is
  // defensive only, and skips the atomic function's duplicate-serve check
  // rather than ever comparing against an empty string.
  const sourceKey = typeof candidate.segment.id === 'string' && candidate.segment.id !== '' ? candidate.segment.id : null;

  if (candidate.origin === 'live' && live === undefined) {
    // Unreachable by construction; refusing is the only safe answer.
    return fail(res, 500, 'INTERNAL', 'A live segment reached persistence without its governance record');
  }
  /*
   * Live items are sampled into the staff review queue by the governed
   * claim (C.5): systematically, at the category's current rate, never
   * below the Appendix E floor. This does not protect the first learner; it
   * is what catches a SYSTEMATIC defect early, and what drives the dynamic
   * rate and the Stage 7 suspension.
   */
  const row = live !== undefined
    ? await insertLiveSegmentChecked<TutorSegmentRow>({
        sessionId,
        sourceKey,
        segmentType: candidate.segment.type,
        payload: candidate.segment as unknown as Record<string, unknown>,
        answer: candidate.answer,
        keyVerified,
        provenance: candidate.provenance,
        riskCategory: live.riskCategory,
        riskSignals: live.riskSignals,
        tier,
        locale: live.locale,
        sampleRate: live.sampleRate,
        elevated: live.elevated,
        judgeModel: live.judgeModel,
        judgePromptHash: live.judgePromptHash,
        calibrationId: live.calibrationId,
      })
    : await insertTutorSegmentChecked({
        sessionId,
        sourceKey,
        origin: candidate.origin,
        lessonId: candidate.lessonId,
        segmentType: candidate.segment.type,
        payload: candidate.segment as unknown as Record<string, unknown>,
        answer: candidate.answer,
        keyVerified,
        provenance: candidate.provenance,
        reviewStatus: null,
      });
  if (row === 'conflict') return 'conflict';
  if (row === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not record the segment');

  void tier;
  return ok(res, {
    segmentId: row.id,
    seq: row.seq,
    origin: candidate.origin,
    segment: stripCandidate(candidate.segment),
    keyVerified,
    servedDifficulty: servedDifficultyOf(candidate.segment),
  });
}

/**
 * The difficulty the SERVED segment actually carries — never the requested one.
 *
 * `serveFromCatalog` and `serveFromBank` order candidates by difficulty
 * DISTANCE and take the nearest, so the ladder legitimately answers a request
 * for band 4 with the band-2 segment that is the only one this topic has —
 * and the prerequisite and frontier fallback rungs reach into an entirely
 * different topic, whose bands were never chosen with this request in mind.
 * That substitution is correct behaviour; what was missing is SAYING SO. Every
 * `difficulty` in this route is the value the caller ASKED for, so Oracle's
 * session-scoped ratchet (`oracle/src/tutor/controller.ts`'s `lastDifficulty`)
 * kept ratcheting off its own guess rather than off what landed on the screen.
 * Found by adversarial review, round 59, deferred; fixed round 74
 * (2026-08-30, MEDIUM). Core's BKT posterior is difficulty-agnostic, so
 * nothing PERSISTED was ever corrupted by this — only Oracle's local adaptive
 * state, for the rest of the session.
 *
 * `null`, never a default, when the chosen segment declares no usable
 * difficulty (§1.14: failure must be distinguishable from emptiness).
 * `orderCandidates` defaults a missing difficulty to 3 for SORTING, where a
 * tie-break guess costs nothing; reporting that same 3 here would be
 * indistinguishable from a segment genuinely authored at band 3, and the
 * consumer would reconcile its ratchet to a number nobody ever wrote down.
 */
function servedDifficultyOf(segment: SegmentBase): number | null {
  const value = (segment as { difficulty?: unknown }).difficulty;
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5 ? value : null;
}

interface CourseTitleRow {
  id: string;
  title: Record<string, string>;
}

/**
 * Catalog topic titles by id, for the guardian narrative's DIGEST fallback
 * (/ORACLE.md §12, 2026-09-01).
 *
 * Why this exists at all: the digest (`tutor_sessions.summary`, migration
 * `0051`) stores BOTH a baked `topic` STRING — written at close in the
 * CHILD's session locale — and the `topicId` it was baked from. Reading the
 * baked string back to a guardian showed a bilingual family a topic name in
 * a language they did not choose, which is precisely the defect the
 * attempt-backed tier of this narrative already avoids by resolving
 * `kc.title` in the guardian's own locale. The id was there the whole time,
 * so this is a re-localization, not a new fact: same row, same RLS, same
 * catalog table `resolveCourseContext` above already reads.
 *
 * Shaped after `getKcTitlesByIds` (kcData.ts) rather than looping
 * `resolveCourseContext`: one bounded `in.(...)` read for the whole page,
 * never one round-trip per session. Deliberately NOT `status`-filtered — a
 * topic later unpublished is still the real thing this child worked on, and
 * a title is catalog text we wrote, not injected content (the same reasoning
 * `getKcTitlesByIds` records for a retired KC).
 */
async function getTopicTitlesByIds(topicIds: string[]): Promise<Map<string, Record<string, string>>> {
  const out = new Map<string, Record<string, string>>();
  if (topicIds.length === 0) return out;
  const rows = await serviceRest<CourseTitleRow[]>(
    `/topics?id=in.(${topicIds.map((id) => encodeURIComponent(id)).join(',')})&select=id,title&limit=200`,
  );
  // A transport failure returns null, and the caller falls back to the baked
  // digest string — a topic named in the wrong language still beats no topic
  // at all on a read-only, display-only surface (§1.14 permits defaulting
  // exactly here: nothing is read-modify-written back).
  for (const row of rows ?? []) out.set(row.id, row.title ?? {});
  return out;
}

/**
 * Resolves what a `course_topic` session is ABOUT, into the title Oracle's
 * `buildPlan` names as the lesson's whole objective.
 *
 * Found by adversarial review, round 46 (2026-08-30, HIGH): both lookups used
 * to omit `status=eq.published` — unlike every other consumer of these two
 * tables (`tutorLadder.ts`, `supabaseRest.ts`'s own course/topic reads) — and
 * ran INDEPENDENTLY, with no check that `topicId` actually belongs to
 * `courseId`. `courseId`/`topicId` are client-supplied on `POST
 * /tutor/sessions` (`StartBody` validates only `.uuid()`), so a crafted
 * request could pull a DRAFT course's real title into a child's session
 * objective — unpublished, unreviewed content reaching a minor — and pair a
 * topic from one course with a courseId from an unrelated one, a
 * Frankenstein combination with no relationship at all. The leaked title
 * does not stay in-session either: the same unfiltered resolution runs again
 * at session close to write the post-session memory digest, which later
 * renders verbatim as the "Continue" chip's visible label
 * (`OfferChips.tsx`'s `tutor.offers.continue.title`) — a draft course's
 * title could appear as button text on a child's screen on a LATER visit.
 *
 * Fixed the same way `tutorLadder.ts:99` already verifies a topic's course
 * membership: PostgREST's `!inner` join walks `topics -> sagas -> adventures`
 * to filter on the ANCESTOR `course_id`, in the same query that also
 * enforces `status=eq.published` on both tables. When only one id is
 * present, or the two do not belong together, the OTHER one can still
 * resolve on its own — this degrades to a partial, individually-real
 * context, never to a mismatched pairing.
 */
async function resolveCourseContext(
  courseId: string | null,
  topicId: string | null,
  locale: string,
): Promise<{ courseId: string | null; courseTitle: string | null; topicId: string | null; topicTitle: string | null } | null> {
  const pick = (title: Record<string, string> | undefined): string | null =>
    title?.[locale] ?? title?.['es-MX'] ?? Object.values(title ?? {})[0] ?? null;

  const course = courseId
    ? (
        await serviceRest<CourseTitleRow[]>(
          `/courses?id=eq.${encodeURIComponent(courseId)}&status=eq.published&select=id,title&limit=1`,
        )
      )?.[0]
    : undefined;
  const topic = topicId
    ? (
        await serviceRest<CourseTitleRow[]>(
          courseId
            ? `/topics?id=eq.${encodeURIComponent(topicId)}&status=eq.published` +
                `&select=id,title,sagas!inner(adventures!inner(course_id))` +
                `&sagas.adventures.course_id=eq.${encodeURIComponent(courseId)}&limit=1`
            : `/topics?id=eq.${encodeURIComponent(topicId)}&status=eq.published&select=id,title&limit=1`,
        )
      )?.[0]
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

  router.use(requireAuth, requireAgeScreen);

  async function calibrationState(res: Parameters<typeof fail>[0]) {
    const user = authedUser(res);
    const profile = await profileOf(user.accessToken, user.id);
    if (!profile) return null;
    const known = knownMentorAgeTier(profile.birth_date, res.locals.ageScreen as AgeScreenState);
    if (known !== null) return { required: false, tier: known };
    const stored = await readMentorAgeCalibration(user.id);
    return stored ? { required: stored.tier === null, tier: stored.tier } : null;
  }

  router.get('/age-calibration', async (_req, res) => {
    const state = await calibrationState(res);
    return state ? ok(res, state) : fail(res, 502, 'DATA_UNAVAILABLE', 'Could not read teaching calibration');
  });

  router.post('/age-calibration', async (req, res) => {
    const parsed = z.object({ tier: MentorAgeTier }).strict().safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Choose a teaching age band');
    const current = await calibrationState(res);
    if (!current) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not read teaching calibration');
    if (!current.required) return ok(res, current);
    const stored = await recordMentorAgeCalibration(authedUser(res).id, parsed.data.tier);
    if (stored === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not save teaching calibration');
    const confirmed = await calibrationState(res);
    if (!confirmed || confirmed.required || confirmed.tier !== stored) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not confirm teaching calibration');
    return ok(res, confirmed);
  });

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

    /*
     * Found by adversarial review, round 36 (2026-08-30, MEDIUM/HIGH): this
     * check used to compare only the two fields present in THIS request
     * body, so it never fired unless a single PUT set both at once — a
     * two-step sequence (PUT `{character}`, then later PUT `{companion}`
     * alone) silently landed a tutor whose companion is itself, because the
     * second request's body never mentioned `character` at all. The
     * invariant is about the PERSISTED state, not the request body, so it
     * is checked against the MERGED result: the learner's current row with
     * this patch applied on top, exactly what `upsertTutorPreferences` is
     * about to write.
     */
    const current = await getTutorPreferences(user.id);
    if (current === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not read preferences');
    const mergedCharacter = parsed.data.character ?? current.character;
    const mergedCompanion = parsed.data.companion !== undefined ? parsed.data.companion : current.companion;
    if (mergedCompanion !== null && mergedCompanion === mergedCharacter) {
      return fail(res, 400, VALIDATION, 'The companion cannot be the same character as the tutor');
    }

    if (parsed.data.nickname) {
      const profile = await profileOf(user.accessToken, user.id);
      if (profile === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not read profile');
      if (looksLikeRealName(parsed.data.nickname, profile.display_name)) {
        return fail(res, 400, VALIDATION, 'A nickname may not be your real name');
      }
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

    const calibration = await calibrationState(res);
    if (!calibration) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not read teaching calibration');
    if (calibration.tier === null) return fail(res, 403, 'MENTOR_AGE_CALIBRATION_REQUIRED', 'Complete teaching age calibration first');
    const map = await buildTutorMap(user.id, calibration.tier, normalizeLocale(profile.locale));
    if (map === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not read the learning map');
    return ok(res, map);
  });

  /*
   * GAP-FIX-R2 — WHAT THE MENTOR DECIDED, AND ON WHAT EVIDENCE (Block C Real-
   * Time Interaction Standard; Appendix D §2.6: "expose the evidence, not
   * just the conclusion"; C.10). Per skill: the displayed state, the latest
   * consequential decision with the evidence the controller logged, and the
   * next re-check. Numbers and closed labels only (`masteryEvidence.ts`).
   * The learner reads their own; a verified guardian reads their child's,
   * behind the same `isVerifiedGuardian` gate every other /kids route uses.
   */
  const masteryLocale = async (user: ReturnType<typeof authedUser>) =>
    normalizeLocale((await profileOf(user.accessToken, user.id))?.locale);

  router.get('/mastery', async (_req, res) => {
    const user = authedUser(res);
    if (!getConfig().TUTOR_V3_BRAIN) return ok(res, { items: [] });
    const evidence = await buildMasteryEvidence(user.id, await masteryLocale(user));
    if (evidence === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not read the learning evidence');
    return ok(res, evidence);
  });

  router.get('/kids/:kidUserId/mastery', async (req, res) => {
    const kidUserId = z.string().uuid().safeParse(req.params.kidUserId);
    if (!kidUserId.success) return fail(res, 400, VALIDATION, 'Invalid user id');
    const user = authedUser(res);
    const guardian = await isVerifiedGuardian(user.id, kidUserId.data);
    if (guardian === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not verify guardianship');
    if (!guardian) return fail(res, 403, 'FORBIDDEN', 'Not your dependant');
    if (!getConfig().TUTOR_V3_BRAIN) return ok(res, { items: [] });
    const evidence = await buildMasteryEvidence(kidUserId.data, await masteryLocale(user));
    if (evidence === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not read the learning evidence');
    return ok(res, evidence);
  });

  // ── The offer screen (/ORACLE.md §9.2) ────────────────────────────────────

  router.get('/offers', async (_req, res) => {
    const user = authedUser(res);
    const profile = await profileOf(user.accessToken, user.id);
    const locale = normalizeLocale(profile?.locale);

    const roles = await getRolesForGate(user.id);
    if (roles === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not resolve roles');
    const { isMinor, originRestricted } = await resolveMentorSafety(user.id, roles);

    /*
     * Voice availability is resolved HERE, before the session starts, because
     * the offer screen carries the "talk out loud" checkbox. Discovering that
     * the microphone is unavailable only after the session opens means the
     * learner ticked a box that did nothing, which is worse than a checkbox
     * that was honestly absent.
     */
    const consent = isMinor && !originRestricted ? await getActiveVoiceConsent(user.id) : null;
    const runtime = await preflight(isMinor, true);

    /*
     * THE CAP THE OFFER SCREEN USED TO BE SILENT ABOUT. Found by adversarial
     * review, round 99 (2026-08-31, HIGH): `canStart`/`startBlockedBy` below
     * reflected ONLY `runtime` — Oracle's own health — never
     * `MAX_SESSIONS_PER_DAY`, so a learner who had already used every
     * session today saw the exact same inviting offer screen as one who had
     * used none, discovering the refusal only after tapping an opening and
     * having `POST /sessions` bounce them with `SESSION_LIMIT`.
     *
     * This reuses the SAME cap constants and the SAME local-midnight
     * boundary (`startOfLocalDayIso`) that `POST /sessions` enforces
     * atomically below, and the SAME staff exemption, via a read-only count
     * over the identical predicate `start_tutor_session_checked` (migration
     * 0057) evaluates inside its own advisory lock — see
     * `countTutorSessionsSince`'s own comment for why a second SQL function
     * was not needed. This read is advisory only: a `null` count (an
     * upstream failure) degrades to "not reached" rather than lying that a
     * full cap is empty, which is acceptable ONLY because this endpoint
     * never writes anything (§1.14) — the actual enforcement never moved
     * off the atomic path below.
     */
    const isStaff = isStaffRoles(roles);
    const sessionsToday = await countTutorSessionsSince(user.id, startOfLocalDayIso(locale));
    const sessionCapReached = sessionsToday !== null && sessionsToday >= (isStaff ? STAFF_SESSION_CAP : MAX_SESSIONS_PER_DAY);
    /*
     * The SAME reset instant round 95's fix computes for `POST /sessions`'s
     * own 429 `resetAt` — exposed here too, proactively, so this screen and
     * the post-tap refusal never disagree about HOW LONG the wait is. Reuses
     * `SessionLimitResetAt` (defined above) rather than a bare
     * `.toISOString()`, for the same reason round 95 introduced it: a
     * regression in the day-ahead arithmetic fails loudly here instead of
     * shipping a countdown to the past onto a child's screen. Only computed
     * when the cap is actually what is blocking — never a meaningless value
     * for every other visit.
     */
    const sessionCapResetAt = sessionCapReached
      ? SessionLimitResetAt.parse(startOfLocalDayIso(locale, new Date(), 1))
      : null;

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
    const lastSession = last ? await resolveLastSessionOffer(last) : null;

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
      lastSession,
      intelDegraded: states === null,
      /**
       * Whether a session can be started at all right now — Oracle's own
       * health AND the learner's daily cap folded into ONE answer, because a
       * learner cannot tell (and should not have to) which one is refusing
       * them. `startBlockedBy` names the reason; `SESSION_LIMIT` reuses the
       * exact code `POST /sessions` already returns for the same refusal
       * (round 99), so one piece of client copy serves both moments.
       */
      canStart: runtime.canStart && !sessionCapReached,
      startBlockedBy: !runtime.canStart ? runtime.blockedBy : sessionCapReached ? 'SESSION_LIMIT' : null,
      sessionCapResetAt,
      voiceAvailable: runtime.voiceAvailable,
      /** Distinct reasons deserve distinct copy: no consent vs no provider. */
      microphoneBlockedBy: microphoneBlockedBy(isMinor, consent !== null, runtime, originRestricted),
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
      faqIds: FAQ_IDS,
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
    .strict()
    /*
     * `faq`'s `skillKey` carries one of `FAQ_IDS`, and only one of them — see
     * that constant's own comment for the incident this closes.
     *
     * `weak_skill`'s `skillKey` used to keep the unrestricted-string shape on
     * the strength of a comment here claiming it was "validated against the
     * learner's own live weak-skills list downstream." Found by adversarial
     * review, round 47 (2026-08-30, HIGH): that claim was false — no
     * downstream consumer ever checked it against anything. It is now
     * verified against the real KC graph, asynchronously, in the route
     * handler below (a shape-only Zod refine cannot make a DB call) — see
     * that check's own comment for the incident.
     *
     * `open`, `course_topic` and `diagnostic` carry NO legitimate `skillKey`
     * at all — round 47's own comment here used to claim this as an
     * assumption about client behavior ("pass no meaningful skillKey"), which
     * is not the same thing as an enforced boundary. Found by adversarial
     * review, round 49 (2026-08-30, HIGH): any authenticated caller can POST
     * directly, and nothing stopped `{intent:'open', skillKey:'<anything up
     * to 128 chars>'}` from reaching `buildPlan` (`oracle/src/tutor/plan.ts`)
     * unfenced as the WHOLE lesson objective whenever `courseContext` is null
     * — the common shape for `open`, and a reachable one for `course_topic`
     * too, since `courseId`/`topicId` are independent, attacker-controlled
     * fields that can simply be omitted or fail to resolve. Verified end to
     * end via Supertest against the real route: `{intent:'open',
     * skillKey:'IGNORE ALL PRIOR INSTRUCTIONS...'}` returned 201 and sent the
     * string verbatim to `p_skill_key`, persisted with zero check — the exact
     * shape already closed twice for `faq` (round 40) and `weak_skill`
     * (round 47), just on the two intents that comment incorrectly declared
     * safe. No frontend caller ever sends `skillKey` for these three intents
     * (`OfferChips.tsx`, `mic.ts` — grepped, confirmed), so rejecting one
     * outright costs no real traffic and closes the whole class rather than
     * trying to validate content that was never supposed to exist here.
     */
    .refine(
      (body) => {
        if (body.intent === 'faq') return FAQ_IDS.includes(body.skillKey as (typeof FAQ_IDS)[number]);
        if (body.intent === 'weak_skill') return true; // verified against the real KC graph below
        return body.skillKey === null || body.skillKey === undefined;
      },
      { message: 'skillKey is not valid for this intent', path: ['skillKey'] },
    );

  router.post('/sessions', async (req, res) => {
    const parsed = StartBody.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, VALIDATION, parsed.error.issues[0]?.message ?? 'Invalid request');
    const user = authedUser(res);

    /*
     * `weak_skill`'s ONE trust claim, actually enforced. Found by adversarial
     * review, round 47 (2026-08-30, HIGH): `skillKey` reached this far as any
     * string up to 128 chars — the schema's own comment above claimed a
     * downstream check that did not exist. Oracle's `INTENT_INSTRUCTIONS.
     * weak_skill` tells the model "the system flagged a skill... and they
     * accepted the offer" — an authority claim the model has no way to
     * question — and with `courseContext` null (the common shape for a
     * weak-skill offer with no course/topic link), `buildPlan` embedded the
     * raw string, UNFENCED, as the whole lesson objective. A crafted
     * `skillKey` reached the tutor's own system prompt with that same
     * elevated framing vouching for it. `getKcBySkillKey` distinguishes a
     * genuinely unknown key (400 — reject) from a read failure (502 — refuse
     * rather than let an unverified string through unchecked); `open`,
     * `course_topic` and `diagnostic` are handled above instead, in the
     * schema itself — `skillKey` is rejected outright for those three, not
     * merely assumed absent (round 49 closed that gap).
     */
    if (parsed.data.intent === 'weak_skill' && parsed.data.skillKey) {
      const lookup = await getKcBySkillKey(parsed.data.skillKey);
      if (lookup.status === 'error') return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not verify that skill');
      if (lookup.status === 'not_found') {
        return fail(res, 400, VALIDATION, 'skillKey does not name a real skill');
      }
    }

    const roles = await getRolesForGate(user.id);
    if (roles === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not resolve roles');
    const { isMinor, originRestricted } = await resolveMentorSafety(user.id, roles);

    const profile = await profileOf(user.accessToken, user.id);
    if (!profile) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not read profile');
    const locale = normalizeLocale(profile.locale);

    // THE MICROPHONE GATE. Blocking, not a flag (/ORACLE.md §4.3). A minor with
    // no active guardian consent gets a working, silent session — never a
    // session that quietly opens a microphone.
    const calibration = await calibrationState(res);
    if (!calibration) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not resolve mentor age calibration');
    if (calibration.tier === null) return fail(res, 403, 'MENTOR_AGE_CALIBRATION_REQUIRED', 'Complete mentor age calibration first');
    const consent = isMinor && !originRestricted ? await getActiveVoiceConsent(user.id) : null;
    const wantsVoice = parsed.data.wantsVoice && (!isMinor || consent !== null);

    const runtime = await preflight(isMinor, wantsVoice);
    if (!runtime.canStart) {
      return fail(res, 503, runtime.blockedBy ?? 'ORACLE_UNAVAILABLE', 'The tutor is not available right now');
    }

    const prefs = await getTutorPreferences(user.id);
    if (prefs === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not read preferences');

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
     * nobody could look at it twice in one evening. Passing an effectively
     * unlimited cap for staff reuses this one atomic path rather than a
     * second, unchecked insert.
     */
    const isStaff = isStaffRoles(roles);
    const result = await startTutorSessionChecked({
      userId: user.id,
      sinceIso: startOfLocalDayIso(locale),
      cap: isStaff ? STAFF_SESSION_CAP : MAX_SESSIONS_PER_DAY,
      locale,
      tier: calibration.tier,
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
    if (result === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not start the session');
    if (result.status === 'cap_reached') {
      // The reset instant, not a fixed "come back tomorrow": the client
      // formats this into a concrete time-remaining rather than guessing at
      // local midnight with its own clock and timezone, which can disagree
      // with the server's (§1.9 — a vague wait reads the same whether it is
      // ten minutes or a day to a child with a weak sense of relative time).
      const resetAt = SessionLimitResetAt.parse(startOfLocalDayIso(locale, new Date(), 1));
      return fail(res, 429, 'SESSION_LIMIT', 'You have used all of today’s tutor sessions', { resetAt });
    }
    const session = result.session;

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
        microphoneBlockedBy: microphoneBlockedBy(isMinor, consent !== null, runtime, originRestricted),
      },
      201,
    );
  });

  router.get('/sessions', async (_req, res) => {
    const user = authedUser(res);
    const page = await listTutorSessions(user.id);
    if (page === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not read sessions');
    return ok(res, { sessions: page.sessions.map(summarizeSession) });
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

    const calibration = await calibrationState(res);
    if (!calibration) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not resolve mentor age calibration');
    if (calibration.tier === null) return fail(res, 403, 'MENTOR_AGE_CALIBRATION_REQUIRED', 'Complete mentor age calibration first');
    if (calibration.tier !== session.tier) return fail(res, 409, 'SESSION_AGE_CHANGED', 'Start a session with the confirmed teaching register');
    const { url, expiresAt } = tutorSocketUrl(session.id, user.id);
    return ok(res, { sessionId: session.id, socketUrl: url, socketExpiresAt: expiresAt });
  });

  /*
   * C.15 THE END-OF-SESSION BOND PROXY: "did I get what you were going for
   * today?" (Appendix D §3.4; Appendix F §1.2 Alliance Bond Proxy Score).
   * The learner answers it on the closing surface AFTER the session closed.
   * Their own session only (a guardian answers nothing for the child), once,
   * within a day of the close, and never after a safety stop — nothing on
   * that screen may invite the learner back into the lesson or ask them to
   * rate it.
   */
  const AllianceCheckBody = z.object({ answer: z.enum(BOND_PROXY_ANSWERS) }).strict();

  router.post('/sessions/:id/alliance-check', async (req, res) => {
    const sessionId = z.string().uuid().safeParse(req.params.id);
    if (!sessionId.success) return fail(res, 400, VALIDATION, 'Invalid session id');
    const body = AllianceCheckBody.safeParse(req.body);
    if (!body.success) return fail(res, 400, VALIDATION, 'Choose one answer');
    const user = authedUser(res);

    const session = await getTutorSession(sessionId.data);
    if (!session) return fail(res, 404, NOT_FOUND, 'No such session');
    if (session.user_id !== user.id) return fail(res, 403, 'FORBIDDEN', 'This is not your session');
    if (session.ended_at === null) return fail(res, 409, 'SESSION_OPEN', 'The session has not ended yet');
    if (session.close_reason === 'safety_stop') return fail(res, 409, 'NOT_ASKED', 'This session does not ask for feedback');
    if (Date.now() - Date.parse(session.ended_at) > ALLIANCE_THRESHOLDS.bondProxyWindowHours * 3_600_000) {
      return fail(res, 409, 'TOO_LATE', 'This question has closed');
    }
    const row = await getAllianceRow(session.id);
    if (row === undefined) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not read the session record');
    if (row === null) return fail(res, 409, 'NOT_TRACKED', 'This session did not record the question');
    if (row.bond_proxy !== null) return fail(res, 409, 'ALREADY_ANSWERED', 'Already answered');
    const written = await writeBondProxy(row.id, body.data.answer);
    if (written === 'failed') return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not save the answer');
    if (written === 'already') return fail(res, 409, 'ALREADY_ANSWERED', 'Already answered');
    // Persona rapport (C.7), best-effort: the metric row is the record.
    const folded = await recordDispositionBondProxy(user.id, session.character as 'dina' | 'liruf' | 'rho' | 'zara', body.data.answer);
    if (!folded) console.warn(`[tutor] bond proxy not folded into the disposition profile for session ${session.id}`);
    return ok(res, { recorded: true });
  });

  /*
   * C.7 THE DISPOSITION PROFILE, READABLE AND RESETTABLE (Appendix D §2.6:
   * interpretable, never a black box; the learner-memory boundary). Closed
   * labels and numbers only. The learner reads their own; a verified
   * guardian reads their child's. A reset follows the memory-review rule
   * (OD-18): a child's profile is reset by their verified guardian; a teen
   * without a guardian link and an adult reset their own.
   */
  router.get('/disposition', async (_req, res) => {
    const row = await getDispositionProfile(authedUser(res).id);
    if (row === undefined) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not read the learning profile');
    return ok(res, explainProfile(row));
  });

  router.delete('/disposition', async (_req, res) => {
    const user = authedUser(res);
    const reviewer = await classifyMemoryReview(user.id);
    if (reviewer === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not resolve who manages this profile');
    if (reviewer === 'guardian-review') return fail(res, 403, 'GUARDIAN_MANAGED', 'A verified Tutor manages this profile');
    if (reviewer === 'hold') return fail(res, 403, 'AGE_EVIDENCE_REQUIRED', 'Complete the age check first');
    if (!(await deleteDispositionProfile(user.id))) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not reset the learning profile');
    return ok(res, { reset: true });
  });

  router.get('/kids/:kidUserId/disposition', async (req, res) => {
    const kidUserId = z.string().uuid().safeParse(req.params.kidUserId);
    if (!kidUserId.success) return fail(res, 400, VALIDATION, 'Invalid user id');
    const guardian = await isVerifiedGuardian(authedUser(res).id, kidUserId.data);
    if (guardian === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not verify guardianship');
    if (!guardian) return fail(res, 403, 'FORBIDDEN', 'Not your dependant');
    const row = await getDispositionProfile(kidUserId.data);
    if (row === undefined) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not read the learning profile');
    return ok(res, explainProfile(row));
  });

  router.delete('/kids/:kidUserId/disposition', async (req, res) => {
    const kidUserId = z.string().uuid().safeParse(req.params.kidUserId);
    if (!kidUserId.success) return fail(res, 400, VALIDATION, 'Invalid user id');
    const user = authedUser(res);
    const guardian = await isVerifiedGuardian(user.id, kidUserId.data);
    if (guardian === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not verify guardianship');
    if (!guardian) return fail(res, 403, 'FORBIDDEN', 'Not your dependant');
    if (!(await deleteDispositionProfile(kidUserId.data))) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not reset the learning profile');
    await insertAuditLog(user.id, 'mentor.disposition_profile.reset_by_guardian', 'tutor', { learner: kidUserId.data });
    return ok(res, { reset: true });
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
        // `seq` here is this segment's own per-session ordinal
        // (`countSessionSegments`), NOT the seq of the turn that requested
        // it — the two are separate counters. `createdAt` is what actually
        // lets a replay place this activity among the turns; see
        // `replayScript.ts`'s comparator.
        createdAt: s.created_at,
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

    /*
     * Found by adversarial review, round 36 (2026-08-30, MEDIUM): a grader
     * that throws used to be silently indistinguishable from a genuinely
     * wrong answer — the SAME `{ score: 0 }` reached the learner, the
     * guardian-visible history, and (uncaught, until the fix below) the
     * pedagogical mastery model, with no log line anywhere. A content/grader
     * bug looked exactly like a learner who keeps failing, with zero
     * server-side signal (§1.14 "blind flight").
     */
    let outcome: { score: number; feedback_md?: string };
    let graderCrashed = false;
    try {
      outcome = grader(withKey, parsed.data.answer);
    } catch (error) {
      // A grader that throws is our bug, not the learner's. Score zero, allow
      // a retry, and never surface a stack trace to a child — but LOG it, and
      // never let it feed the mastery model as if it were real evidence (see
      // the `recordAttempt` gate below).
      console.error(
        `[tutor] grader for segment type "${segment.type}" threw on segment ${row.id}:`,
        error instanceof Error ? error.message : error,
      );
      graderCrashed = true;
      outcome = { score: 0 };
    }

    const penalised = Math.round(outcome.score * (1 - Math.min(parsed.data.hintsUsed, 2) * 0.1));
    const score = Math.max(0, Math.min(100, penalised));
    const verdict = verdictFrom(score, PASS_THRESHOLD, outcome.feedback_md);
    /*
     * THE STORED SCORE NEVER GOES DOWN (found by adversarial review, round
     * 36, 2026-08-30, HIGH). `recordSegmentResult` used to overwrite
     * `tutor_segments.score` unconditionally on every call — a client retry,
     * a double-tap, or a learner tapping back into an already-passed
     * segment and answering worse the second time could flip a correct
     * result to incorrect in both the guardian-visible session replay
     * (`GET /sessions/:id`) and the cross-session memory digest
     * (`memoryDigest()`'s `gradedCorrect`, which reads `score >=
     * PASS_THRESHOLD`). The VERDICT returned to the learner this call still
     * reflects what they just did — they need honest feedback on THIS
     * attempt — only the PERSISTED record floors at the best result seen.
     */
    const bestScore = row.score === null ? score : Math.max(row.score, score);
    /*
     * `attempts` IS SERVER-DERIVED, NOT THE CLIENT'S CLAIM (found by
     * adversarial review, round 36, 2026-08-30, LOW/MEDIUM). The client's
     * `attemptNumber` fed both the stored `attempts` column AND
     * `recordAttempt`'s FSRS rating unchecked — a client could always claim
     * `attemptNumber: 1` regardless of real retry count, and two identical
     * submissions (a genuine retry after a timeout, a double-tap) recorded
     * the SAME ordinal twice, which is indistinguishable evidence duplicated
     * into the mastery model. Deriving it from the segment's own previous
     * count at least gives every recorded attempt a distinct, correctly
     * ordered number; it does not by itself detect a true network-level
     * duplicate request, which would need a client-supplied idempotency key
     * — a larger change this round does not make.
     */
    const attemptOrdinal = Math.min(row.attempts + 1, 3);

    /*
     * XP is payable ONLY when the key survived re-execution (/ORACLE.md §8).
     * A live segment whose key could not be independently re-derived still
     * teaches — the learner sees the feedback — but it awards nothing, because
     * awarding progress for a result the server could not verify is how a
     * generated exercise quietly corrupts a child's record.
     *
     * NEVER PAY A SEGMENT MORE THAN ITS OWN WORTH, NO MATTER HOW MANY TIMES IT
     * IS GRADED (found by adversarial review, 2026-08-30, HIGH). This route
     * used to compute `xp` fresh from the CURRENT score on every call with no
     * memory of what this segment had already paid — so grading the same
     * 20-XP segment three times (a client retry after a timeout, a double-tap,
     * a trivial replay) paid 20 XP three times, not once. `row.xp_awarded`
     * (already on hand from `getTutorSegment`) is what this exact segment has
     * paid so far across every previous grade call; the raw score can never
     * earn more than what remains of the segment's OWN worth. This still lets
     * a genuine second attempt earn the DELTA when it improves on the first —
     * only a replay of an already-fully-paid segment is reduced to zero.
     */
    const baseXp = typeof segment.xp === 'number' ? segment.xp : 0;
    const rawXp = row.key_verified ? Math.round((score / 100) * baseXp) : 0;
    const requestedXp = Math.max(0, Math.min(rawXp, baseXp - row.xp_awarded));

    let xp = 0;
    if (requestedXp > 0) {
      /*
       * ATOMIC AGAINST THE DAILY CAP (found by adversarial review, 2026-08-30,
       * CRITICAL). The previous shape read "earned today" here, computed the
       * capped amount in JS, then wrote it with a separate, unconditional
       * PATCH — two concurrent grade requests for the same learner could both
       * read the same stale total and both spend the full remaining cap.
       * `awardTutorXp` does the read, the cap arithmetic and the write in one
       * Postgres function serialized on the learner (migration 0055), so the
       * amount it returns is what was ACTUALLY credited, never a value this
       * route computed against data that may already be stale by the time it
       * writes.
       */
      const awarded = await awardTutorXp({
        sessionId: session.id,
        userId: user.id,
        sinceIso: startOfLocalDayIso(normalizeLocale(session.locale)),
        cap: MAX_TUTOR_XP_PER_DAY,
        requested: requestedXp,
      });
      if (awarded === null) {
        // Refuse rather than assume zero was credited — indistinguishable
        // from a lost write otherwise (§1.14).
        return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not credit tutor XP');
      }
      xp = awarded;
    }

    const recorded = await recordSegmentResult({
      segmentId: row.id,
      score: bestScore,
      xpAwarded: row.xp_awarded + xp,
      attempts: attemptOrdinal,
    });
    if (!recorded) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not record the result');

    /*
     * THE V3 EVIDENCE JOIN. When the segment was served for a knowledge
     * component (provenance.kc_id, stamped at serve time), this grade is also
     * pedagogy: misconception diagnosis, BKT update, FSRS review — all on the
     * grade clock, never the voice turn. Best-effort AFTER the grade landed:
     * a pedagogy failure is logged loudly inside recordAttempt and costs
     * adaptation quality, never the learner's score or XP.
     *
     * NEVER FED A CRASH AS EVIDENCE (round 36, 2026-08-30, MEDIUM). A grader
     * that threw carries no information about the learner's understanding —
     * treating its forced `score: 0` as a genuine wrong answer would corrupt
     * BKT/misconception tracking with a false negative caused by our own bug.
     *
     * The signed `echo` rides back through the client into Oracle's
     * segment_graded frame — that signature is what stops a client from
     * fabricating pedagogy events (it could already fabricate its own score;
     * it must not be able to steer the strategy machine too).
     *
     * NEVER FED THE SAME REAL ANSWER TWICE (found by adversarial review,
     * 2026-08-30, HIGH). A spoken answer checked by voice
     * (`/internal/segments/:id/voice-check`) already ran `recordAttempt` for
     * this exact segment — real BKT/FSRS evidence for one real child
     * interaction — but voice-check never touches `score`/`xp_awarded`
     * above, so nothing stopped this route from independently running
     * `recordAttempt` a SECOND time for the identical answer when the same
     * segment was then also graded through the widget. Reproduced directly:
     * a correct spoken answer alone landed `pKnownAfter` at 0.664; the same
     * segment graded again right after pushed it to 0.954 from one real
     * interaction. `row.voice_checked_at` (migration 0060,
     * `markSegmentVoiceChecked`) is the marker voice-check sets the moment
     * its OWN evidence write actually succeeds — when it is already set,
     * this route still does everything else it owns (the score/XP/attempts
     * bookkeeping above already ran, unconditionally), it just does not
     * hand the SAME answer to the mastery model a second time. A segment
     * graded through the widget alone, with no prior voice-check, is
     * unaffected — `voice_checked_at` stays null and this records exactly as
     * it always has.
     */
    const provenance = row.provenance ?? {};
    const kcId = typeof provenance.kc_id === 'string' ? provenance.kc_id : null;
    let pedagogy: AttemptOutcome | null = null;
    if (kcId && getConfig().TUTOR_V3_BRAIN && !graderCrashed && row.voice_checked_at === null) {
      pedagogy = await recordAttempt({
        userId: user.id,
        sessionId: row.session_id,
        segmentId: row.id,
        kcId,
        segment: withKey,
        submission: parsed.data.answer,
        score,
        attemptNumber: attemptOrdinal,
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

  /**
   * Round 110 (2026-08-31, MEDIUM): `limit`/`offset` so a guardian who has
   * not opened this page in a while can still page back to an older,
   * non-flagged session rather than losing UI access to it once more than
   * one page has accumulated since their last visit. Same shape `listAudit`
   * (`admin.ts`) already uses.
   */
  const GuardianSessionsQuery = z
    .object({
      limit: z.coerce.number().int().min(1).max(100).default(30),
      offset: z.coerce.number().int().min(0).default(0),
    })
    .strict();

  router.get('/kids/:kidUserId/sessions', async (req, res) => {
    const kidUserId = z.string().uuid().safeParse(req.params.kidUserId);
    if (!kidUserId.success) return fail(res, 400, VALIDATION, 'Invalid user id');
    const query = GuardianSessionsQuery.safeParse(req.query);
    if (!query.success) return fail(res, 400, VALIDATION, 'limit must be 1-100 and offset must be >= 0');
    const user = authedUser(res);

    const guardian = await isVerifiedGuardian(user.id, kidUserId.data);
    if (guardian === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not verify guardianship');
    if (!guardian) return fail(res, 403, 'FORBIDDEN', 'Not your dependant');

    const [page, flags, placementFlags, guardianProfile] = await Promise.all([
      listTutorSessions(kidUserId.data, query.data),
      listSafetyFlags(kidUserId.data),
      listPlacementSafetyFlags(kidUserId.data),
      profileOf(user.accessToken, user.id),
    ]);
    if (page === null || flags === null || placementFlags === null) {
      return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not read the child’s tutor history');
    }

    /*
     * The "what is happening" narrative (/ORACLE.md §12, 2026-09-01) —
     * closes the §19.5 v3-tail item of the same name. Entirely
     * deterministic (sessionNarrative.ts's own header explains why a model
     * call is not needed): `kc_attempt` (migration 0052) already names
     * which Knowledge Component each graded attempt evidenced and whether
     * it was correct; `tutor_sessions.summary` (migration 0051) already
     * digests a topic and graded fraction for a session the v3 brain never
     * touched. No new table, no new field reaching a model, no new consent.
     *
     * Titles are resolved in the GUARDIAN's own profile locale, not the
     * child's session locale — a bilingual family should not have to read a
     * topic name in a language they did not choose. `profileOf` is the same
     * "caller's own row" accessor this file already uses for the learner
     * elsewhere (RLS: an access token reads only its own profile) — here the
     * caller is the guardian, so this reads the GUARDIAN's locale.
     */
    const narrativeLocale = normalizeLocale(guardianProfile?.locale);
    const sessionIds = page.sessions.map((s) => s.id);
    const attemptRows = (await getKcAttemptsForSessions(sessionIds)) ?? [];
    const kcIds = [...new Set(attemptRows.map((a) => a.kc_id))];
    const kcTitleRows = kcIds.length > 0 ? ((await getKcTitlesByIds(kcIds)) ?? []) : [];
    const titleById = new Map<string, string>();
    for (const row of kcTitleRows) {
      const title = pickTitle(row.title, narrativeLocale);
      if (title) titleById.set(row.id, title);
    }

    const attemptsBySession = new Map<
      string,
      { kcId: string; kcTitle: string; correct: boolean; createdAt: string }[]
    >();
    for (const row of attemptRows) {
      // `session_id` is nullable on the wire (ON DELETE SET NULL) though
      // every row this query can match has one, by construction of the
      // `in.(...)` filter; an unresolvable title names nothing worth
      // putting in a sentence, so both are skipped rather than guessed at.
      if (!row.session_id) continue;
      const title = titleById.get(row.kc_id);
      if (!title) continue;
      const list = attemptsBySession.get(row.session_id) ?? [];
      list.push({ kcId: row.kc_id, kcTitle: title, correct: row.correct, createdAt: row.created_at });
      attemptsBySession.set(row.session_id, list);
    }

    /*
     * The DIGEST fallback, re-localized (2026-09-01). ORACLE.md §12 recorded
     * this as a known limitation on the stated grounds that the digest's
     * topic "was baked in at close time rather than kept as a re-localizable
     * id" — that was simply wrong about our own schema: `SessionSummaryDigest`
     * carries `topicId` alongside the baked `topic` string (migration 0051,
     * tutorData.ts), and the offers screen has been rebuilding "continue"
     * openings from it all along. So the fallback tier can honour the
     * guardian's locale exactly like the attempt-backed tier above, for one
     * extra bounded read of the same catalog table, and only for the sessions
     * that actually NEED it.
     *
     * Scoped to sessions with no attempt evidence, on purpose: a session the
     * brain DID touch never reads `fallbackTopic`, so resolving its topic id
     * would be a round-trip whose result is discarded.
     */
    const fallbackTopicIds = [
      ...new Set(
        page.sessions
          .filter((s) => (attemptsBySession.get(s.id) ?? []).length === 0 && s.summary?.topicId)
          .map((s) => s.summary!.topicId!),
      ),
    ];
    const topicTitleById = await getTopicTitlesByIds(fallbackTopicIds);
    const localizedFallbackTopic = (s: { summary: SessionSummaryDigest | null }): string | null => {
      const baked = s.summary?.topic ?? null;
      const id = s.summary?.topicId;
      if (!id) return baked;
      const title = topicTitleById.get(id);
      // `?? baked`, never `?? null`: an id that resolves to nothing (deleted
      // topic, failed read) must degrade to the string we already have, not
      // erase a topic the parent could previously see.
      return (title ? pickTitle(title, narrativeLocale) : null) ?? baked;
    };

    const narrativeById = new Map<string, SessionNarrative | null>(
      page.sessions.map((s) => [
        s.id,
        buildSessionNarrative({
          attempts: attemptsBySession.get(s.id) ?? [],
          fallbackTopic: localizedFallbackTopic(s),
          gradedCorrect: s.summary?.gradedCorrect ?? null,
          gradedTotal: s.summary?.gradedTotal ?? null,
        }),
      ]),
    );

    return ok(res, {
      sessions: page.sessions.map((s) => ({
        ...summarizeSession(s),
        narrative: narrativeById.get(s.id) ?? null,
      })),
      hasMore: page.hasMore,
      // Guardian-visible on purpose: a child disclosing distress to a tutor is
      // precisely the case where a parent must find out.
      safetyFlags: flags,
      /*
       * A SECOND, separate provenance (migration 0065, /ORACLE.md §4.1b): a
       * flag raised while the learner was choosing a course, before any
       * `tutor_sessions` row existed for `safetyFlags` above to reference.
       * Kept as its own field rather than merged into `safetyFlags` — the
       * two row shapes genuinely differ (no `session_id`/`turn_seq` to open
       * a transcript with, a `course_id` instead) and a caller that already
       * assumes every `safetyFlags` row has a session would silently break
       * on one that does not. `KidTutorPage` renders it (2026-09-01) inside
       * the SAME severity-first sort as `safetyFlags` above, while keeping
       * these two arrays separate here: only the guardian's reading ORDER is
       * shared, never the row shape.
       */
      placementSafetyFlags: placementFlags,
    });
  });

  // ── The parental approval gate (/ORACLE.md §20, migration 0068) ───────────

  /*
   * THE ITEM /ORACLE.md MARKED **BLOCKING BEFORE FAMILY ROLLOUT**, closed
   * here. What the tutor believes about a child — the LEARNER memory store —
   * no longer writes itself for a `kid`. Every proposal parks, and this pair
   * of routes is the portal that empties the queue.
   *
   * Both are gated by the SAME `isVerifiedGuardian` check every other family
   * route on this router uses: not a parent-in-general, not the child, not an
   * admin acting on their behalf. RLS says the same thing independently
   * (migration 0068's SELECT policy), so a mistake here is caught by the
   * database rather than by this line being the only thing standing between a
   * stranger and a note about someone's child.
   *
   * OD-18 (24 September 2026, C.4) extended the queue without touching this
   * pair: an independent screened teen's parked notes are decided by the teen
   * themself through `GET /memory-proposals` and the SAME decision route
   * below, whose authorization is resolved per note-owner (see
   * `classifyMemoryReview`).
   */

  /*
   * One queue shape for both reviewers (the guardian portal and the teen's
   * own queue). Each proposal names its store; `current` is BOTH notes as
   * they stand TODAY, which is not always what any single proposal expected:
   * two overlapping sessions can each park a note computed from the same
   * earlier text, and approving the first moves the store out from under the
   * second. Sending it lets the portal show a stale note as stale BEFORE the
   * reviewer taps approve, instead of only afterwards through a CONFLICT.
   */
  const memoryQueueBody = (
    proposals: LearnerMemoryProposalRow[],
    current: { learner: string | null; pedagogy: string | null },
  ) => ({
    proposals: proposals.map((p) => ({
      id: p.id,
      store: p.store === 'pedagogy' ? ('pedagogy' as const) : ('learner' as const),
      proposed: p.proposed,
      // What the note REPLACES, so the reviewer decides on a change rather
      // than on a paragraph with no context. Null means there is no note yet.
      expectedBefore: p.expected_before,
      sessionId: p.session_id,
      createdAt: p.created_at,
    })),
    current: { learner: current.learner, pedagogy: current.pedagogy },
  });

  router.get('/kids/:kidUserId/memory-proposals', async (req, res) => {
    const kidUserId = z.string().uuid().safeParse(req.params.kidUserId);
    if (!kidUserId.success) return fail(res, 400, VALIDATION, 'Invalid user id');
    const user = authedUser(res);

    const guardian = await isVerifiedGuardian(user.id, kidUserId.data);
    if (guardian === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not verify guardianship');
    if (!guardian) return fail(res, 403, 'FORBIDDEN', 'Not your dependant');

    const [proposals, current] = await Promise.all([
      listPendingLearnerMemoryProposals(kidUserId.data),
      getLearnerMemory(kidUserId.data),
    ]);
    // A read failure is a 502, never an empty queue rendered as "nothing to
    // review" — those are the same screen with opposite meanings (§1.14).
    if (proposals === null || current === null) {
      return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not read the pending notes');
    }

    return ok(res, memoryQueueBody(proposals, current));
  });

  /*
   * OD-18 (24 September 2026, C.4): an independent screened teen is the
   * reviewer of their OWN parked notes. This is that queue — the same rows,
   * the same response shape as the guardian portal above, with the CALLER
   * as the subject. Only an account classified as a self-reviewing teen
   * gets past the gate: a kid's queue belongs to their guardian, an adult
   * has no parked notes by construction, and an ineligible account is told
   * so rather than shown an empty queue.
   */
  router.get('/memory-proposals', async (req, res) => {
    const user = authedUser(res);

    const review = await classifyMemoryReview(user.id);
    if (review === null) {
      return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not resolve memory review eligibility');
    }
    if (review !== 'self-review') {
      return fail(res, 403, 'FORBIDDEN', 'Your memory notes are not self-reviewed');
    }

    const [proposals, current] = await Promise.all([
      listPendingLearnerMemoryProposals(user.id),
      getLearnerMemory(user.id),
    ]);
    // A read failure is a 502, never an empty queue rendered as "nothing to
    // review" — those are the same screen with opposite meanings (§1.14).
    if (proposals === null || current === null) {
      return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not read the pending notes');
    }

    return ok(res, memoryQueueBody(proposals, current));
  });

  const DecisionBody = z.object({ verdict: z.enum(['approved', 'rejected']) }).strict();

  router.post('/memory-proposals/:proposalId/decision', async (req, res) => {
    const proposalId = z.string().uuid().safeParse(req.params.proposalId);
    if (!proposalId.success) return fail(res, 400, VALIDATION, 'Invalid proposal id');
    const parsed = DecisionBody.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, VALIDATION, 'verdict must be approved or rejected');
    const user = authedUser(res);

    /*
     * Read first, to learn WHOSE note this is — the authorization check needs
     * a subject to check against, and the proposal id alone does not name
     * one. `undefined` (no such row) and `null` (the read failed) are kept
     * apart on purpose: answering 404 to an outage tells a parent their
     * child's note does not exist.
     */
    const proposal = await getLearnerMemoryProposal(proposalId.data);
    if (proposal === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not read the note');
    if (proposal === undefined) return fail(res, 404, NOT_FOUND, 'No such note');

    /*
     * OD-18 (24 September 2026, C.4): WHO may decide is re-resolved from the
     * NOTE'S OWNER, not from the caller's claim about themselves. A
     * guardian-reviewed note keeps the existing `isVerifiedGuardian` check
     * (unchanged); a self-reviewed note admits exactly one caller — the
     * owner themself; a hold or an adult (whose notes never park) has no
     * eligible reviewer and is refused. A failed classification read is 502,
     * never 403 — "we could not check" must not read as "you are not
     * allowed" (§1.14).
     */
    const review = await classifyMemoryReview(proposal.user_id);
    if (review === null) {
      return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not resolve memory review eligibility');
    }

    let actor: string;
    if (review === 'guardian-review') {
      const guardian = await isVerifiedGuardian(user.id, proposal.user_id);
      if (guardian === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not verify guardianship');
      if (!guardian) return fail(res, 403, 'FORBIDDEN', 'Not your dependant');
      actor = 'guardian-approved-review';
    } else if (review === 'self-review') {
      // Subject-scoped: a self-reviewing teen decides their OWN notes and
      // nobody else's — not another teen's, not a sibling's, not a linked
      // child's (those are guardian-reviewed above).
      if (user.id !== proposal.user_id) return fail(res, 403, 'FORBIDDEN', 'This is not your note');
      actor = 'learner-self-approved-review';
    } else {
      // 'hold' or 'adult-direct': no reviewer exists for a parked row here.
      return fail(res, 403, 'FORBIDDEN', 'No reviewer is eligible for this note');
    }

    /*
     * The claim and the apply are ONE transaction inside the function
     * (migration 0068), which is what makes "a verdict lands only on a
     * still-pending row" true under two reviewers deciding at once rather
     * than merely true in the common case — the same rule
     * `setTutorReviewStatus` already enforces with a `review_status=eq.pending`
     * filter, moved into the database because here a decision also triggers a
     * write. The check above is NOT that guard: it reads the row, and
     * anything read outside the transaction can be stale by the time it is
     * acted on.
     */
    const outcome = await decideLearnerMemoryProposal({
      proposalId: proposalId.data,
      decidedBy: user.id,
      verdict: parsed.data.verdict,
      actor,
    });
    if (outcome === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not record the decision');

    /*
     * Every outcome is reported as itself. Collapsing them into a boolean is
     * what would make "somebody already decided this" and "the note is out of
     * date so nothing was applied" look like success to a parent who then
     * never looks again.
     *
     * `conflict` deliberately keeps the row PENDING (the function does not
     * close it), so this is a 409 rather than a 200 with a sad field: the
     * request did not accomplish what it asked for and the queue still holds
     * the item.
     */
    if (outcome === 'not_pending') {
      return fail(res, 409, 'ALREADY_DECIDED', 'This note was already decided');
    }
    if (outcome === 'conflict') {
      return fail(res, 409, 'NOTE_OUT_OF_DATE', 'A newer note has already been approved for this child');
    }
    // The decision is per note, and each note names its store (learner or
    // pedagogy): the approval applied to exactly that store (0068 function,
    // redefined by memory_proposal_store).
    return ok(res, {
      outcome,
      applied: outcome === 'written' || outcome === 'unchanged',
      store: proposal.store === 'pedagogy' ? 'pedagogy' : 'learner',
    });
  });

  // ── Class V artifacts: plan & notebook (migration 0069, TUTOR_INSTRUMENTS.md §3.6) ──

  router.get('/plan', async (req, res) => {
    const user = authedUser(res);
    const plan = await getTutorPlan(user.id);
    return ok(res, { plan: summarizePlan(plan) });
  });

  router.get('/kids/:kidUserId/plan', async (req, res) => {
    const kidUserId = z.string().uuid().safeParse(req.params.kidUserId);
    if (!kidUserId.success) return fail(res, 400, VALIDATION, 'Invalid user id');
    const user = authedUser(res);

    const guardian = await isVerifiedGuardian(user.id, kidUserId.data);
    if (guardian === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not verify guardianship');
    if (!guardian) return fail(res, 403, 'FORBIDDEN', 'Not your dependant');

    const plan = await getTutorPlan(kidUserId.data);
    return ok(res, { plan: summarizePlan(plan) });
  });

  router.get('/notebook', async (req, res) => {
    const user = authedUser(res);
    const entries = await listNotebookEntries(user.id);
    if (entries === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not read the notebook');
    return ok(res, { entries: entries.map(summarizeNotebookEntry) });
  });

  router.get('/kids/:kidUserId/notebook', async (req, res) => {
    const kidUserId = z.string().uuid().safeParse(req.params.kidUserId);
    if (!kidUserId.success) return fail(res, 400, VALIDATION, 'Invalid user id');
    const user = authedUser(res);

    const guardian = await isVerifiedGuardian(user.id, kidUserId.data);
    if (guardian === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not verify guardianship');
    if (!guardian) return fail(res, 403, 'FORBIDDEN', 'Not your dependant');

    const entries = await listNotebookEntries(kidUserId.data);
    if (entries === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not read the notebook');
    return ok(res, { entries: entries.map(summarizeNotebookEntry) });
  });

  const KeepBoardBody = z.object({ sessionId: z.string().uuid(), turnSeq: z.number().int().nonnegative() }).strict();

  /*
   * The learner's own "keep this" tap. Validated against the REAL turn,
   * never trusted from the client: a POST naming someone else's session, or
   * a turn that never drew a board, is refused rather than silently keeping
   * nothing or another family's content.
   */
  router.post('/notebook', async (req, res) => {
    const parsed = KeepBoardBody.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, VALIDATION, parsed.error.issues[0]?.message ?? 'Invalid request');
    const user = authedUser(res);

    const session = await getTutorSession(parsed.data.sessionId);
    if (session === null) return fail(res, 404, NOT_FOUND, 'No such session');
    if (session.user_id !== user.id) return fail(res, 403, 'FORBIDDEN', 'This is not your session');

    const turns = await listTutorTurns(session.id);
    if (turns === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not read the transcript');
    const turn = turns.find((t) => t.seq === parsed.data.turnSeq);
    if (!turn || !turn.whiteboard) return fail(res, 404, NOT_FOUND, 'That turn drew no board to keep');

    const kept = await insertNotebookEntry({
      userId: user.id,
      whiteboard: turn.whiteboard,
      sessionId: session.id,
      turnSeq: turn.seq,
    });
    if (!kept) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not keep that board');
    return ok(res, { kept: true });
  });

  return router;
}

function summarizePlan(plan: { content: unknown; session_id: string | null; updated_at: string } | null) {
  if (plan === null) return null;
  return { content: plan.content, sessionId: plan.session_id, updatedAt: plan.updated_at };
}

function summarizeNotebookEntry(entry: {
  id: string;
  whiteboard: unknown;
  session_id: string | null;
  turn_seq: number | null;
  kept_at: string;
}) {
  return { id: entry.id, whiteboard: entry.whiteboard, sessionId: entry.session_id, turnSeq: entry.turn_seq, keptAt: entry.kept_at };
}

/**
 * Locale -> es-MX (authoring locale) -> whatever's there — the same
 * fallback order `resolveCourseContext`'s own `pick` already established
 * above for localized catalog JSONB, kept as a separate small function
 * rather than shared: the two operate on different (structurally similar
 * but independently typed) row shapes, and this is the only other call site.
 */
function pickTitle(title: Localized, locale: 'en-US' | 'es-MX' | 'pt-BR'): string | null {
  return title[locale] ?? title['es-MX'] ?? Object.values(title)[0] ?? null;
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
