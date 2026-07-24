// write stage — skeleton → full LessonDocument (COURSE_ENGINE.md §4).
// DeepSeek, temp 0.4, JSON mode, es-MX first (the authoring locale).
// Corrective retries (max 4) feed truncated Zod issues back to the model;
// if those are exhausted, per-segment salvage keeps whatever segments DID
// validate (dropping the rest, if ≥6 survive incl ≥1 graded); if salvage
// also fails, one last-resort regen at temp 0.2 is the final attempt.

import { completeDeepSeek } from '../providers/deepseek.js';
import type { UsageLedger } from '../providers/usage.js';
import {
  effectiveDifficulty,
  renderReviewSourcesBlock,
  CONSOLIDATION_INSTRUCTION,
  INTERLEAVE_INSTRUCTION,
  connectToPriorInstruction,
  registerToneInstruction,
  type PlanContext,
  type PlanSkeleton,
} from './plan.js';
import type { FactsFile } from '../catalog/schema.js';
import { lessonDocumentSchema, type LessonDocumentParsed } from '../contract/schema.js';
import { lessonMetaSchema, lessonScoringSchema } from '../contract/core/schemaBase.js';
import { TYPE_TO_SCHEMA, GRADED_TYPES } from '../contract/registry.js';
import { shapeExample } from './shapeExample.js';
import type { LessonLocale } from '../contract/core/types.js';
import { runAllGates, type GateContext } from './gates.js';
import { ICON_PALETTE } from './generationQuality.js';
import { CONTENT_PLAYBOOK, tierReasoningGuidance } from './contentPlaybook.js';
import { withCorrectiveRetry, safeJsonParse, formatZodIssues, CorrectiveRetryExhaustedError } from './correctiveRetry.js';

const MAX_WRITE_ATTEMPTS = 4;
const MIN_SALVAGE_SEGMENTS = 6;
const WRITE_ISSUE_TRUNCATE = 6;

export interface WriteInput {
  ctx: PlanContext;
  skeleton: PlanSkeleton;
  facts: FactsFile;
  locale: LessonLocale;
  slug: string;
  subject: string;
  /**
   * When provided, the deterministic gates run INSIDE the corrective-retry
   * loop: a Zod-valid document that fails a gate (uncast character, generic
   * explanation_md, wrong savings arithmetic, missing {{n}} markers…) gets
   * the gate's actionable message fed back for another attempt instead of
   * failing the slot outright. Found on the first real QA run (2026-07-13):
   * gate messages are exactly the kind of feedback the model fixes on the
   * next try, but they were thrown away — a whole slot died for a one-line
   * fixable problem. run.ts still re-runs gates afterwards as the final
   * authority (the salvage/last-resort paths here bypass this loop).
   */
  gateCtx?: GateContext;
}

export interface WriteResult {
  document: LessonDocumentParsed;
  attempts: number;
  salvaged: boolean;
  droppedSegments: number;
}

export interface WriteDeps {
  ledger?: UsageLedger;
  complete?: typeof completeDeepSeek;
}

function renderFactsBlock(facts: FactsFile, refs: readonly string[]): string {
  if (refs.length === 0) return '(no fact refs for this topic — use only round numbers consistent with the blueprint)';
  return refs
    .map((ref) => {
      const entry = facts.facts[ref];
      if (!entry) return `${ref}: (unresolved fact ref)`;
      const valueStr = Array.isArray(entry.value) ? entry.value.join(', ') : JSON.stringify(entry.value);
      return `${ref}: ${valueStr}${entry.unit ? ` ${entry.unit}` : ''}${entry.label_es ? ` — ${entry.label_es}` : ''}`;
    })
    .join('\n');
}

