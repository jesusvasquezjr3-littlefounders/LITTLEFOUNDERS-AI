// author stage — skeleton → a COMPLETE es-MX `GameDocument` + its server-only
// `GameValidation` sidecar (GAME_ENGINE.md §9, gamegen/AGENTS.md).
//
// The direct model is `coursegen/src/pipeline/write.ts`, which is battle-tested against
// real paid Forge runs; this is a port of that design, not a new one. What is carried
// over verbatim in shape:
//
//   1. A corrective-retry loop (max 4 attempts) that feeds TRUNCATED, actionable issues
//      back into the next call instead of failing the slot.
//   2. Feedback is APPENDED after the original messages, never spliced into them, so
//      attempts 2..N re-send a byte-identical leading prompt and bill as a DeepSeek
//      prefix-cache hit (~120x cheaper). `buildAuthorMessages` is therefore called ONCE
//      per slot and `withFeedback` only ever pushes a trailing user turn.
//   3. Deterministic SANITIZERS before every schema check (`stripNullValues`,
//      `repairAuthoredDocument`). Fighting a model over a value we can simply compute is
//      futile; sanitizing is free and reproducible.
//   4. The gates run INSIDE the loop through an injected gate function, so a gate
//      failure is feedback to the next attempt rather than a dead slot.
//   5. Per-ITEM salvage when the retries are exhausted (the twin of Forge's per-segment
//      salvage), then one last-resort regeneration at a lower temperature.
//
// WHY THE GATE IS INJECTED RATHER THAN IMPORTED: `gamegen/src/pipeline/gates.ts` is
// owned by another module and its `runAllGates(document, sidecar, ctx)` needs a gate
// context this stage has no business assembling. `run.ts` wires it in with a one-line
// lambda (`gate: (doc, sidecar) => runAllGates(doc, sidecar, gateCtx)`), which also
// keeps this stage unit-testable with a stub gate and no paid call.
//
// §1.9 (ABSOLUTE): every string this module sends to DeepSeek comes from the blueprint,
// the course catalog concept, the age TIER and the frozen playbook. `AuthorContext` has
// no field that can carry a user row, a child's name, a locale-specific personal detail
// or anything derived from one, and it must never grow one — there is no per-child
// generation path in Arcade.
//
// PROVIDER ERRORS PROPAGATE. Nothing here catches broadly: `BudgetExceededError` and
// `ProviderNotConfiguredError` escape `authorGameDocument` untouched, because a kill
// switch that is swallowed per item is not a kill switch (gamegen/AGENTS.md — Forge's
// `illustrateSegments` swallowed exactly this and kept paying past the cap).

import { completeDeepSeek } from '../providers/deepseek.js';
import type { UsageLedger } from '../providers/usage.js';
import { CHARACTER_IDS } from '../contract/core/characters.js';
import { DEFAULT_MAX_EVENTS_PER_TICK } from '../contract/core/replay.js';
import { parseGameDocumentSync } from '../contract/core/schema.js';
import {
  gameAdaptiveSchema,
  gameCategorySchema,
  gameInterludeSchema,
  gameItemSchema,
  gameMetaSchema,
  gameScoringSchema,
  gameSkinSchema,
  gameValidationSchema,
} from '../contract/core/schemaBase.js';
import { GAME_BGM, GAME_PALETTES, GAME_SFX, TICK_MS } from '../contract/core/types.js';
import type { GameDocument, GameTier, GameValidation } from '../contract/core/types.js';
import { GAME_PLAYBOOK, tierReasoningGuidance } from './gamePlaybook.js';
import { mechanicShapeExample, shapeExample } from './shapeExample.js';

// ---- Tunables ------------------------------------------------------------------

/** The single authoring locale. en-US and pt-BR come from `localize`, never from here. */
export const AUTHOR_LOCALE = 'es-MX';

export const MAX_AUTHOR_ATTEMPTS = 4;

/** Below this many surviving items a salvage is not a game any more — regenerate. */
export const MIN_SALVAGE_ITEMS = 4;

/** Issues fed back per attempt. More than this and the model starts fixing the list
 *  instead of the document (Forge's measured number, kept). */
const ISSUE_TRUNCATE = 6;

const AUTHOR_TEMPERATURE = 0.4;
/** The last-resort draw: lower temperature = more literal, less inventive. */
const LAST_RESORT_TEMPERATURE = 0.2;

/**
 * Completion budget. Sized for REASONING + ANSWER, not for the answer alone: a full
 * manifest (config ladder + up to 80 items with labels, values, props and
 * misconceptions + interludes + feedback) is several times a lesson document, and
 * DeepSeek's implicit default truncates mid-string rather than erroring — which
 * surfaces as `invalid JSON: Unterminated string` and burns a paid attempt.
 */
const AUTHOR_MAX_TOKENS = 16384;

/** Every simulator normalizes its score through `clampScore` (0..100), so the
 *  theoretical maximum is a CONSTANT of the engine, never a model judgement. */
const MAX_NORMALIZED_SCORE = 100;

/** Mirror of `gameValidationSchema.max_events`'s upper bound. Kept as a named constant
 *  so the derivation below is clamped rather than throwing a Zod error. */
const MAX_EVENTS_CEILING = 20000;

const MILLISECONDS_PER_MINUTE = 60_000;

// ---- Inputs / outputs ----------------------------------------------------------

/**
 * Everything the author prompt may know. Blueprint + catalog concept + age tier — and
 * deliberately nothing else (§1.9). Adding a field that could carry user data here is
 * a child-safety regression, not a feature.
 */
