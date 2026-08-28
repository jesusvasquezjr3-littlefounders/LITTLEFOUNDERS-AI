import { GRADERS, KEYLESS_GRADERS } from '../lesson-contract/registry.js';
import type { SegmentBase } from '../lesson-contract/core/types.js';
import { getLessonDocumentLocales, serviceRest } from './supabaseRest.js';
import { pickLessonLocale, stripAnswers } from './lessonDocument.js';
import { findPublishedPack } from './tutorData.js';

/*
 * The three-tier content ladder (/ORACLE.md §7).
 *
 *   tier 1  catalog  — a segment from a PUBLISHED lesson. Free, instant, and a
 *                      human approved it. This should carry most turns.
 *   tier 2  bank     — a pre-generated pack, generated offline by Forge and
 *                      PUBLISHED BY A HUMAN. Personalization happens at
 *                      selection time, not at generation time.
 *   tier 3  live     — generated in the moment. Oracle authors and judges it;
 *                      THIS FILE verifies it before a learner sees it, because
 *                      verification means re-running the real graders and the
 *                      real graders live on this side of the boundary.
 *
 * WHY VERIFICATION IS HERE AND GENERATION IS NOT. Oracle holds the model, the
 * prompt discipline and the judge. Core holds the grading registry, the answer
 * keys and the database. Splitting them that way means the service that
 * INVENTED a segment is never the service that certifies it — the same
 * author/judge separation Forge already uses, applied one level up.
 */

export const LIVE_TYPE_ALLOWLIST = new Set<string>([
  // Graded, and every one of them re-executable from its own key.
  'quiz_mcq',
  'true_false',
  'number_input',
  'order_steps',
  'sort_buckets',
  'match_pairs',
  'fill_blank',
  // Money manipulatives (Tutor v3): self-contained payloads — the grader
  // checks the tray sum against the payload's own numbers, so re-execution
  // is composing an exact tray (submissionFromKey), pure arithmetic.
  'coin_count',
  'make_change',
  // Ungraded story types: safe to generate because there is no key to get wrong.
  'story_dialogue',
  'key_ideas',
  'concept_reveal',
]);

export interface LadderCandidate {
  origin: 'catalog' | 'bank' | 'live';
  lessonId: string | null;
  segment: SegmentBase;
  answer: Record<string, unknown> | null;
  provenance: Record<string, unknown>;
}

// ── Skill resolution ────────────────────────────────────────────────────────

interface CourseRow {
  id: string;
  slug: string;
}
interface TopicRow {
  id: string;
  slug: string;
  saga_id: string;
  status: string;
}

export interface ResolvedSkill {
  courseId: string;
  courseSlug: string;
  topicId: string;
  topicSlug: string;
}

/**
 * `skill_key` is `lower(course_slug || '/' || topic_slug)` — migration 0036
 * defines it and Data Intel derives every recommendation from it. Resolving it
 * back to real ids is what lets the tutor's "practise this skill" become "here
 * is an actual published exercise about it".
 */
export async function resolveSkill(skillKey: string): Promise<ResolvedSkill | null> {
  const slash = skillKey.indexOf('/');
  if (slash <= 0) return null;
  const courseSlug = skillKey.slice(0, slash);
  const topicSlug = skillKey.slice(slash + 1);
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(courseSlug) || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(topicSlug)) {
    return null;
  }

  const courses = await serviceRest<CourseRow[]>(
    `/courses?slug=eq.${encodeURIComponent(courseSlug)}&status=eq.published&select=id,slug&limit=1`,
  );
  const course = courses?.[0];
  if (!course) return null;

  // topics -> sagas -> adventures -> courses. PostgREST embeds the chain, so
  // this is one round trip rather than three.
  const topics = await serviceRest<TopicRow[]>(
    `/topics?slug=eq.${encodeURIComponent(topicSlug)}&status=eq.published&select=id,slug,saga_id,status,sagas!inner(adventures!inner(course_id))&sagas.adventures.course_id=eq.${encodeURIComponent(course.id)}&limit=1`,
  );
  const topic = topics?.[0];
  if (!topic) return null;

  return { courseId: course.id, courseSlug, topicId: topic.id, topicSlug };
}

// ── Tier 1: the published catalog ───────────────────────────────────────────

interface LessonRow {
  id: string;
  topic_id: string;
  position: number;
  status: string;
}

/**
 * Picks a graded segment from a published lesson on this skill's topic.
 *
 * Selection is by DIFFICULTY DISTANCE, then by an id-seeded rotation. The
 * rotation matters: without it the tutor serves the same first segment of the
 * same first lesson to every learner on every visit, which reads as a broken
 * feature long before anyone works out that the ladder is doing exactly what
 * it was told.
 */
