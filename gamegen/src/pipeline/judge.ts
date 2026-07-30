// `judge` stage — the INDEPENDENT quality judge for a game manifest
// (GAME_ENGINE.md §9, gamegen/AGENTS.md "Pipeline shape"). Port of
// `coursegen/src/pipeline/review.ts`, which is battle-tested against real paid
// Forge runs; the design here is inherited, not invented.
//
// WHY QWEN AND NOT DEEPSEEK. The author is DeepSeek; the judge is Qwen. A judge
// sharing the author's provider shares the author's blind spots, so a bad design
// the author cannot see is a bad design the judge cannot see either. Splitting
// the two providers decorrelates the failure modes — this is why
// `providers/qwen.ts` exists at all and why swapping the judge onto the author's
// provider "for consistency" would quietly delete the stage's value.
//
// ────────────────────────────────────────────────────────────────────────────
// THE SCORES ARE DEFECT POINTERS, NOT AN OPTIMIZATION TARGET. READ THIS BEFORE
// TOUCHING A FLOOR OR REPORTING A MEAN.
//
// coursegen/AGENTS.md rule 15, measured 2026-07-24: the same 62-lesson review
// was run three times. Between rounds 2 and 3, on the 56 lessons whose content
// was BYTE-IDENTICAL, mean clarity moved 4.30 → 3.93 and child_fit 4.23 → 3.77,
// and 10 lessons flipped a BINARY verdict (`solvable_from_screen` true → false)
// with no content change at all. An LLM panel therefore has a ±0.4 noise floor
// and can flip a boolean on identical bytes.
//
// Consequences, all of them load-bearing here:
//   - A run-over-run delta in any mean (or in "how many slots passed") is
//     MEASUREMENT NOISE, never evidence of progress. Never report one as a
//     result, never gate a release on one, never tune a prompt until the mean
//     goes up — that is Goodhart bait: the number moves, the games do not.
//   - What the panel IS excellent at is surfacing specific, reproducible
//     defects. `notes` is the valuable output of this stage; the five integers
//     are a routing signal that decides whether to revise, escalate or ship.
//   - The floors below are deliberately coarse (3/4/5) precisely because a
//     ±0.4 instrument cannot support a finer one. Do not add a 3.5.
//   - Everything this module prints carries that caveat inline
//     (`RUBRIC_NOISE_NOTE`), so a rubric line pasted into a report arrives with
//     its own health warning attached.
//
// The durable quality controls are elsewhere and are deterministic: the Zod
// contract, the `gate` stage, the free `simulate` bot-play winnability gate —
// and the blocking human publish gate, which nothing in this file replaces.
// ────────────────────────────────────────────────────────────────────────────
//
// KID SAFETY IS AN ESCALATION, NOT A REVISE. Every other failing dimension
// enters the bounded revise loop. `kid_safety` below its floor exits
// immediately with `GameJudgeEscalationError`: asking the model that wrote the
// unsafe content to patch its own safety verdict, then asking a judge to
// re-bless it, is not a control — it is a loop that terminates on a number
// rather than on a human looking. §1.9 makes the human layer non-optional, so a
// safety miss is routed AT it. (Given the noise floor above, an escalation is a
// POINTER — "a human must look at this slot" — never a claim that the content
// is unsafe.)

import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

import { parseGameDocumentSync } from '../contract/core/schema.js';
import type { GameDocument } from '../contract/core/types.js';
import { completeDeepSeek } from '../providers/deepseek.js';
import { completeQwen } from '../providers/qwen.js';
import type { UsageLedger } from '../providers/usage.js';
import { safeJsonParse, withCorrectiveRetry } from './correctiveRetry.js';
import { GAME_PLAYBOOK, JUDGE_PLAYBOOK_ANCHORS, tierReasoningGuidance } from './gamePlaybook.js';
import { mechanicShapeExample } from './shapeExample.js';

/**
 * Mirrors Forge's `MAX_REVISE_CYCLES = 3` (raised from 2 there because a playbook
 * judge is strict on several axes at once and a single revise routinely fixes one
 * while regressing another). The EARLY STOP below is what keeps the cap from
 * being a licence to burn it: on Forge's real 62-slot QA regen, 14 slots burned
 * all 3 cycles and failed anyway, so a non-improving trajectory is cut short and
 * the outer from-scratch retry (`ARCADE_SLOT_ATTEMPTS`) gets those tokens instead.
 */