export interface AuthorContext {
  /** The blueprint's mechanic id. The BLUEPRINT decides the mechanic; the model only
   *  fills its config — so this is stamped onto the document, never asked for. */
  mechanic: string;
  /** Document slug = the publish upsert key. Stamped, never asked for. */
  slug: string;
  /** "<adventure>/<saga>/<topic>" — resolved against the Forge catalog by `validate`. */
  topicPath: string;
  tier: GameTier;
  /** Blueprint `difficulty` 1..5 — the ladder's intensity, distinct from the age tier. */
  difficulty: number;
  microObjective: string;
  skinBrief: string;
  /** Concept context read out of the bound Forge topic, when the run has it. */
  topic?: {
    concept?: string;
    learningObjective?: string;
    keyVocabulary?: readonly string[];
    /** What the LESSON already taught — a game reinforces, it never teaches cold. */
    priorKnowledge?: string;
  };
  courseTitle?: string;
}

/** One structured gate finding. Structurally compatible with `gates.ts`'s `GateProblem`
 *  (whose `gate` is a narrower numeric union) so `run.ts` can pass `runAllGates`
 *  through without adapting the shape. */
export interface AuthorGateProblem {
  gate: number | string;
  message: string;
  itemId?: string;
}

export interface AuthorGateReport {
  ok: boolean;
  problems: readonly AuthorGateProblem[];
}

/**
 * The deterministic gates, injected. Runs on a document that has ALREADY passed the
 * contract parse, so it never sees a malformed manifest.
 */
export type AuthorGateFn = (document: GameDocument, validation: GameValidation) => AuthorGateReport;

export interface AuthorInput {
  ctx: AuthorContext;
  /**
   * The `plan` stage's skeleton, rendered into the prompt as compact JSON.
   *
   * Typed `unknown` ON PURPOSE, and it is not an `any` in disguise: `plan.ts` owns that
   * shape, this stage only quotes it back to the model, and a structural coupling
   * between two independently-owned pipeline stages would break the moment either
   * evolves. Absent = author from the blueprint alone (the deterministic-skeleton pin
   * and the "plan was skipped" path both land here).
   */
  skeleton?: unknown;
}

export interface AuthorDeps {
  ledger?: UsageLedger;
  complete?: typeof completeDeepSeek;
  /** Wire `gates.ts` in here so gate failures become corrective feedback. */
  gate?: AuthorGateFn;
}

export interface AuthorResult {
  /** Client-safe manifest. The sidecar is NEVER inside it (GAME_ENGINE.md §3.2). */
  document: GameDocument;
  /** Server-only bounds, destined for `game_documents.validation`. */
  validation: GameValidation;
  attempts: number;
  /** True when the document came out of per-item salvage rather than a clean attempt. */
  salvaged: boolean;
  droppedItems: number;
  /** Deterministic repairs applied to the model's output, for the run log. */
  repairs: string[];
  /**
   * Whether the INJECTED gate passed inside the loop. `false` also means "not run":
   * the salvage and last-resort paths bypass the loop by design, exactly as Forge's
   * write stage does. The standalone `gate` stage in `run.ts` remains the authority —
   * never treat this flag as permission to skip it.
   */
  gatePassed: boolean;
}

// ---- Prompt: the byte-stable leading block -------------------------------------

const SYSTEM_PROMPT =
  'You are Arcade, the AUTHOR stage of an educational minigame generator for children (LittleFounders). ' +
  'You expand an approved game skeleton into a COMPLETE, playable game manifest: a JSON GameDocument that a ' +
  'prebuilt, deterministic game mechanic is skinned and parameterized by. There is no code in your output and ' +
  'no code will be written for this game — the manifest IS the game. Your job is not to satisfy the schema: it ' +
  'is to design a game a child genuinely wants to replay, whose concept lives in the VERB. Follow the GAME PLAYBOOK.';

/*
 * PREFIX-CACHE DISCIPLINE (gamegen/AGENTS.md). DeepSeek's context cache is automatic and
 * PREFIX-based, so the prompt is assembled static-first: playbook → tier guidance → these
 * frozen numbered rules → closed sets → the mechanic's shape block. Everything per-game
 * (blueprint, concept, skeleton) comes LAST, and corrective feedback is APPENDED as a new
 * trailing turn. Two consequences to respect when editing this list: never splice a
 * conditional into it (renumbering changes every following byte and voids the cache from
 * that point on), and treat a drop in the ledger's `cached_prompt_tokens` share after a
 * prompt edit as a cost regression even when quality holds.
 */
