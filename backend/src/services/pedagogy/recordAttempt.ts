/*
 * recordAttempt — the one place tutor evidence becomes persisted pedagogy.
 *
 * Called from the grade route AFTER the existing grader/XP logic, and from
 * voice-check. It never decides the score — the grader already did — it turns
 * that verdict into: a misconception diagnosis (deterministic), a BKT update,
 * an FSRS review, and a kc_attempt evidence row.
 *
 * FAILURE POSTURE (§1.14): this is a read-modify-write on a learner's
 * posterior. Any upstream read failure aborts the WHOLE pedagogy step with a
 * loud log and a null return — the grade itself still succeeds. Updating from
 * a default would silently reset mastery to the prior.
 */

import crypto from 'crypto';
import { getConfig } from '../../config.js';
import type { SegmentBase } from '../../lesson-contract/core/types.js';
import { bktUpdate } from './bkt.js';
import { checkAttempt, type CheckedAttempt, type MisconceptionDef } from './checkAnswer.js';
import { newCard, ratingFromScore, reviewCardTwoTier, type MemoryCard } from './fsrs.js';
import {
  getLearnerMastery,
  getMemoryCards,
  getMisconceptionsForKcs,
  insertKcAttempt,
  paramsOf,
  recordLearnerMisconception,
  resolveLearnerMisconception,
  upsertLearnerMastery,
  upsertMemoryCard,
  type KcRow,
  type MemoryCardRow,
} from './kcData.js';
import { serviceRest } from '../supabaseRest.js';

const PASS = 70;

/** Payload fields harvested as misconception-pattern operands, with aliases. */
const OPERAND_ALIASES: Record<string, string> = {
  price: 'a',
  cost: 'a',
  paid: 'b',
  paid_with: 'b',
  revenue: 'a',
  costs: 'b',
  target: 'target',
  goal: 'goal',
  rate: 'rate',
  count: 'count',
  percent: 'p',
  a: 'a',
  b: 'b',
};

export function operandsFromSegment(segment: SegmentBase): Record<string, number> {
  const out: Record<string, number> = {};
  const payload = segment.payload as Record<string, unknown>;
  for (const [field, alias] of Object.entries(OPERAND_ALIASES)) {
    const v = payload[field];
    if (typeof v === 'number' && Number.isFinite(v) && out[alias] === undefined) out[alias] = v;
  }
  return out;
}

function numericSubmission(submission: unknown): number | null {
  if (typeof submission === 'number' && Number.isFinite(submission)) return submission;
  if (typeof submission === 'object' && submission !== null) {
    const record = submission as Record<string, unknown>;
    const v = record.value;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    // Tray submissions: the number the learner "answered" is the tray sum.
    if (Array.isArray(record.picked) && record.picked.every((p) => typeof p === 'number')) {
      return (record.picked as number[]).reduce((acc, p) => acc + p, 0);
    }
  }
  return null;
}

function numericExpected(segment: SegmentBase): number | null {
  const key = segment.answer as Record<string, unknown> | undefined;
  const v = key?.value ?? key?.target;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  // Self-contained tray types: the expected value lives in the payload.
  const payload = segment.payload as Record<string, unknown>;
  if (typeof payload.target === 'number') return payload.target;
  if (typeof payload.price === 'number' && typeof payload.paid_with === 'number') {
    return payload.paid_with - payload.price;
  }
  return null;
}

/** Tags the authored item attached to the chosen option, when recoverable. */
function chosenOptionTags(segment: SegmentBase, submission: unknown): string[] {
  if (typeof submission !== 'object' || submission === null) return [];
  const sub = submission as Record<string, unknown>;
  const index = [sub.choice, sub.selected, sub.index].find(
    (v): v is number => typeof v === 'number' && Number.isInteger(v),
  );
  if (index === undefined) return [];
  const options = (segment.payload as Record<string, unknown>).options;
  if (!Array.isArray(options)) return [];
  const chosen = options[index];
  if (typeof chosen !== 'object' || chosen === null) return [];
  const tags = (chosen as Record<string, unknown>).misconception_tags;
  return Array.isArray(tags) ? tags.filter((t): t is string => typeof t === 'string') : [];
}