export const MAX_REVISE_CYCLES = 3;
/** Schema-corrective attempts for ONE judge call (invalid JSON → resend). */
const MAX_JUDGE_ATTEMPTS = 2;
/** Schema-corrective attempts for ONE revise call. */
const MAX_REVISE_ATTEMPTS = 3;
/**
 * A revise resends the FULL manifest, and a manifest may carry 80 items plus a
 * deeply nested config — the same silent-truncation risk `write.ts` sizes for in
 * Forge. `openaiChat` already treats `finish_reason === 'length'` as starvation
 * rather than an answer, so this is the budget, not a hope.
 */
const REVISE_MAX_TOKENS = 8192;
/** Notes are truncated in the log only — the live loop always sees them whole. */
const NOTES_TRUNCATE = 600;

// ---- The rubric ------------------------------------------------------------

/**
 * The five dimensions pinned by GAME_ENGINE.md §9 and gamegen/AGENTS.md. Bounds
 * are validated, not trusted: model output is input (§1.14), and an out-of-range
 * score would silently pass or fail a gate built on `<` comparisons.
 *
 * Non-integer scores are ACCEPTED (a 4.5 is a real signal, not a malformed
 * reply): rejecting them would spend a corrective retry on a rounding opinion.
 */
export const gameRubricSchema = z.object({
  /** Does the concept live in the VERB? The swap test — see JUDGE_PLAYBOOK_ANCHORS. */
  concept_fit: z.number().min(1).max(5),
  /** A real decision each round, a ladder that ramps, feedback that rotates. */
  fun_agency: z.number().min(1).max(5),
  /** Labels drawable and TTS-safe; every fact needed to decide visible BEFORE acting. */
  clarity: z.number().min(1).max(5),
  /** HARD FLOOR, and an escalation rather than a revise — see the header. */
  kid_safety: z.number().min(1).max(5),
  /** Difficulty from the config ladder, never from ambiguity; tier-correct abstraction. */
  difficulty_fairness: z.number().min(1).max(5),
  /**
   * The genuinely valuable output of this stage (see the noise-floor note): the
   * specific, reproducible defects. Bounded so one runaway reply cannot blow the
   * revise prompt's token budget.
   */
  notes: z.string().min(1).max(2000),
});
export type GameRubric = z.infer<typeof gameRubricSchema>;

export const JUDGE_DIMENSIONS = [
  'kid_safety',
  'concept_fit',
  'clarity',
  'fun_agency',
  'difficulty_fairness',
] as const;
export type JudgeDimension = (typeof JUDGE_DIMENSIONS)[number];

/**
 * Coarse on purpose (see the noise-floor note): a ±0.4 instrument cannot support
 * a finer scale, and the same 5/4/4/3/3 profile Forge converged on.
 *
 * - `kid_safety: 5` — the anchors tell the judge that ANY single safety "no"
 *   means 1, so anything under 5 is the judge saying it saw something. Escalates.
 * - `concept_fit: 4` and `clarity: 4` — the two dimensions that decide whether
 *   this is a learning game at all (a reskin that survives the swap test) and
 *   whether a child can play it (a HUD inside a moving canvas is unforgiving).
 * - `fun_agency: 3` and `difficulty_fairness: 3` — "not below average"; the
 *   deterministic `simulate` bot gate already proved winnability mechanically,
 *   so these two carry a judgement the free gates cannot make, not a duplicate.
 */
export const JUDGE_FLOORS: Record<JudgeDimension, number> = {
  kid_safety: 5,
  concept_fit: 4,
  clarity: 4,
  fun_agency: 3,
  difficulty_fairness: 3,
};

/** The caveat every printed/serialized rubric carries with it. */
export const RUBRIC_NOISE_NOTE =
  'judge scores have a measured ±0.4 run-over-run noise floor and can flip binary verdicts on ' +
  'byte-identical content — treat them as defect POINTERS (read `notes`), never as a metric to optimize';

/** The dimensions this rubric fails. Empty = passes the judge gate. */
export function failingDimensions(rubric: GameRubric): JudgeDimension[] {
  return JUDGE_DIMENSIONS.filter((dim) => rubric[dim] < JUDGE_FLOORS[dim]);
}