const HARD_RULES = [
  'Output STRICT JSON only, in exactly this envelope: {"document":{...},"validation":{"notes":"..."}}. No markdown fences, no prose outside the JSON.',
  '`document` has EXACTLY these top-level keys: schema_version (literal 1), meta, skin, config, content, scoring, and optionally adaptive. Nothing else.',
  'meta.slug, meta.mechanic, meta.tier and meta.concept.topic_path are GIVEN in the game context below — copy them verbatim. meta.locale is "es-MX". Write everything else (title, concept.recap_md, estimated_minutes, cast) yourself.',
  'meta.estimated_minutes is 2 to 5. meta.title is <=120 characters. meta.concept.recap_md is 1-2 sentences naming what the LESSON taught, in a child\'s words — never a restatement of the title.',
  'ART IS GENERATED DOWNSTREAM — NEVER invent a URL. `skin.sprites` MUST be the empty object {} and `skin.background_url` MUST be omitted entirely. A later stage draws every sprite FROM YOUR LABELS. Your job for the visual is to give each thing the child must recognize an `image_slot` from this mechanic\'s DECLARED SPRITE SLOTS (listed below) and a literal Material Symbols `icon` as the fallback. Any URL you write is deleted.',
  'CLOSED SETS ARE CLOSED: `skin.palette`, every `skin.sfx` value, `skin.bgm` and every `meta.cast` entry come from the lists below and nowhere else. An invented name is not a nice touch — an invalid sfx/bgm/cast entry is DELETED and an invalid palette FAILS the document.',
  'content.items holds 1 to 80 entries; content.categories 0 to 8; content.interludes 0 to 4. Every item id is unique, kebab-case, <=48 characters. Every item.category MUST reference a declared content.categories[].id. Every item.image_slot MUST be one of this mechanic\'s declared sprite slots.',
  'EVERY trap / wrong / avoid item MUST carry `misconception_md` naming the ONE specific, common kid misconception it diagnoses ("es un capricho, no algo que necesitas hoy"). A trap without a teaching reason is invalid output; a trap nobody would seriously pick diagnoses nothing.',
  'content.items[].props is numeric ONLY (Record<string, number>) — costs, hp, weight, speed. The deterministic gates re-execute your arithmetic, so every economy (budget vs prices, income vs costs, target vs the points the items can actually yield) must add up EXACTLY and be solvable with the items and the ladder you wrote.',
  'content.feedback.correct_md and content.feedback.incorrect_md are each 3 or 4 DISTINCT short lines (<=200 chars) that ROTATE — never one line repeated. incorrect_md is outcome-NEUTRAL and never punishing, shaming or loss-framed. content.feedback.results_md is one warm honest line, <=300 chars.',
  'scoring.mode is "cheer" or "arcade". In "cheer" mode scoring.lives MUST be null (there is no fail state — the tier-1 default). In "arcade" mode scoring.lives is an integer 1..9. scoring.xp_max is 5..50 and scoring.pass_score is 0..100: it MUST be reachable by the intended play and NOT reachable by mashing — a free bot gate plays your game and rejects it on either failure.',
  'If you include `adaptive`, `adaptive.assist_toggleable` is literally true (help is offered, never imposed) and `adaptive.ease_factor` is 0.5..1.',
  'The difficulty ladder in `config` must actually RAMP across levels/waves/rounds (spawn interval, speed, simultaneity, included item tiers, budget, tolerance). Difficulty comes from these numbers — NEVER from ambiguity, hidden information, or a fact revealed only after the player acts.',
  'NEVER emit any optional field as `null` — OMIT it entirely. The ONE exception is scoring.lives, where `null` is the meaning ("cheer mode, no lives"). Never emit an empty string `""` either: omit the field instead. Both are always validation failures.',
  '*_md fields use ONLY MarkdownLite: **bold**, *italic*, `code`, line breaks, "- " lists. No headings, no links, no raw HTML, no <script>, no data URI, no external host, no raw hex colour, no real-world brand.',
  'TEXT IS A HUD, NOT A PAGE: `label_md` is ONE short, literal, drawable object name a 6-year-old reads at a glance and a TTS voice says cleanly ("Manzana", "Boleto de 20 pesos") — never a sentence, never a pun, never an emoji, never an abbreviation ("c/u", "aprox.", "ml"): write the words out in full.',
  'Write everything in es-MX, warm and encouraging, at the reading level of the stated age tier. Never mock a wrong answer.',
  '`validation` is the SERVER-ONLY sidecar and you author exactly ONE field of it: `notes` (<=600 characters) — name the intended winning strategy and why mashing fails it. Every other bound (max_score, min_duration_seconds, max_events, item_values) is COMPUTED from your content by the pipeline; anything you write for them is ignored and overwritten, so do not spend tokens on them.',
];

function renderHardRules(): string {
  return HARD_RULES.map((rule, index) => `${index + 1}. ${rule}`).join('\n');
}

function renderClosedSets(): string {
  return [
    `PALETTES (skin.palette — pick exactly one): ${GAME_PALETTES.join(', ')}`,
    `SFX (skin.sfx values — the closed vocabulary; keys are your own engine event names): ${GAME_SFX.join(', ')}`,
    `BGM (skin.bgm): ${GAME_BGM.join(', ')}`,
    `CAST (meta.cast — the canon four, subset only, omit the field if no character appears): ${CHARACTER_IDS.join(', ')}`,
  ].join('\n');
}

/**
 * The shared (mechanic-independent) JSON shapes, derived from the REAL schemas so this
 * block can never drift from what the contract parse enforces. Without it `meta.title`,
 * `meta.estimated_minutes` and `scoring.xp_max` are the fields that go missing first —
 * the single largest failure category Forge measured, especially under retry pressure.
 */
function renderSharedShapes(): string {
  return [
    `meta: ${JSON.stringify(shapeExample(gameMetaSchema))}`,
    `skin: ${JSON.stringify(shapeExample(gameSkinSchema))}`,
    `scoring: ${JSON.stringify(shapeExample(gameScoringSchema))}`,
    `adaptive (OPTIONAL — omit the whole object if you do not want it): ${JSON.stringify(shapeExample(gameAdaptiveSchema))}`,
  ].join('\n');
}

interface MechanicShapes {
  config: unknown;
  content: unknown;
  spriteSlots: readonly string[];
}