const BASE_HARD_RULES = [
  'Output STRICT JSON only: {"schema_version":1,"meta":{...},"scoring":{...},"segments":[...]}. No markdown fences, no prose outside the JSON.',
  'Produce EXACTLY one segment per skeleton entry, IN THE SAME ORDER, with the SAME `type` as the skeleton.',
  'Every segment.id must be unique within the document (short kebab-case, e.g. "s1-intro").',
  'XP bands by difficulty: 1→5-10, 2→10-20, 3→15-30, 4→25-40, 5→35-50 (story-family segments always use xp:0).',
  'Segments with difficulty >= 3 MUST include at least one `hints` entry (max 2, progressive).',
  'Every WRONG option in choice/analyze-style segments MUST carry `rationale_md` explaining why it is tempting but incorrect (P7). Correct options may omit it.',
  'narrator.character and meta.cast use ONLY: dina, liruf, rho, zara. Never any other name.',
  'meta.cast MUST list EVERY one of those 4 names that appears ANYWHERE in the document (any narrator.character, any payload character/dialogue field) — no omissions, no extras.',
  'meta.locale = "es-MX", meta.subject as given, meta.slug as given, scoring.hearts = null, scoring.pass_threshold = 70, scoring.hint_penalty_pct = 10, scoring.max_attempts = 2.',
  'Whenever you write `explanation_md` (optional, but if present): at least 40 characters, AND it must contain a specific number, OR one of dina/liruf/rho/zara by name, OR a word/phrase that also appears in that same segment\'s `payload` — a generic "¡Muy bien! Elegiste la opción correcta." is REJECTED.',
  'explanation_md is OUTCOME-NEUTRAL: it is shown after both correct AND incorrect attempts, so it must TEACH the concept, never assume success. Never open it with "¡Exacto!", "¡Correcto!", "¡Muy bien!", "¡Así es!" or similar — state the fact/why directly (e.g. "El vaso cuesta 5 pesos porque…").',
  'NEVER leak the answer: the `prompt_md`, `hints`, and `meta.objectives` must NOT state or spell out the correct choice/number/word. Hints scaffold the thinking ("piensa en cuánto cuesta cada vaso"), they do not give the answer ("la respuesta es 5"). The kid must reason to the answer.',
  'The engine is TAP-TO-PLACE for every placement type EXCEPT sort_buckets/group_sets (which also support real dragging). For sort_buckets/group_sets, "arrastra"/"drag" OR "toca"/"tap" are both fine. For EVERY OTHER type (order_steps, match_pairs, build_sentence, etc.) never write "arrastra"/"arrastrar"/"drag" — say "toca" (tap). Do NOT rely on option ORDER either (the engine shuffles options/columns/token banks): never write "elige la primera opción" or author the correct option always first.',
  'best_decision / would_you_rather / story_branch / dialogue_choice `qualities` are on a 0-100 scale (the BEST choice ≈ 90-100, a poor choice ≈ 0-30) — NEVER a 0-1 scale, and never all zeros. The correct answer must be able to reach a passing score.',
  'compare_table segments ONLY: `answer.cells` keys use the "<row_id>:<col_id>" COLON form (e.g. "proveedor-a:precio") — never an underscore or any other separator; the player only ever submits colon keys.',
  'icon / art.icon / ask_icon / a_icon / b_icon values MUST come from the ALLOWED ICONS list included below — never any other name, never an invented one ("lemonade", "piggy_bank", "counter_1" all fail validation and kill the lesson). When unsure, prefer a plain, common glyph from the list.',
  'fill_blank segments ONLY: `payload.text_md` MUST contain a `{{1}}`, `{{2}}`… marker (matching each `answer.gaps[].gap` number, 1-indexed, in order) at the exact point each blank belongs — one marker per gap, no exceptions.',
  'savings_goal segments ONLY: OMIT `answer.correct` entirely — the grader computes it automatically from `payload.goal`/`payload.weekly_options`. If you do include it, every key must be the exact string form of one of the `weekly_options` numbers (e.g. "20"), never a label like "weeks".',
  'IMAGES ARE FILLED AUTOMATICALLY — NEVER invent any `image_url` / `a_image_url` / `b_image_url` / `ask_image_url` (no "https://example.com/…" or any placeholder). OMIT every image_url field entirely; a later stage generates a real AI illustration for each concrete object from the item\'s text/label. Your job for the visual is to give each concrete item a SHORT, LITERAL object name (see below) and a valid `icon` fallback from the ALLOWED ICONS list.',
  'type_answer segments ONLY: NEVER ask a definition-recall question ("¿Cómo se llama…?", "¿Qué palabra…?") — that is memorizing a vocabulary word, not applying a concept, and the judge fails it. Instead ask the child to type an APPLIED answer they had to work out: the RESULT of a small calculation written as a word or number ("Liruf vendió 3 vasos de 5 pesos. ¿Cuántos pesos juntó?" → accept "15"), or a decision. Never state or phonetically hint the answer in prompt_md, hints or explanation.',
  'count_objects segments ONLY (REQUIRED): give EACH `payload.scene[]` item a short `label` naming the object to draw and count (e.g. "moneda", "vaso de limonada", "limón"), and set `payload.ask_label` to the object the child must count. These labels are MANDATORY — they drive the real illustration + accessibility; omitting any of them fails the gate and the lesson regenerates.',
  'order_steps segments ONLY: if EVERY entry in `payload.items` belongs in the sequence, OMIT `payload.slots` entirely. If you include a distractor item that should NOT be placed (e.g. an extra step that doesn\'t belong), you MUST set `payload.slots` to the exact count of items that DO belong — which must equal `answer.order.length` exactly. Getting this wrong makes the exercise unwinnable (every submission scores 0). rank_choices and timeline_order have NO distractor support — `answer.order` there must include EVERY item/event, no exceptions.',
  'memory_flip segments ONLY: every pair needs `a_icon` AND `b_icon` (real Material Symbols, one per side) — NEVER invent `a_image_url`/`b_image_url` (OMIT them; the image stage fills them in). Each pair\'s a_md/b_md match must be UNIQUE within the segment: no other pair may share an equivalent value on either side, or two different pairs become interchangeably "correct" and the fixed-slot match breaks.',
  'equation_builder segments ONLY: each `answer.accepted` entry is a SPACE-SEPARATED SEQUENCE OF TOKEN IDS from `payload.tokens` (e.g. "t1 t3 t2" where t1.text="2", t3.text="+", t2.text="3") — NEVER the rendered equation text like "2+3=5". The token texts, concatenated in that order, must evaluate arithmetically to `payload.target_result` (it is re-executed). Do NOT include an "=" token: the sequence is only the left-hand expression.',
  'pattern_complete segments ONLY — READ CAREFULLY, this type is easy to get wrong: `payload.sequence` is the VISIBLE part of the pattern (the tiles ALREADY shown, complete, WITHOUT the missing item). The engine draws `missing_slots` EMPTY slots AFTER the sequence; the child fills them from `payload.options`. So DO NOT put the missing item inside `sequence`. `answer.correct` keys are the ZERO-BASED slot indexes ("0", plus "1" only if missing_slots=2) — NOT a sequence index like "5" — and values are ids from `payload.options`.',
  'pattern_complete VISUAL RULE: the pattern MUST be readable purely by LOOKING at the tiles, because the only things rendered are each tile\'s ICON (shape) and TINT (color). So build the pattern out of DISTINCT ICONS and/or DISTINCT TINTS that repeat obviously (e.g. lemon→cup→lemon→cup→?, or a primary→accent→primary→accent color beat). NEVER a pattern of SIZE, PRICE or amount (chico/mediano/grande, $5/$10/$15) — identical tiles cannot show size, so it is invisible and unsolvable. Keep prompt_md tiny: "¿Qué sigue en el patrón?" — the tiles carry it, no ladder described in text.',
  'story_branch segments ONLY: EVERY node needs at least 1 entry in `choices` — an ending node uses a single choice with `next: null` (e.g. {"id":"fin","text_md":"Fin de la historia","next":null}); never an empty choices array.',
  '`emotion` fields (story_dialogue lines, story_scene, story_branch nodes) are OPTIONAL — if you write one it MUST be EXACTLY one of: neutral, happy, excited, thinking, surprised, encouraging, proud (never any other word, e.g. never "sad"/"confused"/"worried"/"curious"). If none of those fit, OMIT the field entirely rather than inventing one.',
  'NEVER embed an acting/stage direction inside any SPOKEN text field (prompt_md, story dialogue text_md, story_scene body_md, explanation_md, recap_md, hints) — e.g. "¡Vamos! (con entusiasmo)", "(sonríe)", "(smiles)", "(pausa)". These get read aloud verbatim by the TTS and break the narration. Delivery/emotion goes in the STRUCTURED `emotion`/`action` fields only. A parenthetical in spoken text is allowed ONLY when it carries real content (a number, a clarifying example): "(5 pesos)", "(limones, vasos)" are fine; "(con voz suave)" is not.',
  'Write math as words when it is meant to be READ ALOUD in prose ("cinco más cinco"), and as digits+symbols only inside dedicated math widgets (equation_builder tokens, number fields). In spoken text, "+", "=", "%", "×", "÷", "$" are auto-spoken in the lesson\'s language by the audio pipeline, but prefer words in narrative prose for a natural read.',
  'Never write `explanation_md` (or any *_md field) as an empty string `""` — if you have nothing real to add, OMIT the field entirely; an empty string always fails validation.',
  'NEVER emit ANY optional field as `null` — OMIT it entirely instead. This includes `rationale_md` (on a correct option, just leave it out — only WRONG options need it), `audio_segment_id`, `narrator`, `image_url`, `emotion`, `action`, `hints`, `title`. A literal `null` ALWAYS fails validation; the field being absent is how you say "not set".',
  '`tint` fields are ONE of EXACTLY: primary, accent, success, warning, delight — never a color word like "yellow"/"blue"/"green" or any other value.',
  'robot_path `payload.commands` entries are EXACTLY one of: forward, left, right — never "up"/"down"/"move" or any other token. `payload.commands` MUST have AT MOST 3 entries — design a SHORT 2-3 move solution path (a longer maze fails validation). `payload.max_commands` is a SEPARATE field (the child\'s slot budget, may be larger); do not confuse the two.',
  'interest_peek segments ONLY: if `prediction.kind` is "choice", the answer is `correct_option_id` alone — OMIT `value`/`tolerance` entirely. If `prediction.kind` is "slider", the answer is `value` + `tolerance`, and `tolerance` MUST be a positive number greater than 0 (never 0) — pick something proportional to the values in play, e.g. 1-5 units.',
  'interest_peek CONTENT (the kid must PREDICT growth, not read it): STRONGLY PREFER `prediction.kind: "slider"` — the child slides to predict the grown amount, which is a genuine estimate and avoids handing them the answer in a list of options. NEVER state the resulting amount or the per-period gain in `prompt_md`/story — describe the piggy bank as "giving a little extra each week" WITHOUT the number, then ask the child to predict the total after ALL the periods. For slider: set `min` below the principal and `max` above the computed compound value, and `answer.value` to the computed compound value with `answer.tolerance` ~5% (>0). Keep the rate and amounts tiny and whole where possible so a young child can follow "paciente crece de a poquito". (If you must use choice, distractors are growth misconceptions fitting the SAME week count — "stays the same", a linear under/over-guess — NEVER a value implying different periods.)',
  'balance_scale segments ONLY: let leftSum = sum of every `left_fixed[].value`. `payload.weights` (3-8 entries) MUST contain SOME SUBSET of its `value`s that adds up to EXACTLY leftSum (it is re-checked programmatically) — e.g. if leftSum=8, weights could be [5,3,2,4] (5+3=8) or [2,2,4,6] (2+2+4=8); pick the weight values DELIBERATELY to satisfy this, never at random.',
  'Every number you use MUST come from the FACTS block below or be exact arithmetic the blueprint implies — never invent a fact. All arithmetic in `answer` fields must be EXACTLY correct (it is re-executed programmatically and will be rejected if wrong).',
  'story family segments (story_dialogue, story_scene, key_ideas, concept_reveal, checkpoint) carry NO `answer` field and xp:0.',
  '*_md fields use ONLY MarkdownLite: **bold**, *italic*, `code`, line breaks, "- " lists. Nothing else — no headings, no links, no raw HTML.',
  'Write in es-MX, warm and encouraging, at a reading level appropriate for the stated age tier. Never mock a wrong answer (P3).',
  // LF-Brain finding (COURSE_ENGINE.md §4 "gate" stage 6 / judge concreteness):
  // generic, restated content never teaches — ground the lesson in reality.
  'At least ONE segment MUST include a worked CONCRETE instance — a specific number, a named character, or a specific scenario. Never leave the whole lesson in purely abstract phrasing.',
];

