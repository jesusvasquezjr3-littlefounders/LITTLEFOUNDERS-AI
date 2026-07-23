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
  'The engine is TAP-TO-PLACE everywhere. Never write "arrastra"/"arrastrar"/"drag" in any prompt or hint — say "toca" (tap). Do NOT rely on option ORDER either (the engine shuffles options/columns/token banks): never write "elige la primera opción" or author the correct option always first.',
  'best_decision / would_you_rather / story_branch / dialogue_choice `qualities` are on a 0-100 scale (the BEST choice ≈ 90-100, a poor choice ≈ 0-30) — NEVER a 0-1 scale, and never all zeros. The correct answer must be able to reach a passing score.',
  'compare_table segments ONLY: `answer.cells` keys use the "<row_id>:<col_id>" COLON form (e.g. "proveedor-a:precio") — never an underscore or any other separator; the player only ever submits colon keys.',
  'icon / art.icon / ask_icon values MUST be REAL Material Symbols Outlined names (e.g. savings, storefront, local_cafe, calculate, lightbulb, scale, emoji_events) — never invented names like "lemonade", "piggy_bank", "coin", "guitar" or "calendar" (they render as raw text). When unsure, prefer a plain, common glyph.',
  'fill_blank segments ONLY: `payload.text_md` MUST contain a `{{1}}`, `{{2}}`… marker (matching each `answer.gaps[].gap` number, 1-indexed, in order) at the exact point each blank belongs — one marker per gap, no exceptions.',
  'savings_goal segments ONLY: OMIT `answer.correct` entirely — the grader computes it automatically from `payload.goal`/`payload.weekly_options`. If you do include it, every key must be the exact string form of one of the `weekly_options` numbers (e.g. "20"), never a label like "weeks".',
  'picture_choice segments ONLY: NEVER invent `payload.options[].image_url` (no "https://example.com/..." or any other placeholder) — OMIT it entirely so the real image-generation stage fills it in; `icon` is the only field you provide for the image.',
  'equation_builder segments ONLY: each `answer.accepted` entry is a SPACE-SEPARATED SEQUENCE OF TOKEN IDS from `payload.tokens` (e.g. "t1 t3 t2" where t1.text="2", t3.text="+", t2.text="3") — NEVER the rendered equation text like "2+3=5". The token texts, concatenated in that order, must evaluate arithmetically to `payload.target_result` (it is re-executed). Do NOT include an "=" token: the sequence is only the left-hand expression.',
  'pattern_complete segments ONLY: `answer.correct` keys are the ZERO-BASED missing-slot indexes as digit strings ("0", and "1" when missing_slots=2) — never icon names, option ids, or labels like "slot1"; values are ids from `payload.options`.',
  'story_branch segments ONLY: EVERY node needs at least 1 entry in `choices` — an ending node uses a single choice with `next: null` (e.g. {"id":"fin","text_md":"Fin de la historia","next":null}); never an empty choices array.',
  '`emotion` fields (story_dialogue lines, story_scene, story_branch nodes) are OPTIONAL — if you write one it MUST be EXACTLY one of: neutral, happy, excited, thinking, surprised, encouraging, proud (never any other word, e.g. never "sad"/"confused"/"worried"/"curious"). If none of those fit, OMIT the field entirely rather than inventing one.',
  'Never write `explanation_md` (or any *_md field) as an empty string `""` — if you have nothing real to add, OMIT the field entirely; an empty string always fails validation.',
  'interest_peek segments ONLY: if `prediction.kind` is "choice", the answer is `correct_option_id` alone — OMIT `value`/`tolerance` entirely. If `prediction.kind` is "slider", the answer is `value` + `tolerance`, and `tolerance` MUST be a positive number greater than 0 (never 0) — pick something proportional to the values in play, e.g. 1-5 units.',
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
    'You expand an approved segment skeleton into a complete, gradeable lesson document.';

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
    'HARD RULES:',
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
        lastRawJson = json.value;
        const parsed = lessonDocumentSchema.safeParse(json.value);
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
    const parsed = lessonDocumentSchema.safeParse(json.value);
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