function renderMechanicBlock(mechanic: string, shapes: MechanicShapes): string {
  const slots = shapes.spriteSlots.length > 0 ? shapes.spriteSlots.join(', ') : '(none declared — use `icon` only)';
  return [
    `MECHANIC: "${mechanic}" — this is fixed by the blueprint; do not change it.`,
    `DECLARED SPRITE SLOTS (the ONLY values \`image_slot\` may take for this mechanic, and the ONLY legal keys of skin.sprites): ${slots}`,
    '',
    'EXACT JSON SHAPE for `document.config` (field names, nesting, enum options and cardinality are LAW — never invent, rename or move a field). Placeholder values only: the real numbers are your design. Where a field is a union, only its FIRST member is shown; the other members of that union are equally valid, but every field name you use must exist in this mechanic\'s schema:',
    JSON.stringify(shapes.config),
    '',
    'EXACT JSON SHAPE for `document.content` (the shared fields plus this mechanic\'s own extras — every extra shown here is REQUIRED by this mechanic):',
    JSON.stringify(shapes.content),
  ].join('\n');
}

// ---- Prompt: the per-game tail -------------------------------------------------

/** Cap on the rendered skeleton. A runaway plan must not push the static prefix out of
 *  the model's attention (or the budget); the blueprint below it is the real anchor. */
const SKELETON_CHAR_CAP = 4000;

function renderSkeleton(skeleton: unknown): string {
  if (skeleton === undefined || skeleton === null) {
    return '(no skeleton — design the manifest from the blueprint alone)';
  }
  let json: string;
  try {
    json = JSON.stringify(skeleton);
  } catch {
    // A skeleton that cannot be serialized (a cycle) is a plan-stage bug, but it must
    // not take a paid slot down inside a prompt build.
    return '(skeleton could not be serialized — design the manifest from the blueprint alone)';
  }
  if (json === undefined) return '(no skeleton — design the manifest from the blueprint alone)';
  return json.length > SKELETON_CHAR_CAP ? `${json.slice(0, SKELETON_CHAR_CAP)}… (truncated)` : json;
}

function renderGameContext(input: AuthorInput): string {
  const { ctx } = input;
  const lines = [
    'GAME CONTEXT (everything above is the same for every game in this run; everything below is THIS game):',
    `Age tier: ${ctx.tier}`,
    `Blueprint difficulty (1-5, the ladder's intensity — NOT the age tier): ${ctx.difficulty}`,
    `Mechanic (fixed): ${ctx.mechanic}`,
    `meta.slug (copy verbatim): ${ctx.slug}`,
    `meta.concept.topic_path (copy verbatim): ${ctx.topicPath}`,
    `meta.locale (copy verbatim): ${AUTHOR_LOCALE}`,
    `Micro-objective — the ONE thing this game consolidates: ${ctx.microObjective}`,
    `Skin brief (setting, props, look — prose for you and for the illustrator downstream): ${ctx.skinBrief}`,
  ];
  if (ctx.courseTitle !== undefined) lines.push(`Course: ${ctx.courseTitle}`);
  if (ctx.topic?.concept !== undefined) lines.push(`Topic concept: ${ctx.topic.concept}`);
  if (ctx.topic?.learningObjective !== undefined) {
    lines.push(`Learning objective of the bound lesson: ${ctx.topic.learningObjective}`);
  }
  if (ctx.topic?.keyVocabulary !== undefined && ctx.topic.keyVocabulary.length > 0) {
    lines.push(`Key vocabulary: ${ctx.topic.keyVocabulary.join(', ')}`);
  }
  if (ctx.topic?.priorKnowledge !== undefined) {
    lines.push(
      `Already taught (the child passed this lesson before the game unlocked — REINFORCE it, never teach it cold): ${ctx.topic.priorKnowledge}`,
    );
  }
  lines.push('', 'SKELETON approved by the plan stage (expand it — item/category counts, ladder shape, rounds, interludes):', renderSkeleton(input.skeleton));
  return lines.join('\n');
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Built ONCE per slot. Static-first, per-game last — see the prefix-cache note above
 * HARD_RULES. Exported so a test can assert the ordering without a paid call.
 */
export function buildAuthorMessages(input: AuthorInput, shapes: MechanicShapes): ChatMessage[] {
  const user = [
    GAME_PLAYBOOK,
    '',
    `AGE-TIER REASONING CEILING for THIS game — ${tierReasoningGuidance(input.ctx.tier)}`,
    '',
    'HARD RULES (mechanical constraints — the playbook above is the quality bar; these are the non-negotiable format rules):',
    renderHardRules(),
    '',
    'CLOSED SETS (any value outside these lists is invalid):',
    renderClosedSets(),
    '',
    'EXACT top-level JSON SHAPES shared by every mechanic — ALL fields shown are REQUIRED unless marked optional:',
    renderSharedShapes(),
    '',
    renderMechanicBlock(input.ctx.mechanic, shapes),
    '',
    renderGameContext(input),
  ].join('\n');

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: user },
  ];
}

const FEEDBACK_PREFIX =
  'Your previous JSON failed validation. Fix these issues and resend the FULL corrected JSON envelope ({"document":…,"validation":…}):\n';

/**
 * Corrective feedback is APPENDED, never merged into the original turns: attempts 2..N
 * must re-send a byte-identical leading prompt or the whole prefix cache is voided.
 */
function withFeedback(base: readonly ChatMessage[], issues: string | undefined): ChatMessage[] {
  if (issues === undefined) return [...base];
  return [...base, { role: 'user', content: `${FEEDBACK_PREFIX}${issues}` }];
}

// ---- Small structural helpers --------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