export async function serveFromCatalog(input: {
  skill: ResolvedSkill;
  locale: string;
  difficulty: number;
  excludeSegmentIds: readonly string[];
  rotationSeed: number;
}): Promise<LadderCandidate | null> {
  const lessons = await serviceRest<LessonRow[]>(
    `/lessons?topic_id=eq.${encodeURIComponent(input.skill.topicId)}&status=eq.published&select=id,topic_id,position,status&order=position.asc`,
  );
  if (!lessons || lessons.length === 0) return null;

  // Start at a rotated offset so repeated sessions do not all open on lesson 1.
  const start = lessons.length > 0 ? input.rotationSeed % lessons.length : 0;
  const ordered = [...lessons.slice(start), ...lessons.slice(0, start)];

  for (const lesson of ordered) {
    const rows = await getLessonDocumentLocales(lesson.id);
    if (!rows || rows.length === 0) continue;
    const picked = pickLessonLocale(rows, input.locale);
    if (!picked) continue;

    const document = picked.document as { segments?: unknown };
    if (!Array.isArray(document.segments)) continue;

    const candidates = (document.segments as SegmentBase[])
      .filter((segment) => typeof segment?.id === 'string' && typeof segment?.type === 'string')
      .filter((segment) => GRADERS[segment.type] !== undefined)
      .filter((segment) => !input.excludeSegmentIds.includes(segment.id));
    if (candidates.length === 0) continue;

    candidates.sort(
      (a, b) => Math.abs((a.difficulty ?? 3) - input.difficulty) - Math.abs((b.difficulty ?? 3) - input.difficulty),
    );
    const chosen = candidates[0];
    if (!chosen) continue;

    const keys = picked.answer_keys as Record<string, Record<string, unknown>> | null;
    const answer = keys?.[chosen.id] ?? (chosen as { answer?: Record<string, unknown> }).answer ?? null;

    return {
      origin: 'catalog',
      lessonId: lesson.id,
      segment: chosen,
      answer,
      provenance: {
        tier: 1,
        lesson_id: lesson.id,
        locale: picked.locale,
        skill_key: `${input.skill.courseSlug}/${input.skill.topicSlug}`,
      },
    };
  }

  return null;
}

// ── Tier 2: the human-published bank ────────────────────────────────────────

interface PackShape {
  segments?: unknown;
  answers?: Record<string, Record<string, unknown>>;
}

export async function serveFromBank(input: {
  skillKey: string;
  tier: number;
  locale: string;
  difficulty: number;
  excludeSegmentIds: readonly string[];
}): Promise<LadderCandidate | null> {
  const pack = await findPublishedPack(input.skillKey, input.tier, input.locale);
  if (!pack) return null;

  const shape = pack.pack as PackShape;
  if (!Array.isArray(shape.segments)) return null;

  const candidates = (shape.segments as SegmentBase[])
    .filter((segment) => typeof segment?.id === 'string' && typeof segment?.type === 'string')
    .filter((segment) => !input.excludeSegmentIds.includes(segment.id));
  if (candidates.length === 0) return null;

  candidates.sort(
    (a, b) => Math.abs((a.difficulty ?? 3) - input.difficulty) - Math.abs((b.difficulty ?? 3) - input.difficulty),
  );
  const chosen = candidates[0];
  if (!chosen) return null;

  return {
    origin: 'bank',
    lessonId: null,
    segment: chosen,
    answer: shape.answers?.[chosen.id] ?? (chosen as { answer?: Record<string, unknown> }).answer ?? null,
    provenance: { tier: 2, pack_id: pack.id, skill_key: input.skillKey, locale: pack.locale },
  };
}

// ── Tier 3: verifying what was generated ────────────────────────────────────

export interface VerificationResult {
  ok: boolean;
  /** Whether the key survived re-execution — the gate on XP (/ORACLE.md §8). */
  keyVerified: boolean;
  failures: string[];
}

/** Tier vocabulary bands, mirroring the Piaget gate Forge already applies. */
const FORBIDDEN_BY_TIER: Record<number, RegExp[]> = {
  1: [/\d+\s*%/, /\bpercent(age)?\b/i, /\bporcentaje\b/i, /\bporcentagem\b/i, /\d+\.\d{2,}/],
  2: [/\bcompound\s+interest\b/i, /\binterés\s+compuesto\b/i, /\bjuros\s+compostos\b/i],
  3: [],
};

/**
 * Everything that must hold before a generated segment is shown to a learner.
 *
 * The three groups are different KINDS of check and it is worth keeping them
 * distinct in your head:
 *
 *  - SHAPE: is it a segment at all, of a type we allow to be generated.
 *  - CONTENT: the deterministic gates — unique ids, exactly one correct
 *    option, a teaching rationale on every wrong option, tier vocabulary.
 *  - KEY RE-EXECUTION: run the REAL grader. The declared answer must score
 *    100, and every distractor must score less. This is the check that makes
 *    XP payable, and it is the one a model cannot talk its way past, because
 *    it is not asking a model anything.
 */