function passesJudgeGate(rubric: GameRubric): boolean {
  return failingDimensions(rubric).length === 0;
}

/** True when the judge reports a safety miss — routed to a human, never revised. */
export function isSafetyEscalation(rubric: GameRubric): boolean {
  return rubric.kid_safety < JUDGE_FLOORS.kid_safety;
}

/** One-line rubric summary. Always emitted WITH the noise caveat (header rule). */
export function formatRubric(rubric: GameRubric): string {
  const scores = JUDGE_DIMENSIONS.map((dim) => `${dim}=${rubric[dim]}`).join(', ');
  return `${scores} [${RUBRIC_NOISE_NOTE}]`;
}

// ---- Failure modes ---------------------------------------------------------

/** The slot failed the judge gate after its bounded revise budget. Resumable: the
 *  outer from-scratch retry may still rescue it. */
export class GameJudgeFailedError extends Error {
  readonly rubric: GameRubric;
  readonly cycles: number;
  /** True when the loop broke early because a revise improved no failing dimension. */
  readonly earlyStopped: boolean;
  readonly failing: JudgeDimension[];

  constructor(rubric: GameRubric, cycles: number, earlyStopped = false) {
    super(
      `judge: gate failed after ${cycles} revise cycle(s)` +
        `${earlyStopped ? ' (early stop: no failing dimension improved)' : ''} — ` +
        `${formatRubric(rubric)}. Notes: ${rubric.notes}`,
    );
    this.name = 'GameJudgeFailedError';
    this.rubric = rubric;
    this.cycles = cycles;
    this.earlyStopped = earlyStopped;
    this.failing = failingDimensions(rubric);
  }
}

/**
 * `kid_safety` below its floor. A DIFFERENT error from the one above on purpose:
 * `run.ts` must be able to mark this slot for human attention rather than let it
 * disappear into the ordinary retry/fail statistics. The run continues — one
 * escalated slot is not a reason to stop the other slots — but this slot is done.
 */
export class GameJudgeEscalationError extends Error {
  readonly rubric: GameRubric;
  readonly cycles: number;
  /** Marker for `run.ts` / the admin queue: a human must look at this slot. */
  readonly needsHumanReview = true;
  readonly dimension = 'kid_safety' as const;

  constructor(rubric: GameRubric, cycles: number) {
    super(
      `judge: kid_safety ESCALATION (kid_safety=${rubric.kid_safety} < floor ${JUDGE_FLOORS.kid_safety}) ` +
        `after ${cycles} revise cycle(s) — NOT revised, routed to human review. ` +
        `${RUBRIC_NOISE_NOTE}. Notes: ${rubric.notes}`,
    );
    this.name = 'GameJudgeEscalationError';
    this.rubric = rubric;
    this.cycles = cycles;
  }
}

// ---- The rubric log --------------------------------------------------------
//
// runs/<run-id>/rubrics.jsonl, next to the run's other artifacts (the usage
// ledger, the checkpoint). Without it the judge's verdicts are ephemeral — the
// checkpoint drops the rubric at the `localized` transition — so a run would
// leave no record of WHICH dimensions dragged across slots, how many revise
// cycles were burned, or why a draft was rejected. That aggregate is what a
// coach-style report reads. Same mechanics as `UsageLedger`: append-only JSONL,
// tolerant reader (a truncated final line from a killed process is skipped,
// never fatal), later invocations of the same run append to the same file.
//
// AGGREGATE IT AS A DEFECT HISTOGRAM, NOT A SCOREBOARD: "which dimension fails
// most often, and what do its notes say" is a real finding; "mean concept_fit
// rose 0.2 since last run" is noise (see the header).

export type RubricOutcome = 'passed' | 'failed' | 'escalated';

export interface GameRubricLogEntry {
  ts: string;
  slotId: string;
  outcome: RubricOutcome;
  /** Revise cycles consumed before this verdict (0 = settled on the first judgment). */
  cycles: number;
  /** True when the revise loop broke early (no failing dimension improved). */
  earlyStopped: boolean;
  /** The dimensions below their floor at this verdict (empty when `passed`). */
  failing: JudgeDimension[];
  mechanic: string;
  tier: number;
  rubric: GameRubric;
  /** Written into every line so an aggregate can never be read as a metric. */
  noise_note: string;
}