export function safeJsonParse(raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function truncateIssues(issues: readonly string[]): string {
  return issues.slice(0, ISSUE_TRUNCATE).join('; ');
}

// ---- Sanitizer 1: nulls --------------------------------------------------------

/**
 * `lives` is the ONE key where `null` is the meaning, not "the model meant to omit
 * this": cheer mode REQUIRES `scoring.lives === null` (schemaBase refines on it), and
 * stripping it would turn a valid cheer document into `expected number, received
 * undefined` on every retry — the exact trap Forge hit with story_branch's `next`.
 */
const SEMANTIC_NULL_KEYS = new Set(['lives']);

/**
 * Recursively drops `null` values and empty strings. DeepSeek stubbornly emits both for
 * optional fields it means to omit, and does it AGAIN on corrective retries even with
 * the Zod error fed back and a hard rule forbidding it. A `null`/`""` on an OPTIONAL
 * field becomes "absent" → valid; on a REQUIRED field it becomes "missing" → still a
 * Zod error, correctly. Empty strings inside string arrays (the rotating feedback
 * lines) are filtered out rather than kept, since `min(1)` would reject them anyway and
 * a shorter valid array is a better outcome than a dead slot.
 */
export function stripNullValues(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.filter((entry) => entry !== null && entry !== '').map(stripNullValues);
  }
  const record = asRecord(node);
  if (record === null) return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (SEMANTIC_NULL_KEYS.has(key)) {
      out[key] = value === null ? null : stripNullValues(value);
      continue;
    }
    if (value === null || value === '') continue;
    out[key] = stripNullValues(value);
  }
  return out;
}

// ---- Sanitizer 2: deterministic repairs ----------------------------------------

function normalizeIconName(value: string): string | null {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return /^[a-z0-9_]+$/.test(normalized) ? normalized : null;
}

function slotKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** Exact match, else a normalized match, else `null` (the caller drops the field). */
function snapSpriteSlot(value: string, slots: readonly string[]): string | null {
  if (slots.includes(value)) return value;
  const key = slotKey(value);
  for (const slot of slots) {
    if (slotKey(slot) === key) return slot;
  }
  return null;
}

/**
 * The deterministic repairs — the "sanitize, don't argue" half of this stage. Each one
 * fixes a value the model has NO information we lack about, or one whose only honest
 * repair is deletion. Anything that needs judgement is left alone and reported as an
 * issue instead.
 *
 * WHAT IS STAMPED (the model is told to copy these and they are set regardless):
 *   schema_version, meta.locale, meta.slug, meta.mechanic, meta.tier,
 *   meta.concept.topic_path — all constants of the slot. Forge lost whole lessons at
 *   scale to `schema_version: "1"` coming back from a last-resort regen; losing a paid
 *   game manifest over a field with exactly one legal value is indefensible.
 * WHAT IS PURGED:
 *   skin.sprites / skin.background_url (art is generated downstream from the labels —
 *   any URL here is invented, and an invented external host is forbidden outright);
 *   out-of-vocabulary sfx values and bgm (decorative — degrade to silence, which
 *   core/audio.ts already treats as a valid state, instead of killing the document);
 *   non-canon cast entries; unnormalizable icons; image_slots that no sprite slot of
 *   this mechanic declares (they could never render).
 * WHAT IS DERIVED:
 *   scoring.lives := null in cheer mode; adaptive.assist_toggleable := true.
 */
export function repairAuthoredDocument(
  raw: unknown,
  ctx: AuthorContext,
  spriteSlots: readonly string[],
): { document: unknown; repairs: string[] } {
  const repairs: string[] = [];
  const document = asRecord(raw);
  if (document === null) return { document: raw, repairs };

  if (document.schema_version !== 1) {
    document.schema_version = 1;
    repairs.push('schema_version := 1');
  }
  // The sidecar must NEVER live inside the client document (GAME_ENGINE.md §3.2). If
  // the model nested it, drop it here — `deriveValidation` builds the real one.
  if ('validation' in document) {
    delete document.validation;
    repairs.push('document.validation removed (the sidecar is server-only, never inside the document)');
  }

  const meta = asRecord(document.meta);
  if (meta !== null) {
    const stamp = (key: string, value: string | number): void => {
      if (meta[key] !== value) {
        meta[key] = value;
        repairs.push(`meta.${key} := ${String(value)}`);
      }
    };
    stamp('locale', AUTHOR_LOCALE);
    stamp('slug', ctx.slug);
    stamp('mechanic', ctx.mechanic);
    stamp('tier', ctx.tier);

    const concept = asRecord(meta.concept);
    if (concept !== null && concept.topic_path !== ctx.topicPath) {
      concept.topic_path = ctx.topicPath;
      repairs.push(`meta.concept.topic_path := ${ctx.topicPath}`);
    }

    const cast = asArray(meta.cast);
    if (cast !== null) {
      const canon: readonly string[] = CHARACTER_IDS;
      const kept = cast.filter((id): id is string => typeof id === 'string' && canon.includes(id));
      if (kept.length !== cast.length) repairs.push('meta.cast: dropped non-canon character ids');
      if (kept.length === 0) delete meta.cast;
      else meta.cast = kept;
    }
  }

  const skin = asRecord(document.skin);
  if (skin !== null) {
    const sprites = asRecord(skin.sprites);
    if (sprites === null || Object.keys(sprites).length > 0) {
      skin.sprites = {};
      if (sprites !== null && Object.keys(sprites).length > 0) {
        repairs.push('skin.sprites := {} (sprite URLs are written by the illustrate stage, never authored)');
      }
    }
    if ('background_url' in skin) {
      delete skin.background_url;
      repairs.push('skin.background_url removed (generated downstream)');
    }
    const sfx = asRecord(skin.sfx);
    if (sfx !== null) {
      const vocabulary: readonly string[] = GAME_SFX;
      let dropped = 0;
      for (const key of Object.keys(sfx)) {
        const value = sfx[key];
        if (typeof value !== 'string' || !vocabulary.includes(value)) {
          delete sfx[key];
          dropped += 1;
        }
      }
      if (dropped > 0) repairs.push(`skin.sfx: dropped ${dropped} out-of-vocabulary sound name(s)`);
      if (Object.keys(sfx).length === 0) delete skin.sfx;
    }
    const bgmVocabulary: readonly string[] = GAME_BGM;
    if ('bgm' in skin && (typeof skin.bgm !== 'string' || !bgmVocabulary.includes(skin.bgm))) {
      delete skin.bgm;
      repairs.push('skin.bgm removed (not a closed bgm id)');
    }
  }

  const content = asRecord(document.content);
  if (content !== null) {
    for (const entry of asArray(content.items) ?? []) {
      repairIconAndSlot(asRecord(entry), spriteSlots, repairs, 'content.items');
    }
    for (const entry of asArray(content.categories) ?? []) {
      repairIconAndSlot(asRecord(entry), spriteSlots, repairs, 'content.categories');
    }
  }

  const scoring = asRecord(document.scoring);
  if (scoring !== null && scoring.mode === 'cheer' && scoring.lives !== null) {
    scoring.lives = null;
    repairs.push('scoring.lives := null (cheer mode has no fail state)');
  }

  const adaptive = asRecord(document.adaptive);
  if (adaptive !== null && adaptive.assist_toggleable !== true) {
    adaptive.assist_toggleable = true;
    repairs.push('adaptive.assist_toggleable := true (help is offered, never imposed)');
  }

  return { document, repairs };
}