export function verifyGeneratedSegment(segment: SegmentBase, tier: number): VerificationResult {
  const failures: string[] = [];

  // ── shape ──
  if (typeof segment?.id !== 'string' || segment.id.length === 0) failures.push('missing id');
  if (typeof segment?.type !== 'string' || !LIVE_TYPE_ALLOWLIST.has(segment.type)) {
    failures.push(`type "${String(segment?.type)}" is not on the live-generation allowlist`);
    // No point running content checks against a type we do not understand.
    return { ok: false, keyVerified: false, failures };
  }
  if (typeof segment.prompt_md !== 'string' || segment.prompt_md.trim() === '') {
    failures.push('empty prompt_md');
  }
  if (typeof segment.difficulty !== 'number' || segment.difficulty < 1 || segment.difficulty > 5) {
    failures.push('difficulty out of range');
  }

  // ── content ──
  const options = extractOptions(segment);
  if (options.length > 0) {
    const ids = options.map((o) => o.id);
    if (new Set(ids).size !== ids.length) failures.push('duplicate option ids');

    const correctId = (segment.answer as { correct_option_id?: unknown } | undefined)?.correct_option_id;
    if (typeof correctId === 'string') {
      const correctCount = options.filter((o) => o.id === correctId).length;
      if (correctCount !== 1) failures.push('the key names an option that does not exist exactly once');
      for (const option of options) {
        if (option.id === correctId) continue;
        if (typeof option.rationale_md !== 'string' || option.rationale_md.trim() === '') {
          failures.push(`wrong option "${option.id}" has no teaching rationale`);
        }
      }
    }
  }

  const prose = collectProse(segment);
  for (const pattern of FORBIDDEN_BY_TIER[tier] ?? []) {
    if (pattern.test(prose)) failures.push(`tier ${tier} vocabulary violation: ${String(pattern)}`);
  }

  // A tray whose own denominations cannot reach its own target is unwinnable
  // by construction — a CONTENT failure, not merely an unverifiable key. A
  // learner handed one cannot be right no matter what they do.
  if ((segment.type === 'coin_count' || segment.type === 'make_change') && submissionFromKey(segment) === undefined) {
    failures.push('tray target is unreachable from its own denominations');
  }

  // ── key re-execution ──
  const keyVerified = reExecuteKey(segment, failures);

  return { ok: failures.length === 0, keyVerified, failures };
}

interface OptionLike {
  id: string;
  rationale_md?: unknown;
}

function extractOptions(segment: SegmentBase): OptionLike[] {
  const raw = (segment.payload as { options?: unknown }).options;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (o): o is OptionLike => typeof o === 'object' && o !== null && typeof (o as OptionLike).id === 'string',
  );
}