function buildHardRules(ctx: PlanContext): string {
  const rules = [...BASE_HARD_RULES];
  if (ctx.review) {
    rules.push(CONSOLIDATION_INSTRUCTION);
    rules.push(`No segment.difficulty may exceed ${effectiveDifficulty(ctx)} in this review lesson.`);
    if (ctx.review.kind === 'review_interleaved' || ctx.review.kind === 'review_quest') {
      rules.push(INTERLEAVE_INSTRUCTION);
    }
  }
  if (ctx.prior) rules.push(connectToPriorInstruction(ctx.prior));
  if (ctx.register?.toneDirectiveEs) rules.push(registerToneInstruction(ctx.register.toneDirectiveEs));
  return rules.map((line, i) => `${i + 1}. ${line}`).join('\n');
}

function buildWriteMessages(input: WriteInput, factsBlock: string, issues: string | undefined) {
  const system =
    'You are Forge, the WRITE stage of a financial-literacy lesson generator for children (LittleFounders). ' +
    'You expand an approved segment skeleton into a complete, gradeable lesson document. ' +
    'Your job is not just to satisfy the schema — it is to design exercises a child genuinely WANTS to do, at ' +
    'Duolingo/Brilliant quality: concrete, relatable, decision-driven, never a dry recall drill. Follow the CONTENT PLAYBOOK.';

  const skeletonText = input.skeleton.segments
    .map((s, i) => `${i + 1}. type="${s.type}" — ${s.brief}`)
    .join('\n');

  // The model otherwise has to guess each type's `payload`/`answer` field
  // names from nothing but its name — it guesses inconsistently, and
  // usually wrong (confirmed empirically: story_scene alone produced 4
  // different invalid shapes across 4 retries before this existed). One
  // exact JSON shape per DISTINCT type in the skeleton, values are
  // placeholders — content quality is covered by the hard rules above.
  const uniqueTypes = [...new Set(input.skeleton.segments.map((s) => s.type))];
  const shapeExamplesText = uniqueTypes
    .map((type) => {
      const schema = TYPE_TO_SCHEMA.get(type);
      if (!schema) return null;
      return `type="${type}":\n${JSON.stringify(shapeExample(schema))}`;
    })
    .filter((s): s is string => s !== null)
    .join('\n\n');

  // meta/scoring are top-level document fields, not part of any segment
  // schema — HARD_RULES only calls out meta.locale/subject/slug and the
  // scoring literals explicitly; without this, meta.title/estimated_minutes/
  // objectives (all REQUIRED) were routinely omitted entirely, especially
  // under retry pressure (empirically the single largest failure category).
  const metaShapeText = JSON.stringify({ meta: shapeExample(lessonMetaSchema), scoring: shapeExample(lessonScoringSchema) });

  const reviewBlock = input.ctx.review
    ? [
        '',
        `SOURCE TOPICS (this is a ${input.ctx.review.kind} review lesson — ground every segment in these, introduce nothing new):`,
        renderReviewSourcesBlock(input.ctx.review.sources),
      ].join('\n')
    : '';

  const user = [
    CONTENT_PLAYBOOK,
    '',
    `AGE-TIER REASONING CEILING for THIS lesson — ${tierReasoningGuidance(input.ctx.tier)}`,
    '',
    'HARD RULES (mechanical constraints — the playbook above is the quality bar; these are the non-negotiable format rules):',
    buildHardRules(input.ctx),
    '',
    'LESSON CONTEXT:',
    `Age tier: ${input.ctx.tier}`,
    `Topic concept: ${input.ctx.topic.concept}`,
    `Learning objective: ${input.ctx.topic.learningObjective}`,
    `Key vocabulary: ${input.ctx.topic.keyVocabulary.join(', ')}`,
    `Micro-objective: ${input.ctx.lesson.microObjective}`,
    `Narrative beat: ${input.ctx.lesson.narrativeBeat}`,
    `Lesson slug: ${input.slug}`,
    `Subject: ${input.subject}`,
    reviewBlock,
    '',
    'FACTS (the ONLY source of numbers, besides pure arithmetic):',
    factsBlock,
    '',
    // The model used to GUESS icon names from thin air (invented "counter_1",
    // "lemonade", "piggy_bank" — each one kills the lesson at gate 7). Giving
    // it the actual whitelist converts that failure class into a lookup.
    `ALLOWED ICONS (the complete whitelist — every icon-valued field must use one of these): ${[...ICON_PALETTE].join(', ')}`,
    '',
    'SEGMENT SKELETON (expand each into a full segment, in order):',
    skeletonText,
    '',
    'EXACT top-level `meta`/`scoring` JSON SHAPE — ALL fields shown are REQUIRED (title, estimated_minutes, and objectives are easy to forget and the document is rejected without them):',
    metaShapeText,
    '',
    'EXACT JSON SHAPE per type used above (field names/nesting/enum options are LAW — never invent, rename, or move a field; `payload`/`answer` sit alongside `id`/`type`/`prompt_md`/`difficulty`/`xp`/`hints`/`narrator` at the segment\'s top level, never nested inside each other):',
    shapeExamplesText,
  ].join('\n');

  const messages = [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: user },
  ];

  if (issues) {
    messages.push({
      role: 'user' as const,
      content: `Your previous JSON failed validation. Fix these issues and resend the FULL corrected JSON document:\n${issues}`,
    });
  }

  return messages;
}