export interface AttemptInput {
  userId: string;
  sessionId: string | null;
  segmentId: string | null;
  kcId: string;
  segment: SegmentBase;
  submission: unknown;
  score: number;
  attemptNumber: number;
  source: 'segment_grade' | 'voice_check';
  strategy: string | null;
}

export interface AttemptOutcome {
  kcId: string;
  correct: boolean;
  pKnownBefore: number;
  pKnownAfter: number;
  misconceptionCode: string | null;
  reviewDueAt: string;
  /** HMAC the client relays to Oracle inside segment_graded. */
  echo: string;
}

interface KcOnlyRow {
  id: string;
  key: string;
  strand: 'money_math' | 'entrepreneurship';
  title: Record<string, string>;
  objective: Record<string, string>;
  tier_min: number;
  p_l0: number;
  p_t: number;
  p_g: number;
  p_s: number;
  skill_key: string | null;
}

async function getKcById(kcId: string): Promise<KcRow | null> {
  const rows = await serviceRest<KcOnlyRow[]>(
    `/kc?id=eq.${encodeURIComponent(kcId)}&select=id,key,strand,title,objective,tier_min,p_l0,p_t,p_g,p_s,skill_key&limit=1`,
  );
  const row = rows?.[0];
  if (!row) return null;
  return { ...row, p_l0: Number(row.p_l0), p_t: Number(row.p_t), p_g: Number(row.p_g), p_s: Number(row.p_s) };
}

function cardFromRow(row: MemoryCardRow | undefined, now: Date): MemoryCard {
  if (!row) return newCard(now);
  return {
    state: row.state,
    stability: row.stability,
    difficulty: row.difficulty,
    reps: row.reps,
    lapses: row.lapses,
    dueAt: new Date(row.due_at),
    lastReviewAt: row.last_review_at ? new Date(row.last_review_at) : null,
  };
}