/** Every learner-visible string, concatenated, for the vocabulary bands. */
function collectProse(segment: SegmentBase): string {
  const parts: string[] = [segment.prompt_md ?? '', segment.explanation_md ?? ''];
  const walk = (value: unknown): void => {
    if (typeof value === 'string') parts.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(segment.payload);
  return parts.join('\n');
}

/**
 * Re-derives the answer with the REAL grader.
 *
 * `false` does not mean the segment is unusable — it means the segment cannot
 * pay XP (/ORACLE.md §8). A generated exercise whose key we cannot confirm
 * still teaches; it simply must not be able to award progress the server could
 * not verify.
 */
function reExecuteKey(segment: SegmentBase, failures: string[]): boolean {
  const grader = GRADERS[segment.type];
  if (!grader) return false;
  if (segment.answer === undefined || segment.answer === null) {
    return KEYLESS_GRADERS.has(segment.type);
  }

  const submission = submissionFromKey(segment);
  if (submission === undefined) return false;

  let outcome: { score: number };
  try {
    outcome = grader(segment, submission);
  } catch {
    failures.push('the grader threw on the segment’s own answer key');
    return false;
  }
  if (outcome.score < 100) {
    failures.push(`the segment’s own key scores ${outcome.score}, not 100`);
    return false;
  }

  // A distractor that also scores 100 means the exercise has two right answers
  // and is unwinnable-by-design in the opposite direction: the learner cannot
  // be wrong. Forge's gate 8 refuses that shape in authored content and so
  // does this.
  if (segment.type === 'quiz_mcq' || segment.type === 'picture_choice') {
    const key = segment.answer as { correct_option_id?: unknown };
    for (const option of extractOptions(segment)) {
      if (option.id === key.correct_option_id) continue;
      try {
        if (grader(segment, { option_id: option.id }).score >= 100) {
          failures.push(`distractor "${option.id}" also scores 100`);
          return false;
        }
      } catch {
        // A grader that throws on a distractor is a grader bug, not a content
        // bug — but the key is still unverified either way.
        failures.push('the grader threw on a distractor');
        return false;
      }
    }
  }

  return true;
}

/**
 * Turns an answer KEY into the SUBMISSION a learner would have made.
 *
 * These are two different shapes and conflating them is the bug this comment
 * exists to prevent. `quiz_mcq`'s key is `{correct_option_id}` while its
 * submission is `{option_id}`; `fill_blank`'s key is an ARRAY of gap
 * descriptors while its submission is an OBJECT keyed by gap number. A generic
 * "hand the key back" passes review, returns MALFORMED from every grader, and
 * therefore reports every generated segment as unverifiable — which fails
 * safe, silently, forever, and would have made tier 3 unable to award XP at
 * all without anything going red.
 *
 * Explicit per type, checked against the graders in
 * `backend/src/lesson-contract/families/*`, and pinned by a test.
 */
export function submissionFromKey(segment: SegmentBase): unknown {
  const key = segment.answer as Record<string, unknown>;
  switch (segment.type) {
    case 'quiz_mcq':
    case 'picture_choice':
      return { option_id: key.correct_option_id };
    case 'true_false':
      return { is_true: key.is_true, justification_id: key.correct_justification_id };
    case 'number_input':
      return { value: key.value };
    case 'order_steps':
      return { order: key.order };
    case 'sort_buckets':
      return { assignments: key.assignments };
    case 'match_pairs':
      return { pairs: key.pairs };
    case 'fill_blank': {
      if (!Array.isArray(key.gaps)) return undefined;
      const gaps: Record<string, string> = {};
      for (const raw of key.gaps as { gap: number; accept?: string[]; bank_id?: string }[]) {
        gaps[String(raw.gap)] = raw.bank_id ?? raw.accept?.[0] ?? '';
      }
      return { gaps };
    }
    /*
     * The money trays have EMPTY keys on purpose — the grader checks the tray
     * sum against the payload's own numbers. Re-execution therefore means
     * COMPOSING a tray that reaches the target exactly from the payload's own
     * denominations. `undefined` (target unreachable) fails the verification,
     * which is correct: a tray exercise whose denominations cannot reach its
     * own target is unwinnable by construction and must never be served.
     */
    case 'coin_count': {
      const payload = segment.payload as { denominations?: unknown; target?: unknown };
      const picked = composeExactTray(payload.denominations, payload.target);
      return picked === null ? undefined : { picked };
    }
    case 'make_change': {
      const payload = segment.payload as { denominations?: unknown; price?: unknown; paid_with?: unknown };
      const target =
        typeof payload.price === 'number' && typeof payload.paid_with === 'number'
          ? payload.paid_with - payload.price
          : undefined;
      const picked = composeExactTray(payload.denominations, target);
      return picked === null ? undefined : { picked };
    }
    default:
      return undefined;
  }
}

/**
 * An EXACT composition of `target` from `denominations`, or null.
 *
 * Greedy fails legitimate cases (denominations [3,4] cannot reach 6 greedily),
 * so this is a small coin-change DP in integer cents, bounded so a hostile
 * payload cannot buy CPU: amounts beyond 200,000 cents or compositions beyond
 * 200 pieces refuse rather than search.
 */
export function composeExactTray(denominations: unknown, target: unknown): number[] | null {
  if (!Array.isArray(denominations) || typeof target !== 'number' || !Number.isFinite(target)) return null;
  const denoms = denominations.filter((d): d is number => typeof d === 'number' && d > 0);
  if (denoms.length === 0 || target <= 0) return null;

  const toCents = (v: number): number => Math.round(v * 100);
  const targetCents = toCents(target);
  if (targetCents <= 0 || targetCents > 200_000) return null;
  const denomCents = denoms.map(toCents).filter((d) => d > 0);
  if (Math.ceil(targetCents / Math.min(...denomCents)) > 200) return null;

  // parent[i] = the denomination (cents) used to reach amount i, or -1.
  const parent = new Int32Array(targetCents + 1).fill(-1);
  parent[0] = 0;
  for (let amount = 1; amount <= targetCents; amount += 1) {
    for (const d of denomCents) {
      if (d <= amount && parent[amount - d] !== -1) {
        parent[amount] = d;
        break;
      }
    }
  }
  if (parent[targetCents] === -1) return null;

  const picked: number[] = [];
  for (let amount = targetCents; amount > 0; ) {
    const d = parent[amount] ?? -1;
    if (d <= 0) return null;
    picked.push(d / 100);
    amount -= d;
  }
  return picked;
}

/** The client-safe view of a candidate. The key never leaves this process. */
export function stripCandidate(segment: SegmentBase): Record<string, unknown> {
  const stripped = stripAnswers({ segments: [segment] }) as { segments: Record<string, unknown>[] };
  return stripped.segments[0] ?? {};
}