/**
 * Recursively drops object keys whose value is literally `null`. DeepSeek
 * stubbornly emits `null` for optional fields it means to omit
 * (`rationale_md` on a correct option, `audio_segment_id`, `narrator`,
 * `emotion`…) — and does it AGAIN on every corrective retry even with the
 * Zod error fed back and a hard rule forbidding it (observed live 2026-07-23:
 * a quiz_mcq failed all 4 write attempts + salvage + last-resort on the same
 * two nulls). Fighting the model is futile; sanitizing is deterministic. A
 * `null` on an OPTIONAL field becomes "absent" → valid; a `null` on a REQUIRED
 * field becomes "missing" → still a Zod error, correctly. Arrays keep their
 * length (elements recurse). This runs BEFORE every schema check.
 */
/**
 * Keys where `null` is SEMANTIC, not "model meant to omit": story_branch's
 * `choices[].next` (null = ending node — the schema REQUIRES the explicit
 * null; stripping it produced "expected string, received undefined" and
 * exhausted every write retry on story_branch lessons before this list
 * existed), and `hearts` (null = cheer mode). Never strip these.
 */
const SEMANTIC_NULL_KEYS = new Set(['next', 'hearts']);

export function stripNullValues(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripNullValues);
  if (node !== null && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (value === null && !SEMANTIC_NULL_KEYS.has(key)) continue;
      out[key] = value === null ? null : stripNullValues(value);
    }
    return out;
  }
  return node;
}