export async function recordAttempt(input: AttemptInput, now = new Date()): Promise<AttemptOutcome | null> {
  const kc = await getKcById(input.kcId);
  if (!kc) {
    console.error(`[pedagogy] recordAttempt: unknown kc ${input.kcId} — evidence dropped`);
    return null;
  }

  const [masteryRows, cardRows, misconceptions] = await Promise.all([
    getLearnerMastery(input.userId),
    getMemoryCards(input.userId),
    getMisconceptionsForKcs([kc.id]),
  ]);
  if (masteryRows === null || cardRows === null || misconceptions === null) {
    console.error('[pedagogy] recordAttempt: upstream read failed — evidence NOT recorded (never from defaults)');
    return null;
  }

  const correct = input.score >= PASS;

  // Deterministic diagnosis — only meaningful on a wrong answer, and only
  // when the numbers are recoverable. The grader's verdict stays authoritative.
  const catalog: MisconceptionDef[] = misconceptions.map((m) => ({
    id: m.id,
    code: m.code,
    distractorPatterns: m.distractor_patterns ?? {},
  }));
  let misconceptionId: string | null = null;
  let misconceptionCode: string | null = null;
  if (!correct && catalog.length > 0) {
    let attempt: CheckedAttempt | null = null;
    const submitted = numericSubmission(input.submission);
    const expected = numericExpected(input.segment);
    if (submitted !== null && expected !== null) {
      attempt = {
        kind: 'numeric',
        submitted,
        expected,
        operands: { ...operandsFromSegment(input.segment), target: expected },
      };
    } else {
      const tags = chosenOptionTags(input.segment, input.submission);
      if (tags.length > 0) attempt = { kind: 'option', correct: false, chosenTags: tags };
    }
    if (attempt) {
      const result = checkAttempt(attempt, catalog);
      misconceptionId = result.misconceptionId;
      misconceptionCode = result.misconceptionCode;
    }
  }

  const masteryRow = masteryRows.find((r) => r.kc_id === kc.id);
  const params = paramsOf(kc, masteryRow?.params_override ?? null);
  const pBefore = masteryRow?.p_known ?? kc.p_l0;
  const pAfter = bktUpdate(pBefore, correct, params);

  /*
   * C.11: the cross-session scheduler counts SPACED reviews only. An attempt
   * inside the short horizon of the card's last counted review is a
   * within-session re-exposure: the card is left as it is (see
   * `reviewCardTwoTier`), and the attempt row records which tier it was.
   */
  const { card, tier: reviewTier } = reviewCardTwoTier(
    cardFromRow(cardRows.find((r) => r.kc_id === kc.id), now),
    ratingFromScore(input.score, input.attemptNumber),
    now,
    getConfig().TUTOR_REVIEW_SHORT_HORIZON_MIN * 60_000,
  );

  const [masteryOk, cardOk] = await Promise.all([
    upsertLearnerMastery(input.userId, kc.id, {
      p_known: round5(pAfter),
      attempts: (masteryRow?.attempts ?? 0) + 1,
      correct: (masteryRow?.correct ?? 0) + (correct ? 1 : 0),
      last_attempt_at: now.toISOString(),
    }),
    // A short-horizon re-exposure leaves the card untouched: nothing to write.
    reviewTier === 'short_horizon'
      ? Promise.resolve(true)
      : upsertMemoryCard(input.userId, kc.id, {
          kc_id: kc.id,
          state: card.state,
          stability: round3(card.stability),
          difficulty: round3(card.difficulty),
          reps: card.reps,
          lapses: card.lapses,
          due_at: card.dueAt.toISOString(),
          last_review_at: now.toISOString(),
        }),
  ]);
  if (!masteryOk || !cardOk) {
    console.error('[pedagogy] recordAttempt: persist failed — posterior may be stale');
  }

  if (misconceptionId) {
    await recordLearnerMisconception(input.userId, misconceptionId);
  } else if (correct && catalog.length > 0) {
    // Clean correct evidence on this KC quiets its recorded misconceptions.
    await Promise.all(catalog.map((m) => resolveLearnerMisconception(input.userId, m.id)));
  }

  const attemptRow = {
    user_id: input.userId,
    kc_id: kc.id,
    session_id: input.sessionId,
    segment_id: input.segmentId,
    source: input.source,
    correct,
    score: Math.round(input.score),
    strategy: input.strategy,
    misconception_id: misconceptionId,
    p_known_before: round5(pBefore),
    p_known_after: round5(pAfter),
  };
  /*
   * C.11: the attempt row carries its review tier. On a schema without the
   * column (Core deployed before `*_mentor_spaced_review_and_dialogue_calibration.sql`)
   * PostgREST refuses the unknown field, so the row is written once more
   * without it: the evidence log must never be lost to a deploy order.
   */
  if (!(await insertKcAttempt({ ...attemptRow, review_tier: reviewTier }))) {
    const landed = await insertKcAttempt(attemptRow);
    if (landed) console.warn('[pedagogy] kc_attempt.review_tier not accepted — apply the C.11 migration');
  }

  return {
    kcId: kc.id,
    correct,
    pKnownBefore: round5(pBefore),
    pKnownAfter: round5(pAfter),
    misconceptionCode,
    reviewDueAt: card.dueAt.toISOString(),
    echo: signGradeEcho({
      segmentId: input.segmentId ?? 'voice',
      kcId: kc.id,
      correct,
      misconceptionCode,
      exp: Math.floor(now.getTime() / 1000) + GRADE_ECHO_TTL_SECONDS,
    }),
  };
}

const round3 = (v: number): number => Math.round(v * 1000) / 1000;
const round5 = (v: number): number => Math.round(v * 100_000) / 100_000;

/*
 * The grade echo — how Oracle learns a grade actually happened.
 *
 * The client relays this inside its `segment_graded` frame, and Oracle
 * verifies the signature before feeding the pedagogy event to its controller.
 * Without it, a client could fabricate correctness and steer the strategy
 * machine. Signed with TUTOR_SESSION_SECRET, which Core and Oracle already
 * share for the socket token — one shared secret, two closed formats, both
 * pinned by parity tests.
 */
export const GRADE_ECHO_TTL_SECONDS = 15 * 60;
const ECHO_PREFIX = 'ge1';

export interface GradeEchoPayload {
  segmentId: string;
  kcId: string;
  correct: boolean;
  misconceptionCode: string | null;
  exp: number;
}

export function signGradeEcho(payload: GradeEchoPayload): string {
  const body = `${ECHO_PREFIX}.${Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')}`;
  const sig = crypto
    .createHmac('sha256', getConfig().TUTOR_SESSION_SECRET)
    .update(body)
    .digest('base64url');
  return `${body}.${sig}`;
}