export class GameRubricLog {
  private readonly filePath: string;

  constructor(runDir: string) {
    this.filePath = path.join(runDir, 'rubrics.jsonl');
  }

  async record(entry: Omit<GameRubricLogEntry, 'ts' | 'noise_note'>): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const line =
      JSON.stringify({
        ts: new Date().toISOString(),
        ...entry,
        rubric: { ...entry.rubric, notes: entry.rubric.notes.slice(0, NOTES_TRUNCATE) },
        noise_note: RUBRIC_NOISE_NOTE,
      } satisfies GameRubricLogEntry) + '\n';
    await appendFile(this.filePath, line, 'utf8');
  }

  /** All entries, oldest first. Tolerates a truncated final line and a missing file. */
  static async read(runDir: string): Promise<GameRubricLogEntry[]> {
    let raw: string;
    try {
      raw = await readFile(path.join(runDir, 'rubrics.jsonl'), 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
    const entries: GameRubricLogEntry[] = [];
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        entries.push(JSON.parse(line) as GameRubricLogEntry);
      } catch {
        // Truncated tail — skip, never fatal (same policy as UsageLedger.hydrate).
      }
    }
    return entries;
  }

  /** The FINAL verdict per slot (last entry wins — a later pass supersedes). */
  static latestBySlot(entries: readonly GameRubricLogEntry[]): Map<string, GameRubricLogEntry> {
    const map = new Map<string, GameRubricLogEntry>();
    for (const entry of entries) map.set(entry.slotId, entry);
    return map;
  }
}

// ---- Prompt construction ---------------------------------------------------

/**
 * Local issue formatter rather than an import: `formatZodIssues` lives in a
 * module this file does not own, and a `readonly`-variance mismatch there would
 * break an unrelated stage's type-check. Same shape and same output as
 * `contract/core/schema.ts`'s local `formatIssues`, for the same reason.
 */