/**
 * Deterministic content repairs for constraints the model reliably fumbles
 * even with the rule spelled out and the gate message fed back (same
 * "sanitize, don't argue" philosophy as stripNullValues).
 *
 * balance_scale: the puzzle is only solvable when SOME subset of
 * `payload.weights` sums exactly to the left pan's total. DeepSeek picks
 * plausible-looking weights that miss the sum ~often enough to kill slots
 * (observed live 2026-07-23: a whole lesson died on `no subset of weights
 * sums to left_fixed total 8`). When no subset works we overwrite the FIRST
 * weight's value with the exact left-pan total — a single-weight solution
 * always exists after that, every other weight stays as an authored
 * distractor, and the answer key is state-checked (recomputed), so nothing
 * else needs patching.
 */
export function repairDocument(node: unknown): unknown {
  const doc = node as { segments?: unknown } | null;
  if (!doc || !Array.isArray(doc.segments)) return node;
  for (const seg of doc.segments as Array<Record<string, unknown>>) {
    if (seg?.type === 'balance_scale') repairBalanceScale(seg);
    else if (seg?.type === 'interest_peek') repairInterestPeek(seg);
    else if (seg?.type === 'savings_goal') repairSavingsGoal(seg);
  }
  return node;
}

/**
 * savings_goal's answer is COMPUTED by the grader (weeks = ceil(goal/weekly)).
 * The model keeps authoring `answer.correct` with wrong weeks (e.g. 2 instead
 * of ceil(80/20)=4), which the arithmetic gate then rejects. The write rule
 * says OMIT it; when the model includes it anyway, drop it — the grader is the
 * source of truth, so a stale/wrong authored key is pure downside.
 */