function repairIconAndSlot(
  entry: Record<string, unknown> | null,
  spriteSlots: readonly string[],
  repairs: string[],
  where: string,
): void {
  if (entry === null) return;
  // Name the offending entry in the repair line: a run log that says "some item lost
  // its icon" is not actionable, and these lines are read by a human reviewing a run.
  const at = typeof entry.id === 'string' ? `${where}[${entry.id}]` : where;

  if (typeof entry.icon === 'string') {
    const original = entry.icon;
    const normalized = normalizeIconName(original);
    if (normalized === null) {
      delete entry.icon;
      repairs.push(`${at}: dropped unusable icon "${original}"`);
    } else if (normalized !== original) {
      entry.icon = normalized;
      repairs.push(`${at}: icon "${original}" normalized to "${normalized}"`);
    }
  }

  if (typeof entry.image_slot === 'string') {
    const original = entry.image_slot;
    const snapped = snapSpriteSlot(original, spriteSlots);
    if (snapped === null) {
      // An undeclared slot can never be bound by `illustrate` and would silently never
      // render; the item falls back to its icon, which is a real state the engine draws.
      delete entry.image_slot;
      repairs.push(`${at}: dropped image_slot "${original}" (not a declared sprite slot)`);
    } else if (snapped !== original) {
      entry.image_slot = snapped;
      repairs.push(`${at}: image_slot "${original}" snapped to "${snapped}"`);
    }
  }
}

// ---- The sidecar: COMPUTED, not invented ---------------------------------------

/**
 * The theoretical maximum number of ticks a run of this document may span, from
 * `meta.estimated_minutes` and the engine's fixed `TICK_MS`. Same arithmetic the
 * `simulate` gate and Core's replay use, so the bounds below are in the replay's units.
 */
export function maxTicksFor(estimatedMinutes: number): number {
  return Math.ceil((estimatedMinutes * MILLISECONDS_PER_MINUTE) / TICK_MS);
}

/**
 * Build `game_documents.validation` from the AUTHORED CONTENT. This is the "derived,
 * not invented" rule the sidecar exists under, and the split is deliberate:
 *
 * COMPUTED HERE (anything the model writes for these is ignored and overwritten):
 *  - `max_score` = 100. Every mechanic normalizes its score through `clampScore`
 *    (contract/core/scoring.ts), so the ceiling is a constant of the engine, not a
 *    judgement. Asking for it would only create a way to get it wrong.
 *  - `max_events` = (maxTicks + 1) × the replay's own per-tick input budget
 *    (`DEFAULT_MAX_EVENTS_PER_TICK`), clamped to the schema ceiling. Derived from the
 *    SAME constant `replayGame()` falls back to, so the authored bound can never be
 *    tighter than the engine's own notion of a legal log — a bound below what an honest
 *    perfect run needs would reject real children at `POST /complete`.
 *  - `min_duration_seconds` = 0 at author time, ON PURPOSE. A lower bound is only
 *    honest once something has actually PLAYED the game, and that is the free `simulate`
 *    stage (it runs the perfect bot and knows the tick count); this stage would be
 *    guessing, and a guessed floor set too high permanently rejects an honest fast
 *    player. 0 forfeits nothing the replay does not already enforce: the input log's
 *    tick range and `max_events` are the real envelope.
 *  - `item_values` = every authored item's numeric `value`, keyed by item id. Pure
 *    projection of the content — the model cannot know it better than the content does.
 *
 * ASKED OF THE MODEL (the only field that genuinely requires judgement):
 *  - `notes` — the intended winning strategy and why mashing fails it. Prose about
 *    design intent, readable by the judge stage, the run log and a human reviewer.
 */
export function deriveValidation(document: GameDocument, notes?: string): GameValidation {
  const itemValues: Record<string, number> = {};
  for (const item of document.content.items) {
    if (typeof item.value === 'number' && Number.isFinite(item.value)) itemValues[item.id] = item.value;
  }
  const ticks = maxTicksFor(document.meta.estimated_minutes);
  const maxEvents = Math.max(1, Math.min(MAX_EVENTS_CEILING, (ticks + 1) * DEFAULT_MAX_EVENTS_PER_TICK));

  const validation: GameValidation = {
    max_score: MAX_NORMALIZED_SCORE,
    min_duration_seconds: 0,
    max_events: maxEvents,
  };
  if (Object.keys(itemValues).length > 0) validation.item_values = itemValues;
  const trimmed = notes?.trim();
  if (trimmed !== undefined && trimmed.length > 0) validation.notes = trimmed.slice(0, 600);
  return validation;
}