function formatZodIssueList(
  issues: readonly { readonly path: readonly PropertyKey[]; readonly message: string }[],
  limit = 20,
): string {
  return issues
    .slice(0, limit)
    .map((issue) => `${issue.path.map(String).join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
}

/**
 * PREFIX-CACHE DISCIPLINE (gamegen/AGENTS.md): the rubric, the calibration prose
 * and `JUDGE_PLAYBOOK_ANCHORS` are the bulk of the judge prompt and are
 * BYTE-IDENTICAL across every judge call of a run, so they live in the SYSTEM
 * message and are served as one stable cached prefix (DashScope bills implicit
 * hits at 20% of input). Everything per-game — tier guidance, the concept fact,
 * the document, retry feedback — goes in the user message, AFTER that prefix,
 * and corrective retries APPEND rather than splice.
 *
 * Built once at module load so it cannot accidentally vary per call.
 */
const JUDGE_SYSTEM = [
  'You are an INDEPENDENT quality judge for the minigames of a children\'s financial-literacy ' +
    'platform (LittleFounders). You did NOT design this game — review it critically. ' +
    'Output ONLY strict JSON, no prose outside the JSON.',
  '',
  'WHAT YOU ARE READING: a GameDocument manifest. The game itself is a prebuilt, hand-written, ' +
    'deterministic MECHANIC (code you cannot see and must not judge); this manifest SKINS and ' +
    'PARAMETERIZES it — the items, categories, numbers, difficulty ladder, feedback lines and ' +
    'scoring. Judge the DESIGN the manifest encodes, never the engine.',
  'A game is never a child\'s first contact with the idea: it unlocks only behind a lesson that ' +
    'already taught the concept. So the bar is RECOGNITION and FLUENCY under mild pressure — not ' +
    'first instruction, and not assessment.',
  '',
  GAME_PLAYBOOK,
  '',
  'Rate this game manifest 1-5 on each dimension (integers preferred):',
  '- concept_fit: does the thing the player MANIPULATES carry the bound concept, so that deciding ' +
    'correctly is impossible without using it? Apply the swap test below.',
  '- fun_agency: is there a real decision each round and a ladder that actually ramps, or is it a ' +
    'reflex loop with rotating wallpaper?',
  '- clarity: are labels short, literal, drawable and TTS-safe, and is every fact needed to decide ' +
    'visible BEFORE the player must act?',
  '- kid_safety: is EVERY word and every stake appropriate for a young child — nothing scary, ' +
    'violent, sexual, shaming, punishing or loss-framed, no dark patterns, no brands, no rude ' +
    'slang, and NO double-meaning expressions (albures — if a phrase has any second reading, it ' +
    'fails this dimension)? This is a HARD FLOOR, not an average input.',
  '- difficulty_fairness: does difficulty come from the config ladder\'s numbers rather than from ' +
    'ambiguity, hidden information or unreadable speed for the stated tier, and do the economy ' +
    'and target arithmetic actually work out?',
  '',
  JUDGE_PLAYBOOK_ANCHORS,
  '',
  // Restated here even though JUDGE_PLAYBOOK_ANCHORS already carries it: this is
  // the single most common false failure available to a judge reading a manifest
  // straight out of `author`, where `skin.sprites` is legitimately `{}`.
  'ILLUSTRATION IS DOWNSTREAM — JUDGE THE DESIGN AND THE LABELS, NEVER THE PIXELS. At judging time ' +
    '`skin.sprites` is normally EMPTY, `skin.background_url` absent, and every `image_slot` points ' +
    'at nothing: a later stage generates the art FROM these very labels. A missing sprite URL, a ' +
    'missing background, or a plain Material `icon` in place of art is NEVER a defect and must ' +
    'never cost a point on any dimension. The only illustration-related defect you may penalize is ' +
    'a LABEL too vague or too abstract to be drawn at all.',
  'WINNABILITY WAS ALREADY PROVEN MECHANICALLY before this prompt ran, by a free deterministic bot ' +
    'gate that bot-played this exact manifest. Do not re-derive whether the simulation terminates ' +
    'or whether the target is reachable in principle. Judge whether the intended strategy is ' +
    'DISCOVERABLE by a child of this tier and worth doing twice.',
  '',
  'Respond with EXACTLY: {"concept_fit":N,"fun_agency":N,"clarity":N,"kid_safety":N,' +
    '"difficulty_fairness":N,"notes":"..."}',
  '`notes` is the most valuable thing you produce: make it ACTIONABLE and SPECIFIC. For every score ' +
    'below 4, name the exact field (item id, config key, feedback line) and what to change. A ' +
    'generic complaint is worthless to the reviser.',
].join('\n');

function buildJudgeUser(document: GameDocument, conceptSummary: string | undefined): string {
  return [
    // Ground the tier half of difficulty_fairness in the stated band rather than
    // in the judge's guess about what "tier 2" means.
    `AGE-TIER FACT — this manifest declares meta.tier = ${document.meta.tier}. Judge every ` +
      `abstraction and every reaction window against THIS band:`,
    tierReasoningGuidance(document.meta.tier),
    '',
    // §1.9: the ONLY context a prompt may carry is the age tier and generic
    // concept material from the curriculum catalog. Never a child, a name, a
    // locale-specific personal detail, or anything derived from a user row.
    // There is no per-child generation path, by design.
    ...(conceptSummary === undefined
      ? []
      : [
          'BOUND-CONCEPT FACT (from the curriculum catalog — this is what the lesson already taught, ' +
            `so judge concept_fit against IT rather than against a guess): ${conceptSummary}`,
          '',
        ]),
    'GAME MANIFEST:',
    JSON.stringify(document),
  ].join('\n');
}

async function judgeDocument(
  document: GameDocument,
  judge: typeof completeQwen,
  ledger: UsageLedger | undefined,
  conceptSummary: string | undefined,
): Promise<GameRubric> {
  const user = buildJudgeUser(document, conceptSummary);

  const { data } = await withCorrectiveRetry<GameRubric>({
    maxAttempts: MAX_JUDGE_ATTEMPTS,
    callModel: async (issues) => {
      const messages = [
        { role: 'system' as const, content: JUDGE_SYSTEM },
        {
          role: 'user' as const,
          // APPEND, never splice: attempts 2..N re-send an identical leading
          // prompt, so the corrective retry is a prefix-cache hit.
          content: issues
            ? `${user}\n\nYour previous reply was invalid JSON: ${issues}. Resend valid JSON only.`
            : user,
        },
      ];
      // Low temperature: this is a measurement, not a creative act — and the
      // instrument is noisy enough already.
      const result = await judge({ messages, temperature: 0.2, jsonMode: true }, { operation: 'judge', ledger });
      return result.content;
    },
    parse: (raw) => {
      const json = safeJsonParse(raw);
      if (!json.ok) return { ok: false, issues: json.error };
      // Model output is NEVER trusted unvalidated (§1.14): an out-of-range score
      // would silently pass or fail a floor comparison.
      const parsed = gameRubricSchema.safeParse(json.value);
      if (!parsed.success) return { ok: false, issues: formatZodIssueList(parsed.error.issues) };
      return { ok: true, data: parsed.data };
    },
  });
  return data;
}

/**
 * The revise call — back on the AUTHOR provider (DeepSeek), because revising is
 * authoring. Prefix-stable material (role, hard rules, the playbook the author
 * was originally held to) sits in the SYSTEM message; the judge's notes, the
 * current document and the mechanic shape go in the user message.
 *
 * This diverges from Forge's `reviseDocument`, which keeps the playbook in the
 * user message — a legacy layout that predates the prefix-cache rule. The bar
 * text is identical either way; only the cache boundary moves.
 */
const REVISE_SYSTEM = [
  'You are Arcade, revising a children\'s minigame MANIFEST (a GameDocument) after independent ' +
    'judge feedback. Output ONLY the full corrected JSON document — the same shape as the input, ' +
    'no prose.',
  '',
  'HARD RULES:',
  '- PRESERVE `schema_version`, `meta.slug`, `meta.locale`, `meta.mechanic`, `meta.tier` and ' +
    '`meta.concept.topic_path` exactly. The mechanic and the bound concept are NOT yours to change.',
  '- Field names, nesting and enum values are LAW. Never invent, rename or move a field; an ' +
    'unknown key is silently DELETED downstream, which ships a game the engine cannot run.',
  '- Closed sets stay closed: palette, sfx, bgm, cast and every `skin.sprites` / `image_slot` key ' +
    'must come from the declared lists supplied below. Never a raw hex colour, an external URL, ' +
    'executable content or a real-world brand.',
  '- Leave `skin.sprites` and `skin.background_url` ALONE. Art is generated downstream from your ' +
    'labels; an empty `sprites` object is the correct state at this point.',
  '- The numbers must still work out: the target and `pass_score` must remain reachable with the ' +
    'items and the ladder you leave behind. A free deterministic bot gate re-plays your output.',
  '',
  'For a FORMAT or factual note, make the minimal fix. But when the judge flags CONCEPT FIT, ' +
    'AGENCY or FAIRNESS (a reskin that survives the swap test, throwaway traps, a ladder that does ' +
    'not ramp, difficulty made of ambiguity), you MUST REDESIGN the offending items/config to the ' +
    'playbook bar below — a minimal patch will fail the same way twice.',
  'CRITICAL: fix the flagged dimension WITHOUT regressing the others. Keep it tier-appropriate ' +
    '(for a young tier, engagement comes from a relatable stake and ONE visible decision, NEVER ' +
    'from harder arithmetic, faster spawns or more text), keep the stakes positive, and keep every ' +
    'label short, literal and drawable.',
  '',
  GAME_PLAYBOOK,
].join('\n');

async function reviseDocument(
  document: GameDocument,
  judgeNotes: string,
  author: typeof completeDeepSeek,
  ledger: UsageLedger | undefined,
): Promise<unknown> {
  // Derived from the REAL contract schemas, so the shape reminder can never
  // drift from what the gate validates against. `null` only for a mechanic this
  // build cannot look up — which cannot happen for an already-authored document,
  // but is handled rather than asserted.
  const shape = mechanicShapeExample(document.meta.mechanic);
  const shapeText =
    shape === null
      ? []
      : [
          '',
          `EXACT JSON SHAPE for mechanic "${document.meta.mechanic}" (field names / nesting / enum options are LAW):`,
          `config:\n${JSON.stringify(shape.config)}`,
          `content:\n${JSON.stringify(shape.content)}`,
          `declared sprite slots (the ONLY legal \`image_slot\` and \`skin.sprites\` keys): ${shape.spriteSlots.join(', ')}`,
        ];

  const user = [
    `AGE-TIER FACT — meta.tier = ${document.meta.tier}:`,
    tierReasoningGuidance(document.meta.tier),
    '',
    'JUDGE NOTES (fix these — if they are about concept fit, agency or fairness, REDESIGN to the ' +
      `playbook, do not just patch):\n${judgeNotes}`,
    '',
    'CURRENT DOCUMENT:',
    JSON.stringify(document),
    ...shapeText,
  ].join('\n');

  const { data } = await withCorrectiveRetry<unknown>({
    maxAttempts: MAX_REVISE_ATTEMPTS,
    callModel: async (issues) => {
      const messages = [
        { role: 'system' as const, content: REVISE_SYSTEM },
        {
          role: 'user' as const,
          content: issues
            ? `${user}\n\nYour previous JSON was invalid: ${issues}. Resend the FULL corrected JSON.`
            : user,
        },
      ];
      const result = await author(
        { messages, temperature: 0.4, jsonMode: true, maxTokens: REVISE_MAX_TOKENS },
        { operation: 'revise', ledger },
      );
      return result.content;
    },
    parse: (raw) => {
      const json = safeJsonParse(raw);
      if (!json.ok) return { ok: false, issues: json.error };
      // Structural validation happens in `revalidate` (the full gate cascade),
      // not here: this loop only guarantees the reply is JSON at all. Reporting
      // schema issues twice would spend revise attempts on problems the gate
      // reports with better messages.
      return { ok: true, data: json.value };
    },
  });
  return data;
}