function repairSavingsGoal(seg: Record<string, unknown>): void {
  const answer = seg.answer as Record<string, unknown> | undefined;
  if (answer && 'correct' in answer) delete answer.correct;
}

function repairBalanceScale(seg: Record<string, unknown>): void {
  const payload = seg.payload as { left_fixed?: Array<{ value?: unknown }>; weights?: Array<{ value?: unknown }> } | undefined;
  const left = Array.isArray(payload?.left_fixed) ? payload.left_fixed : [];
  const weights = Array.isArray(payload?.weights) ? payload.weights : [];
  const values = weights.map((w) => (typeof w?.value === 'number' ? w.value : NaN));
  if (left.length === 0 || weights.length === 0 || values.some(Number.isNaN)) return;
  const leftSum = left.reduce((acc, e) => acc + (typeof e?.value === 'number' ? e.value : 0), 0);
  // subset-sum over ≤8 small weights — brute force is fine
  let solvable = false;
  for (let mask = 1; mask < 1 << values.length && !solvable; mask++) {
    let sum = 0;
    for (let i = 0; i < values.length; i++) if (mask & (1 << i)) sum += values[i]!;
    if (Math.abs(sum - leftSum) < 1e-9) solvable = true;
  }
  if (!solvable && weights[0]) weights[0].value = leftSum;
}