// ---- One attempt ---------------------------------------------------------------

type AttemptOutcome =
  | { ok: true; document: GameDocument; validation: GameValidation; repairs: string[]; gatePassed: boolean }
  | { ok: false; issues: string; repaired?: unknown; repairs: string[] };

/**
 * Unwrap `{document, validation}`. The model periodically returns the bare document
 * instead of the envelope; that is a shape mistake with an unambiguous deterministic
 * fix, so it is tolerated rather than charged a retry.
 */
function unwrapEnvelope(value: unknown): { document: unknown; notes?: string } {
  const record = asRecord(value);
  if (record === null) return { document: value };
  const hasEnvelope = 'document' in record && asRecord(record.document) !== null;
  const document = hasEnvelope ? record.document : record;
  const sidecar = asRecord(record.validation);
  const notes = typeof sidecar?.notes === 'string' ? sidecar.notes : undefined;
  return notes === undefined ? { document } : { document, notes };
}

/** Parse → sanitize → contract-validate → derive the sidecar → gate. Free and pure. */
export function evaluateAttempt(
  rawContent: string,
  input: AuthorInput,
  spriteSlots: readonly string[],
  gate?: AuthorGateFn,
): AttemptOutcome {
  const json = safeJsonParse(rawContent);
  if (!json.ok) {
    if (process.env.ARCADE_DEBUG_AUTHOR) console.error('DEBUG raw author output (unparseable):', rawContent);
    return { ok: false, issues: `invalid JSON: ${json.error}`, repairs: [] };
  }

  const envelope = unwrapEnvelope(json.value);
  const sanitized = stripNullValues(envelope.document);
  const { document: repaired, repairs } = repairAuthoredDocument(sanitized, input.ctx, spriteSlots);

  const parsed = parseGameDocumentSync(repaired);
  if (!parsed.ok) {
    if (process.env.ARCADE_DEBUG_AUTHOR) console.error('DEBUG repaired author output:', JSON.stringify(repaired, null, 2));
    return { ok: false, issues: truncateIssues(parsed.issues), repaired, repairs };
  }

  const validation = deriveValidation(parsed.document, envelope.notes);
  // Belt and braces: the sidecar is computed here, so a failure means THIS code is
  // wrong, not the model — surface it as an issue rather than persisting it unvalidated.
  const validationParsed = gameValidationSchema.safeParse(validation);
  if (!validationParsed.success) {
    return {
      ok: false,
      issues: truncateIssues(
        validationParsed.error.issues.map((issue) => `validation.${issue.path.join('.') || '(root)'}: ${issue.message}`),
      ),
      repaired,
      repairs,
    };
  }

  if (gate) {
    const report = gate(parsed.document, validationParsed.data);
    if (!report.ok) {
      // Gate messages are written to be ACTED ON: they name the field, the expected
      // value and the observed one. Forge threw these away and lost whole slots to
      // one-line fixable problems (2026-07-13) before its gates moved inside this loop.
      const issues = report.problems.map(
        (problem) => `[gate ${String(problem.gate)}${problem.itemId ? ` @${problem.itemId}` : ''}] ${problem.message}`,
      );
      return { ok: false, issues: truncateIssues(issues), repaired, repairs };
    }
  }

  return { ok: true, document: parsed.document, validation: validationParsed.data, repairs, gatePassed: gate !== undefined };
}

// ---- Per-item salvage ----------------------------------------------------------

interface SalvageOutcome {
  document: GameDocument;
  dropped: number;
}

/**
 * The twin of Forge's per-segment salvage: when the retries are exhausted, keep the
 * items that DID validate individually and drop the rest rather than losing a paid
 * document to two malformed entries.
 *
 * Conservative by construction: an item whose category was dropped goes too (a dangling
 * reference is a contract failure, and silently unbinding it would change what the item
 * MEANS to the mechanic), and the survivor set must still pass the full contract parse.
 * Salvage deliberately does NOT re-run the gate — that is the standalone `gate` stage's
 * job, and the free `simulate` bot gate independently rejects a salvaged manifest that
 * stopped being winnable. Nothing here can publish an ungated game.
 */
export function trySalvage(
  raw: unknown,
  ctx: AuthorContext,
  spriteSlots: readonly string[],
): SalvageOutcome | null {
  const document = asRecord(raw);
  if (document === null) return null;
  const content = asRecord(document.content);
  if (content === null) return null;

  let dropped = 0;

  const categories = asArray(content.categories);
  if (categories !== null) {
    const kept = categories.filter((entry) => gameCategorySchema.safeParse(entry).success);
    dropped += categories.length - kept.length;
    if (kept.length === 0) delete content.categories;
    else content.categories = kept;
  }
  const survivingCategories = new Set(
    (asArray(content.categories) ?? []).flatMap((entry) => {
      const id = asRecord(entry)?.id;
      return typeof id === 'string' ? [id] : [];
    }),
  );

  const items = asArray(content.items);
  if (items === null) return null;
  const seenIds = new Set<string>();
  const keptItems: unknown[] = [];
  for (const entry of items) {
    const parsed = gameItemSchema.safeParse(entry);
    if (!parsed.success) {
      dropped += 1;
      continue;
    }
    const item = parsed.data;
    if (seenIds.has(item.id)) {
      dropped += 1;
      continue;
    }
    if (item.category !== undefined && !survivingCategories.has(item.category)) {
      dropped += 1;
      continue;
    }
    seenIds.add(item.id);
    keptItems.push(entry);
  }
  if (keptItems.length < MIN_SALVAGE_ITEMS) return null;
  content.items = keptItems;

  const interludes = asArray(content.interludes);
  if (interludes !== null) {
    const kept = interludes.filter((entry) => gameInterludeSchema.safeParse(entry).success);
    dropped += interludes.length - kept.length;
    if (kept.length === 0) delete content.interludes;
    else content.interludes = kept;
  }

  // Re-stamp the constants: salvage runs on the LAST repaired payload, but a
  // last-resort regen may have supplied a fresh (unrepaired) one. The mechanic's real
  // slot list has to come along — repairing against an empty list would delete every
  // `image_slot` in the document and quietly strip the art out of a salvaged game.
  const { document: restamped } = repairAuthoredDocument(document, ctx, spriteSlots);
  const parsed = parseGameDocumentSync(restamped);
  if (!parsed.ok) return null;
  return { document: parsed.document, dropped };
}