// ---- The stage -------------------------------------------------------------

export type GameRevalidateResult =
  | { ok: true; document: GameDocument }
  | { ok: false; issues: string[] };

/**
 * Re-validation of a revised manifest before it is re-judged.
 *
 * DEFAULT: `parseGameDocumentSync` — the Zod contract only. `run.ts` SHOULD
 * inject a fuller cascade (the deterministic `gate` checks plus the free
 * `simulate` bot-play winnability gate), because a revise can break either one:
 * a redesigned item set is exactly the edit that makes a target unreachable, and
 * re-judging an unwinnable manifest spends a paid call to learn something a free
 * gate already knew. Injection rather than an import keeps this module free of
 * files it does not own.
 */
export type GameRevalidate = (raw: unknown) => GameRevalidateResult;

export interface JudgeGameDeps {
  ledger?: UsageLedger;
  /** Override for tests. Defaults to the real Qwen chokepoint. */
  judge?: typeof completeQwen;
  /** Override for tests. Defaults to the real DeepSeek chokepoint. */
  author?: typeof completeDeepSeek;
  /**
   * Generic concept context from `gamegen/curriculum/<course>/games.yaml` /
   * the Forge catalog — what the bound lesson taught, in curriculum words.
   * §1.9: age tier + generic concept context are the ONLY per-slot facts a
   * prompt may carry. Never a child, a name, a profile field, or anything read
   * from a user row. There is no per-child generation path.
   */
  conceptSummary?: string;
  /** See `GameRevalidate`. Defaults to the Zod contract alone. */
  revalidate?: GameRevalidate;
  /** Run artifacts: `runs/<run-id>/rubrics.jsonl`. Omitted → no log written. */
  rubricLog?: GameRubricLog;
  /** Slot identity for the log. Defaults to the manifest slug. */
  slotId?: string;
}