/**
 * interest_peek constraints the model fumbles even with the rule spelled out
 * (observed live: `periods: 1` and `tolerance: 0`, both schema-fatal after
 * every retry). periods < 2 → 2, with `answer.value` recomputed via the SAME
 * compound formula gate 3 re-executes (principal·(1+rate/100)^periods) so the
 * fact gate stays green; tolerance ≤ 0 → ~5% of the computed value (min 1).
 */
function repairInterestPeek(seg: Record<string, unknown>): void {
  const payload = seg.payload as {
    principal?: unknown;
    rate_pct?: unknown;
    periods?: unknown;
    prediction?: { kind?: string; options?: Array<{ id?: string; text_md?: string }> };
  } | undefined;
  const answer = seg.answer as { value?: unknown; tolerance?: unknown; correct_option_id?: unknown } | undefined;
  if (!payload || typeof payload.principal !== 'number' || typeof payload.rate_pct !== 'number') return;
  if (typeof payload.periods === 'number' && payload.periods < 2) {
    payload.periods = 2;
    if (answer && typeof answer.value === 'number') {
      answer.value = Math.round(payload.principal * (1 + payload.rate_pct / 100) ** 2 * 100) / 100;
    }
  }
  if (answer && typeof answer.tolerance === 'number' && answer.tolerance <= 0) {
    const base = typeof answer.value === 'number' ? Math.abs(answer.value) : payload.principal;
    answer.tolerance = Math.max(1, Math.round(base * 0.05));
  }
  // CHOICE mode: the correct option must show ≈ the compound value (gate 4
  // re-executes principal·(1+rate/100)^periods). The model routinely picks a
  // wrong round number; snap the correct option's number to the computed value
  // so the one option that must be right, is — distractors keep their numbers.
  if (
    payload.prediction?.kind === 'choice' &&
    typeof payload.periods === 'number' &&
    answer &&
    typeof answer.correct_option_id === 'string' &&
    Array.isArray(payload.prediction.options)
  ) {
    const computed = Math.round(payload.principal * (1 + payload.rate_pct / 100) ** payload.periods * 100) / 100;
    const option = payload.prediction.options.find((o) => o?.id === answer.correct_option_id);
    if (option && typeof option.text_md === 'string' && /\d/.test(option.text_md)) {
      // Replace the first number token (int or decimal) with the computed value.
      option.text_md = option.text_md.replace(/\d+(?:[.,]\d+)?/, String(computed));
    }
  }
}

interface SalvageOutcome {
  document: LessonDocumentParsed;
  dropped: number;
}

function trySalvage(rawJson: unknown): SalvageOutcome | null {
  if (typeof rawJson !== 'object' || rawJson === null) return null;
  const obj = rawJson as Record<string, unknown>;

  const metaParsed = lessonMetaSchema.safeParse(obj.meta);
  if (!metaParsed.success) return null;
  const scoringParsed = lessonScoringSchema.safeParse(obj.scoring ?? {});
  const scoring = scoringParsed.success ? scoringParsed.data : lessonScoringSchema.parse({});

  const rawSegments = Array.isArray(obj.segments) ? obj.segments : [];
  const seenIds = new Set<string>();
  const validSegments: { id: string; type: string }[] = [];
  let dropped = 0;

  for (const seg of rawSegments) {
    if (typeof seg !== 'object' || seg === null) {
      dropped++;
      continue;
    }
    const type = (seg as Record<string, unknown>).type;
    const schema = typeof type === 'string' ? TYPE_TO_SCHEMA.get(type) : undefined;
    if (!schema) {
      dropped++;
      continue;
    }
    const parsed = schema.safeParse(seg);
    if (!parsed.success) {
      dropped++;
      continue;
    }
    const data = parsed.data as { id: string; type: string };
    if (seenIds.has(data.id)) {
      dropped++;
      continue;
    }
    seenIds.add(data.id);
    validSegments.push(data);
  }

  const gradedCount = validSegments.filter((s) => GRADED_TYPES.includes(s.type)).length;
  if (validSegments.length < MIN_SALVAGE_SEGMENTS || gradedCount < 1) return null;

  const candidate = {
    schema_version: 1 as const,
    meta: metaParsed.data,
    scoring,
    segments: validSegments,
  };
  const finalParsed = lessonDocumentSchema.safeParse(candidate);
  if (!finalParsed.success) return null;
  return { document: finalParsed.data, dropped };
}