// ---- The stage -----------------------------------------------------------------

/**
 * Author one complete es-MX `GameDocument` + its server-only sidecar.
 *
 * PAID: one DeepSeek call per attempt (max `MAX_AUTHOR_ATTEMPTS`, plus at most one
 * last-resort regeneration). Every call goes through `completeDeepSeek`, which runs
 * `ledger.checkBudget()` first and records usage after — and whose `BudgetExceededError`
 * / `ProviderNotConfiguredError` propagate out of this function untouched.
 *
 * Never returns unvalidated model output: every returned document has passed
 * `parseGameDocumentSync` against the mechanic's REAL config/content schemas, and every
 * returned sidecar has passed `gameValidationSchema`.
 */
export async function authorGameDocument(input: AuthorInput, deps: AuthorDeps = {}): Promise<AuthorResult> {
  const complete = deps.complete ?? completeDeepSeek;

  const shapes = mechanicShapeExample(input.ctx.mechanic);
  if (shapes === null) {
    // BEFORE any paid call: a mechanic Arcade cannot look up is one it cannot bot-play,
    // and an ungated game must never be authored, let alone published.
    throw new Error(
      `author stage: unknown or unimplemented mechanic "${input.ctx.mechanic}" — refusing to author a game the winnability gate cannot play`,
    );
  }

  const baseMessages = buildAuthorMessages(input, shapes);

  let issues: string | undefined;
  let lastRepaired: unknown;
  let lastRepairs: string[] = [];

  for (let attempt = 1; attempt <= MAX_AUTHOR_ATTEMPTS; attempt += 1) {
    const response = await complete(
      { messages: withFeedback(baseMessages, issues), temperature: AUTHOR_TEMPERATURE, jsonMode: true, maxTokens: AUTHOR_MAX_TOKENS },
      { operation: 'author', ledger: deps.ledger },
    );
    const outcome = evaluateAttempt(response.content, input, shapes.spriteSlots, deps.gate);
    if (outcome.ok) {
      return {
        document: outcome.document,
        validation: outcome.validation,
        attempts: attempt,
        salvaged: false,
        droppedItems: 0,
        repairs: outcome.repairs,
        gatePassed: outcome.gatePassed,
      };
    }
    issues = outcome.issues;
    if (outcome.repaired !== undefined) lastRepaired = outcome.repaired;
    lastRepairs = outcome.repairs;
  }

  // Corrective retries exhausted — salvage whatever items DID validate.
  if (lastRepaired !== undefined) {
    const salvage = trySalvage(lastRepaired, input.ctx, shapes.spriteSlots);
    if (salvage) {
      return {
        document: salvage.document,
        validation: deriveValidation(salvage.document),
        attempts: MAX_AUTHOR_ATTEMPTS,
        salvaged: true,
        droppedItems: salvage.dropped,
        repairs: lastRepairs,
        gatePassed: false,
      };
    }
  }

  // Last resort: one regeneration at a lower, more literal temperature. The gate is not
  // applied here (as in Forge's write stage) — the standalone `gate` and `simulate`
  // stages are the authority, and a document that reaches them is strictly better than
  // a dead slot.
  const lastResort = await complete(
    { messages: withFeedback(baseMessages, issues), temperature: LAST_RESORT_TEMPERATURE, jsonMode: true, maxTokens: AUTHOR_MAX_TOKENS },
    { operation: 'author-last-resort', ledger: deps.ledger },
  );
  const outcome = evaluateAttempt(lastResort.content, input, shapes.spriteSlots, undefined);
  if (outcome.ok) {
    return {
      document: outcome.document,
      validation: outcome.validation,
      attempts: MAX_AUTHOR_ATTEMPTS + 1,
      salvaged: false,
      droppedItems: 0,
      repairs: outcome.repairs,
      gatePassed: false,
    };
  }
  issues = outcome.issues;
  if (outcome.repaired !== undefined) {
    const salvage = trySalvage(outcome.repaired, input.ctx, shapes.spriteSlots);
    if (salvage) {
      return {
        document: salvage.document,
        validation: deriveValidation(salvage.document),
        attempts: MAX_AUTHOR_ATTEMPTS + 1,
        salvaged: true,
        droppedItems: salvage.dropped,
        repairs: outcome.repairs,
        gatePassed: false,
      };
    }
  }

  throw new Error(
    `author stage: exhausted ${MAX_AUTHOR_ATTEMPTS} corrective attempts, per-item salvage and the last-resort regen for slot "${input.ctx.slug}". Last issues: ${issues ?? 'unknown'}`,
  );
}