export interface JudgeGameResult {
  /** The manifest that PASSED — the revised one when a revise cycle ran. */
  document: GameDocument;
  rubric: GameRubric;
  cycles: number;
}

/**
 * The `judge` stage: score the manifest with the decorrelated provider, revise
 * on a failure within a bounded budget, escalate a safety miss, and record the
 * verdict.
 *
 * Throws `GameJudgeEscalationError` (human review required) or
 * `GameJudgeFailedError` (slot failed, outer retry may rescue it). Provider
 * failures — `BudgetExceededError`, `ProviderNotConfiguredError`, a fatal HTTP
 * error — are NOT caught anywhere in this file, deliberately: the budget kill
 * switch only exists if the error escapes (gamegen/AGENTS.md), and a `catch`
 * here that degraded it into "skip this one" would let a run that already hit
 * its USD cap keep paying.
 */
export async function judgeGame(document: GameDocument, deps: JudgeGameDeps = {}): Promise<JudgeGameResult> {
  const judge = deps.judge ?? completeQwen;
  const author = deps.author ?? completeDeepSeek;
  const revalidate = deps.revalidate ?? parseGameDocumentSync;
  const slotId = deps.slotId ?? document.meta.slug;

  const log = async (rubric: GameRubric, outcome: RubricOutcome, cycles: number, earlyStopped: boolean) => {
    await deps.rubricLog?.record({
      slotId,
      outcome,
      cycles,
      earlyStopped,
      failing: failingDimensions(rubric),
      mechanic: document.meta.mechanic,
      tier: document.meta.tier,
      rubric,
    });
  };

  let current = document;
  let rubric = await judgeDocument(current, judge, deps.ledger, deps.conceptSummary);
  let cycles = 0;
  let earlyStopped = false;

  if (isSafetyEscalation(rubric)) {
    await log(rubric, 'escalated', cycles, false);
    console.warn(
      `[arcade] judge ESCALATION on slot ${slotId}: kid_safety=${rubric.kid_safety} < ${JUDGE_FLOORS.kid_safety}. ` +
        `Not revised — a safety verdict is routed to a human, never patched by the model that wrote it. ` +
        `${RUBRIC_NOISE_NOTE}; read the notes, do not read the number.`,
    );
    throw new GameJudgeEscalationError(rubric, cycles);
  }

  /*
   * EARLY-STOP baseline: the last rubric the JUDGE actually emitted. A revise
   * cycle that fails re-validation skips the re-judge and only appends a gate
   * note to the SAME scores (below), so it never produces a new judged rubric —
   * comparing against such a copy would read "identical scores → no
   * improvement" and kill the designed gate-feedback recovery path on its first
   * firing. Only judge-emitted rubrics enter this comparison.
   */
  let lastJudged = rubric;

  while (!passesJudgeGate(rubric) && cycles < MAX_REVISE_CYCLES) {
    cycles++;
    const revised = await reviseDocument(current, rubric.notes, author, deps.ledger);

    const check = revalidate(revised);
    if (!check.ok) {
      // Feed the failure forward as notes for the NEXT cycle instead of burning
      // a paid judge call on a manifest we already know is invalid.
      const summary = check.issues.slice(0, 3).join('; ');
      rubric = { ...rubric, notes: `${rubric.notes}\n(revise cycle ${cycles} failed re-validation: ${summary})` };
      continue;
    }
    current = check.document;

    rubric = await judgeDocument(current, judge, deps.ledger, deps.conceptSummary);

    if (isSafetyEscalation(rubric)) {
      await log(rubric, 'escalated', cycles, false);
      console.warn(
        `[arcade] judge ESCALATION on slot ${slotId} after revise cycle ${cycles}: ` +
          `kid_safety=${rubric.kid_safety} < ${JUDGE_FLOORS.kid_safety}. Routed to human review. ` +
          `${RUBRIC_NOISE_NOTE}; read the notes, do not read the number.`,
      );
      throw new GameJudgeEscalationError(rubric, cycles);
    }

    if (!passesJudgeGate(rubric)) {
      /*
       * A revise that improved NO failing dimension is a doomed trajectory:
       * successive revisions of the same draft are correlated, and the outer
       * from-scratch retry (ARCADE_SLOT_ATTEMPTS) converges better per token
       * spent. Measured on Forge's real QA regen: 14 of 62 slots burned all 3
       * cycles and failed anyway.
       *
       * Because the scores are noisy integers (header note), a SPURIOUS early
       * stop is possible — and its downside is bounded on purpose: the slot
       * falls through to the outer from-scratch retry, whose fresh attempt
       * costs about what the revise+judge cycles it skipped would have.
       */
      const previouslyFailing = failingDimensions(lastJudged);
      const improved = previouslyFailing.some((dim) => rubric[dim] > lastJudged[dim]);
      if (!improved) {
        earlyStopped = true;
        console.warn(
          `[arcade] judge early-stop on slot ${slotId} after revise cycle ${cycles}: no failing dimension ` +
            `improved (${previouslyFailing.join(', ')}) — failing fast to the outer from-scratch retry. ` +
            `${RUBRIC_NOISE_NOTE}.`,
        );
        break;
      }
    }
    lastJudged = rubric;
  }

  if (!passesJudgeGate(rubric)) {
    await log(rubric, 'failed', cycles, earlyStopped);
    throw new GameJudgeFailedError(rubric, cycles, earlyStopped);
  }

  await log(rubric, 'passed', cycles, earlyStopped);
  return { document: current, rubric, cycles };
}