export async function writeLessonDocument(input: WriteInput, deps: WriteDeps = {}): Promise<WriteResult> {
  const complete = deps.complete ?? completeDeepSeek;
  const factsBlock = renderFactsBlock(input.facts, input.ctx.topic.factRefs);

  let lastRawJson: unknown;
  let lastIssues: string | undefined;

  try {
    const { data, attempts } = await withCorrectiveRetry<LessonDocumentParsed>({
      maxAttempts: MAX_WRITE_ATTEMPTS,
      callModel: async (issues) => {
        const messages = buildWriteMessages(input, factsBlock, issues);
        const result = await complete(
          // maxTokens explicit: a full lesson document (segments + hints +
          // rationale_md per distractor) can run long, and DeepSeek's
          // implicit default silently truncates mid-string instead of
          // erroring — surfaced live 2026-07-14 as "invalid JSON:
          // Unterminated string" on a content-heavy balance_scale lesson.
          { messages, temperature: 0.4, jsonMode: true, maxTokens: 8192 },
          { operation: 'write', ledger: deps.ledger },
        );
        return result.content;
      },
      parse: (raw) => {
        const json = safeJsonParse(raw);
        if (!json.ok) {
          lastIssues = `invalid JSON: ${json.error}`;
          if (process.env.FORGE_DEBUG_WRITE) console.error('DEBUG raw write output (unparseable):', raw);
          return { ok: false, issues: lastIssues };
        }
        lastRawJson = repairDocument(stripNullValues(json.value));
        const parsed = lessonDocumentSchema.safeParse(lastRawJson);
        if (!parsed.success) {
          lastIssues = formatZodIssues(parsed.error.issues, WRITE_ISSUE_TRUNCATE);
          if (process.env.FORGE_DEBUG_WRITE) console.error('DEBUG raw write output:', JSON.stringify(json.value, null, 2));
          return { ok: false, issues: lastIssues };
        }
        if (input.gateCtx) {
          const gateReport = runAllGates(parsed.data, input.gateCtx);
          if (!gateReport.ok || !gateReport.document) {
            lastIssues = gateReport.problems
              .slice(0, WRITE_ISSUE_TRUNCATE)
              .map((p) => `[gate ${p.gate}${p.segmentId ? ` @${p.segmentId}` : ''}] ${p.message}`)
              .join('; ');
            return { ok: false, issues: lastIssues };
          }
          return { ok: true, data: gateReport.document };
        }
        return { ok: true, data: parsed.data };
      },
    });
    return { document: data, attempts, salvaged: false, droppedSegments: 0 };
  } catch (err) {
    if (!(err instanceof CorrectiveRetryExhaustedError)) throw err;
  }

  // Corrective retries exhausted — try salvaging whatever segments DID validate.
  if (lastRawJson) {
    const salvage = trySalvage(lastRawJson);
    if (salvage) {
      return { document: salvage.document, attempts: MAX_WRITE_ATTEMPTS, salvaged: true, droppedSegments: salvage.dropped };
    }
  }

  // Last resort: one regen at a lower, more literal temperature.
  const messages = buildWriteMessages(input, factsBlock, lastIssues);
  const result = await complete(
    { messages, temperature: 0.2, jsonMode: true, maxTokens: 8192 },
    { operation: 'write-last-resort', ledger: deps.ledger },
  );
  const json = safeJsonParse(result.content);
  if (json.ok) {
    const sanitized = repairDocument(stripNullValues(json.value));
    const parsed = lessonDocumentSchema.safeParse(sanitized);
    if (parsed.success) {
      return { document: parsed.data, attempts: MAX_WRITE_ATTEMPTS + 1, salvaged: false, droppedSegments: 0 };
    }
    lastIssues = formatZodIssues(parsed.error.issues, WRITE_ISSUE_TRUNCATE);
    const salvage = trySalvage(json.value);
    if (salvage) {
      return {
        document: salvage.document,
        attempts: MAX_WRITE_ATTEMPTS + 1,
        salvaged: true,
        droppedSegments: salvage.dropped,
      };
    }
  } else {
    lastIssues = `invalid JSON: ${json.error}`;
  }

  throw new Error(
    `write stage: exhausted corrective retries, per-segment salvage, and the last-resort regen. Last issues: ${lastIssues ?? 'unknown'}`,
  );
}
