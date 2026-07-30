// The 8 deterministic gates — GAME_ENGINE.md §9 `gate` stage, gamegen/AGENTS.md.
//
// FREE, no network, no LLM, run in order, cheap-first. Gate 1 (contract) gates every
// gate after it: if the authored JSON does not parse against the mechanic's real Zod
// schemas there is no typed document to reason about, so gates 2-8 have nothing to say
// and saying it anyway would bury the one message that matters.
//
// WHERE THIS RUNS. `gate` owns no checkpoint state of its own: it is expected to run
// INSIDE the author stage's corrective-retry loop, the way Forge's gates run inside
// `write.ts` via `WriteInput.gateCtx`. A gate failure is therefore actionable feedback
// to the next attempt, not a dead slot — which is why every `message` here NAMES THE
// FIELD, the expected value and the observed value (coursegen/AGENTS.md, "gate failures
// are corrective feedback, not death sentences"). Keep that shape when adding a check.
//
// WHAT THIS IS NOT. This module never bot-plays anything: winnability is the separate,
// also-free `simulate` stage (`perfect` bot must reach `scoring.pass_score`, `random`
// must not). The division is deliberate — these gates prove properties a bot run cannot
// distinguish from "hard", and the bot proves properties no static check can reach. A
// document that fails a gate here must never be handed to the paid judge.
//
// MODELLED ON `coursegen/src/pipeline/gates.ts` (runAllGates + GateProblem + per-gate
// `run*Gate` exports), `generationQuality.ts` (zero-false-positive posture) and
// `readability.ts` (gate 7's formulas and calibrated bands are ported from it verbatim
// — coursegen is a sibling package, not a workspace, so it cannot be imported).

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

import { DEFAULT_COURSEGEN_CURRICULUM_ROOT } from '../catalog/loader.js';
import { CHARACTER_IDS } from '../contract/core/characters.js';
import { DEFAULT_MAX_EVENTS_PER_TICK } from '../contract/core/replay.js';
import { gameValidationSchema } from '../contract/core/schemaBase.js';
import { parseGameDocumentSync } from '../contract/core/schema.js';
import {
  GAME_BGM,
  GAME_PALETTES,
  GAME_SFX,
  TICK_MS,
  type GameDocument,
  type GameLocale,
  type GameTier,
  type GameValidation,
  type MechanicId,
} from '../contract/core/types.js';
import { getMechanic } from '../contract/registry.js';

import { autobattlerConfigSchema, type AutobattlerConfig } from '../contract/mechanics/autobattler/schema.js';
import { defenderConfigSchema, type DefenderConfig } from '../contract/mechanics/defender/schema.js';
import {
  explorerConfigSchema,
  explorerContentSchema,
  type ExplorerConfig,
  type ExplorerContent,
} from '../contract/mechanics/explorer/schema.js';
import { flyerConfigSchema, type FlyerConfig } from '../contract/mechanics/flyer/schema.js';
import { launcherConfigSchema, type LauncherConfig } from '../contract/mechanics/launcher/schema.js';
import { runnerConfigSchema, type RunnerConfig } from '../contract/mechanics/runner/schema.js';
import {
  sorterConfigSchema,
  sorterContentSchema,
  type SorterConfig,
  type SorterContent,
} from '../contract/mechanics/sorter/schema.js';
import {
  costOfPiece,
  stackerConfigSchema,
  stackerContentSchema,
  type StackerConfig,
  type StackerContent,
} from '../contract/mechanics/stacker/schema.js';

// ---- Problem shape ----------------------------------------------------------------

/**
 * 1 contract · 2 vocabulary · 3 referential integrity · 4 config bounds ·
 * 5 economy solvency · 6 sidecar consistency · 7 readability · 8 anti-genericity.
 *
 * The numbering is part of the operator-facing contract: a run log line reads
 * `gate 4: ...` in Arcade exactly as it reads `gate 4: ...` in Forge, so one person
 * reading both pipelines' logs learns one format.
 */
export type GameGateNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface GameGateProblem {
  gate: GameGateNumber;
  /**
   * Dot path of the offending field (`content.items.3.label_md`), for tooling. The
   * `message` always names the field too — a model reading the corrective feedback sees
   * only the message.
   */
  path?: string;
  message: string;
}

export interface GameGateReport {
  ok: boolean;
  problems: GameGateProblem[];
  /** Present only when gate 1 passed. */
  document?: GameDocument;
  /** Present only when gate 1 passed. */
  validation?: GameValidation;
}

export interface GameGateContext {
  /**
   * The Forge course slug this game binds into (`games.yaml`'s `course`). Gate 2
   * resolves `coursegen/curriculum/<course>/taxonomy.yaml` from it — the SAME
   * forbidden-vocabulary lists Forge hard-fails lessons against, never a copy.
   */
  course: string;
  /**
   * Pre-resolved forbidden vocabulary. When supplied, gate 2 uses it and reads no file
   * (the pipeline resolves it once per run instead of once per attempt). When omitted,
   * gate 2 loads it from `course` + the document's own tier and locale.
   */
  forbiddenVocabulary?: readonly string[];
  /** Overrides Forge's curriculum root. Tests point this at a fixture tree. */
  coursegenCurriculumRoot?: string;
  /**
   * The bound topic's human title (or the blueprint's `micro_objective`). Powers gate
   * 8's echo check: a recap that restates the title teaches nothing.
   */
  topicTitle?: string;
}

function problem(gate: GameGateNumber, path: string, message: string): GameGateProblem {
  return { gate, path, message: `${path}: ${message}` };
}

// ---- Gate 1: the contract ----------------------------------------------------------

/**
 * Zod-parse the authored payload against the MECHANIC'S REAL SCHEMAS — the registry
 * copies of the very modules the frontend renders and Core replays with — plus the
 * server-only sidecar.
 *
 * This is the gate that makes every other gate meaningful, and it is also the gate that
 * catches contract drift: Zod strips unknown keys by default, so a field the frontend
 * contract gained and `gamegen/src/contract/` lacks is DELETED here in silence
 * (gamegen/AGENTS.md, "why drift is silent and expensive"). Nothing downstream can
 * recover from that; `npm run contract:check` is the thing that prevents it.
 */
export function runContractGate(
  rawDocument: unknown,
  rawSidecar: unknown,
): { ok: boolean; problems: GameGateProblem[]; document?: GameDocument; validation?: GameValidation } {
  const problems: GameGateProblem[] = [];

  const parsed = parseGameDocumentSync(rawDocument);
  if (!parsed.ok) {
    // `parseGameDocumentSync` already formats `path: message`, so the issue string IS
    // the message; re-prefixing it would double the path.
    for (const issue of parsed.issues) problems.push({ gate: 1, message: issue });
  }

  const sidecar = gameValidationSchema.safeParse(rawSidecar);
  if (!sidecar.success) {
    for (const issue of sidecar.error.issues) {
      const at = ['validation', ...issue.path.map(String)].join('.');
      problems.push({ gate: 1, path: at, message: `${at}: ${issue.message}` });
    }
  }

  if (!parsed.ok || !sidecar.success) return { ok: false, problems };
  return { ok: true, problems, document: parsed.document, validation: sidecar.data };
}

// ---- Gate 2: forbidden vocabulary (the Piaget gate — HARD FAIL) ---------------------
//
// Same rule, same word lists and the same normalization as Forge's gate 2: a tier-1
// document may not say "porcentaje" in any locale, whatever the mechanic. The lists are
// READ from `coursegen/curriculum/<course>/taxonomy.yaml` rather than duplicated here,
// because two copies of a safety vocabulary drift and the drifting copy is the one that
// silently stops failing.

/**
 * Object keys that carry structure, ids, enums or generated URLs — never free learner
 * prose. Skipped by the vocabulary and anti-genericity walkers here, and EXPORTED for
 * `localize.ts` to reuse as its string-freeze twin (the same arrangement coursegen has,
 * where `localize.ts` imports `NON_VISIBLE_KEYS` from `gates.ts`).
 *
 * THE SHAPE DIFFERS FROM COURSEGEN'S, deliberately (GAME_ENGINE.md §9): several entries
 * here are CONTAINERS, not leaves. `skin.sprites` is `Record<slotId, url>` with
 * author-chosen keys, so no list of leaf names can enumerate it — the walker skips the
 * whole subtree the moment it sees the key. Same for `sfx` and `config`, which is
 * entirely numeric/enum by contract. `illustrate` runs BEFORE `localize`, so these
 * containers already hold Prism URLs that must copy verbatim into en-US and pt-BR: one
 * image serves three locales, and a translated sprite key renders nothing at all.
 */
export const NON_VISIBLE_KEYS: ReadonlySet<string> = new Set([
  // ids and structure
  'id',
  'slug',
  'schema_version',
  'locale',
  'mechanic',
  'topic_path',
  'kind',
  'mode',
  'palette',
  'bgm',
  'cast',
  'tier',
  'after_round',
  'correct',
  // per-item / per-category bindings
  'image_slot',
  'icon',
  'category',
  'item_id',
  'sprite_slot',
  'start_node',
  'goal_node',
  // CONTAINERS — skipped whole, because their keys are author-chosen or their leaves
  // are numeric/enum by contract.
  'config',
  'sprites',
  'sfx',
  'background_url',
]);

const COMBINING_DIACRITICS_RE = new RegExp('[\\u0300-\\u036f]', 'g');

function normalizeText(value: string): string {
  return value.normalize('NFD').replace(COMBINING_DIACRITICS_RE, '').toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whole-word match on the NORMALIZED text, so "interés" and "Interes" both hit. */
function buildForbiddenRegex(word: string): RegExp {
  const pattern = escapeRegExp(normalizeText(word)).replace(/\s+/g, '\\s+');
  return new RegExp(`(?<![a-z0-9])${pattern}(?![a-z0-9])`, 'i');
}

interface VisitedString {
  path: string;
  value: string;
}

function collectLearnerVisibleStrings(node: unknown, at: string, out: VisitedString[]): void {
  if (node === null || node === undefined) return;
  if (typeof node === 'string') {
    out.push({ path: at, value: node });
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((entry, index) => collectLearnerVisibleStrings(entry, `${at}[${index}]`, out));
    return;
  }
  if (typeof node === 'object') {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (NON_VISIBLE_KEYS.has(key)) continue;
      collectLearnerVisibleStrings(value, at ? `${at}.${key}` : key, out);
    }
  }
}

/** The taxonomy key Forge uses for a Piaget band. */
function tierKey(tier: GameTier): string {
  return `tier${tier}`;
}

/**
 * MINIMAL BY DESIGN, exactly like `catalog/schema.ts`'s Forge catalog readers: this
 * reads the three things a forbidden-vocabulary lookup is made of and ignores every
 * other Forge field, so Forge's taxonomy may grow freely without breaking Arcade. There
 * are no npm workspaces (AGENTS.md §1.2), so coursegen's own schema cannot be imported.
 */
const courseTaxonomyVocabularySchema = z.object({
  age_tiers: z.record(
    z.string(),
    z.object({
      forbidden_vocabulary: z.record(z.string(), z.array(z.string())).optional(),
    }),
  ),
});

interface ForbiddenVocabularyResult {
  words: readonly string[];
  /** Set when the list could NOT be resolved — gate 2 then fails closed. */
  error?: string;
}

/** Parsed taxonomy files, keyed by absolute path. A retry loop re-gates the same
 *  document several times; the file is read once. */
const taxonomyCache = new Map<string, z.infer<typeof courseTaxonomyVocabularySchema> | string>();

/**
 * The forbidden vocabulary for one course × tier × locale, read from Forge's OWN
 * `taxonomy.yaml`.
 *
 * FAILS CLOSED. An unreadable file, a missing tier or a missing locale returns an
 * `error`, never an empty list: "we could not check" and "there is nothing to check"
 * must never look the same on a child-safety gate (AGENTS.md §1.14 — failure must be
 * distinguishable from emptiness). A locale key that is present but empty is a real
 * empty list and passes.
 *
 * DEV/CI-TIME ONLY, for the same reason `catalog/loader.ts` is: Railway deploys gamegen
 * with `--path-as-root`, so `coursegen/` does not exist in the production image. Nothing
 * on a request path may call this.
 */
export function loadForbiddenVocabulary(args: {
  course: string;
  tier: GameTier;
  locale: GameLocale;
  coursegenCurriculumRoot?: string;
}): ForbiddenVocabularyResult {
  const root = args.coursegenCurriculumRoot ?? DEFAULT_COURSEGEN_CURRICULUM_ROOT;
  const file = path.join(root, args.course, 'taxonomy.yaml');

  let cached = taxonomyCache.get(file);
  if (cached === undefined) {
    if (!existsSync(file)) {
      cached = `${file} not found — the Piaget vocabulary gate cannot run without Forge's taxonomy`;
    } else {
      try {
        const parsed = courseTaxonomyVocabularySchema.safeParse(parseYaml(readFileSync(file, 'utf8')));
        cached = parsed.success
          ? parsed.data
          : `${file}: ${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`;
      } catch (err) {
        cached = `${file}: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
    taxonomyCache.set(file, cached);
  }

  if (typeof cached === 'string') return { words: [], error: cached };

  const key = tierKey(args.tier);
  const tierEntry = cached.age_tiers[key];
  if (tierEntry === undefined) {
    return { words: [], error: `${file} declares no age_tiers.${key}` };
  }
  const byLocale = tierEntry.forbidden_vocabulary;
  if (byLocale === undefined) {
    return { words: [], error: `${file} declares no age_tiers.${key}.forbidden_vocabulary` };
  }
  const words = byLocale[args.locale];
  if (words === undefined) {
    return { words: [], error: `${file} declares no age_tiers.${key}.forbidden_vocabulary.${args.locale}` };
  }
  return { words };
}

/** Test seam — the module-level taxonomy cache is process-wide. */
export function resetTaxonomyCache(): void {
  taxonomyCache.clear();
}

/**
 * HARD FAIL. Every learner-visible string in the document is scanned for the tier's
 * forbidden words in the document's locale. A tier-1 game that says "interés" is not a
 * game with a rough edge — it is a game aimed at the wrong Piaget band, and no amount
 * of judge praise makes it publishable.
 */
export function runVocabularyGate(
  document: GameDocument,
  vocabulary: ForbiddenVocabularyResult,
): GameGateProblem[] {
  if (vocabulary.error !== undefined) {
    return [
      {
        gate: 2,
        message:
          `forbidden vocabulary could not be resolved (${vocabulary.error}). ` +
          `The Piaget gate fails CLOSED: a document is never published on an unchecked vocabulary.`,
      },
    ];
  }
  if (vocabulary.words.length === 0) return [];

  const regexes = vocabulary.words.map((word) => ({ word, re: buildForbiddenRegex(word) }));
  const strings: VisitedString[] = [];
  collectLearnerVisibleStrings(document, '', strings);

  const problems: GameGateProblem[] = [];
  for (const { path: at, value } of strings) {
    const normalized = normalizeText(value);
    for (const { word, re } of regexes) {
      if (re.test(normalized)) {
        problems.push(
          problem(
            2,
            at,
            `forbidden word "${word}" for tier ${document.meta.tier} (${document.meta.locale}) in "${value.slice(0, 80)}" — ` +
              `say it with a concrete object or an everyday phrase instead`,
          ),
        );
      }
    }
  }
  return problems;
}

// ---- Gate 3: referential integrity --------------------------------------------------
//
// `parseGameDocumentSync`'s cross-field checks already prove: unique item ids, every
// `item.category` is declared, every `image_slot` and every `skin.sprites` key is a
// declared slot of the mechanic, `meta.cast` is canon, cheer mode has null lives. This
// gate adds the references those checks CANNOT see, because `config` and `content` are
// parsed by two different schemas that never meet:
//
//   * `config.*.item_id`  — stacker's catalogue, defender's towers/enemies/abilities,
//     autobattler's units/traits/items. The simulators IGNORE an entry whose `item_id`
//     resolves to nothing (stacker/schema.ts says so in as many words), so a typo here
//     produces a game that is quietly missing a piece, not an error;
//   * `config.*.sprite_slot` — the same undeclared-slot defect the document layer
//     rejects for content, unchecked on the config side;
//   * interlude structure, and the closed sets, re-asserted as defence in depth.

/** Every `item_id` / `sprite_slot` value anywhere in a config, with its dot path.
 *  Generic on purpose: the key names are consistent across the eight mechanics, so a
 *  ninth mechanic (GAME_ENGINE.md §12) is covered the day it lands. */
function collectConfigRefs(
  node: unknown,
  at: string,
  out: { path: string; key: string; value: string }[],
): void {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    node.forEach((entry, index) => collectConfigRefs(entry, `${at}.${index}`, out));
    return;
  }
  if (typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    const childPath = `${at}.${key}`;
    if ((key === 'item_id' || key === 'sprite_slot') && typeof value === 'string') {
      out.push({ path: childPath, key, value });
      continue;
    }
    collectConfigRefs(value, childPath, out);
  }
}

/** Media must be a Depot/Prism https URL. The manifest never carries executable code
 *  and never names an inline payload (gamegen/AGENTS.md, "sandboxed output"). */
function checkMediaUrl(at: string, value: string, problems: GameGateProblem[]): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    problems.push(problem(3, at, `"${value.slice(0, 60)}" is not a URL`));
    return;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    problems.push(
      problem(
        3,
        at,
        `scheme "${parsed.protocol}" is not allowed — sprites and backgrounds are https Depot URLs, never data: or javascript: payloads`,
      ),
    );
  }
}

export function runReferentialIntegrityGate(document: GameDocument): GameGateProblem[] {
  const problems: GameGateProblem[] = [];
  const { content, skin, meta } = document;

  const slice = getMechanic(meta.mechanic);
  const spriteSlots: readonly string[] = slice === null ? [] : slice.spriteSlots;

  // ---- ids: uniqueness where the document layer does not reach ----
  const itemIds = new Set(content.items.map((item) => item.id));

  const seenCategories = new Set<string>();
  for (const [index, category] of (content.categories ?? []).entries()) {
    if (seenCategories.has(category.id)) {
      problems.push(
        problem(
          3,
          `content.categories.${index}.id`,
          `duplicate category id "${category.id}" — items reference categories by id, so a duplicate makes the reference ambiguous`,
        ),
      );
    }
    seenCategories.add(category.id);
  }

  const seenInterludes = new Set<string>();
  for (const [index, interlude] of (content.interludes ?? []).entries()) {
    const at = `content.interludes.${index}`;
    if (seenInterludes.has(interlude.id)) {
      problems.push(problem(3, `${at}.id`, `duplicate interlude id "${interlude.id}"`));
    }
    seenInterludes.add(interlude.id);

    const seenOptions = new Set<string>();
    let correct = 0;
    for (const [optionIndex, option] of interlude.options.entries()) {
      if (seenOptions.has(option.id)) {
        problems.push(
          problem(3, `${at}.options.${optionIndex}.id`, `duplicate option id "${option.id}" within the interlude`),
        );
      }
      seenOptions.add(option.id);
      if (option.correct) correct += 1;
    }
    if (correct === 0) {
      problems.push(
        problem(3, `${at}.options`, `no option is marked correct — the child cannot answer a ${interlude.kind} with no right answer`),
      );
    }
    if (interlude.kind !== 'tap_all' && correct > 1) {
      problems.push(
        problem(
          3,
          `${at}.options`,
          `${correct} options are marked correct, but a ${interlude.kind} takes exactly ONE (use kind "tap_all" for a multi-select)`,
        ),
      );
    }
  }

  // ---- config -> content / sprite-slot references ----
  const refs: { path: string; key: string; value: string }[] = [];
  collectConfigRefs(document.config, 'config', refs);
  for (const ref of refs) {
    if (ref.key === 'item_id' && !itemIds.has(ref.value)) {
      problems.push(
        problem(
          3,
          ref.path,
          `"${ref.value}" is not a declared content.items id — the simulator silently IGNORES an entry whose item_id resolves to nothing, so this ships as a missing piece, not as an error`,
        ),
      );
    }
    if (ref.key === 'sprite_slot' && !spriteSlots.includes(ref.value)) {
      problems.push(
        problem(
          3,
          ref.path,
          `"${ref.value}" is not a declared sprite slot of ${meta.mechanic} — an undeclared slot can never be bound by illustrate and would never render. Declared: ${spriteSlots.join(', ') || '(none)'}`,
        ),
      );
    }
  }

  // ---- closed sets, re-asserted (defence in depth against a drifted parity copy) ----
  const palettes: readonly string[] = GAME_PALETTES;
  if (!palettes.includes(skin.palette)) {
    problems.push(problem(3, 'skin.palette', `"${skin.palette}" is not one of ${palettes.join(', ')}`));
  }
  const bgms: readonly string[] = GAME_BGM;
  if (skin.bgm !== undefined && !bgms.includes(skin.bgm)) {
    problems.push(problem(3, 'skin.bgm', `"${skin.bgm}" is not one of ${bgms.join(', ')}`));
  }
  const sfxNames: readonly string[] = GAME_SFX;
  const sfx: Record<string, string> = skin.sfx ?? {};
  for (const key of Object.keys(sfx).sort()) {
    const value = sfx[key];
    if (value !== undefined && !sfxNames.includes(value)) {
      problems.push(problem(3, `skin.sfx.${key}`, `"${value}" is not part of the closed sfx vocabulary`));
    }
  }

  // ---- media ----
  if (skin.background_url !== undefined) checkMediaUrl('skin.background_url', skin.background_url, problems);
  for (const key of Object.keys(skin.sprites).sort()) {
    const url = skin.sprites[key];
    if (url !== undefined) checkMediaUrl(`skin.sprites.${key}`, url, problems);
  }

  return problems;
}

// ---- Mechanic views ------------------------------------------------------------------
//
// Gate 1 already parsed `config` with the slice's own schema, so re-parsing it here is
// free of surprises and buys full typing with ZERO casts (`MechanicConfig` is
// `Record<string, unknown>`; casting out of it would be an assertion nobody re-checks).
// A `null` view means "not this mechanic, or gate 1 would have failed" — never a silent
// skip of a check that should have run, because gates 4-6 only ever ask for the view of
// the mechanic the document declares.

function sorterView(document: GameDocument): { config: SorterConfig; content: SorterContent } | null {
  if (document.meta.mechanic !== 'sorter') return null;
  const config = sorterConfigSchema.safeParse(document.config);
  const content = sorterContentSchema.safeParse(document.content);
  return config.success && content.success ? { config: config.data, content: content.data } : null;
}

function stackerView(document: GameDocument): { config: StackerConfig; content: StackerContent } | null {
  if (document.meta.mechanic !== 'stacker') return null;
  const config = stackerConfigSchema.safeParse(document.config);
  const content = stackerContentSchema.safeParse(document.content);
  return config.success && content.success ? { config: config.data, content: content.data } : null;
}

function explorerView(document: GameDocument): { config: ExplorerConfig; content: ExplorerContent } | null {
  if (document.meta.mechanic !== 'explorer') return null;
  const config = explorerConfigSchema.safeParse(document.config);
  const content = explorerContentSchema.safeParse(document.content);
  return config.success && content.success ? { config: config.data, content: content.data } : null;
}

function runnerConfigOf(document: GameDocument): RunnerConfig | null {
  if (document.meta.mechanic !== 'runner') return null;
  const parsed = runnerConfigSchema.safeParse(document.config);
  return parsed.success ? parsed.data : null;
}

function launcherConfigOf(document: GameDocument): LauncherConfig | null {
  if (document.meta.mechanic !== 'launcher') return null;
  const parsed = launcherConfigSchema.safeParse(document.config);
  return parsed.success ? parsed.data : null;
}

function defenderConfigOf(document: GameDocument): DefenderConfig | null {
  if (document.meta.mechanic !== 'defender') return null;
  const parsed = defenderConfigSchema.safeParse(document.config);
  return parsed.success ? parsed.data : null;
}

function autobattlerConfigOf(document: GameDocument): AutobattlerConfig | null {
  if (document.meta.mechanic !== 'autobattler') return null;
  const parsed = autobattlerConfigSchema.safeParse(document.config);
  return parsed.success ? parsed.data : null;
}

function flyerConfigOf(document: GameDocument): FlyerConfig | null {
  if (document.meta.mechanic !== 'flyer') return null;
  const parsed = flyerConfigSchema.safeParse(document.config);
  return parsed.success ? parsed.data : null;
}

/**
 * The hard tick budget of a document, whatever its mechanic calls the field. Exported
 * because it is also what `simulate` must pass to `replayGame` as `maxTicks` and what
 * gate 6 measures the sidecar's duration/event bounds against — three callers agreeing
 * on one definition, rather than three that nearly agree.
 *
 * `null` when the config cannot be read (gate 1 already said so).
 */
export function tickBudgetForMechanic(document: GameDocument): number | null {
  const mechanic: MechanicId = document.meta.mechanic;
  switch (mechanic) {
    case 'sorter':
      return sorterView(document)?.config.round.tick_budget ?? null;
    case 'stacker':
      return stackerView(document)?.config.round.tick_budget ?? null;
    case 'explorer':
      return explorerView(document)?.config.tick_budget ?? null;
    case 'defender':
      return defenderConfigOf(document)?.tick_budget ?? null;
    case 'runner':
      return runnerConfigOf(document)?.max_ticks ?? null;
    case 'launcher':
      return launcherConfigOf(document)?.max_ticks ?? null;
    case 'autobattler':
      return autobattlerConfigOf(document)?.max_ticks ?? null;
    case 'flyer':
      return flyerConfigOf(document)?.max_ticks ?? null;
  }
}

// ---- Gate 4: config bounds -----------------------------------------------------------
//
// Every check here proves a property of the AUTHORED NUMBERS that a bot run cannot
// distinguish from "this game is hard": a difficulty ladder that gets easier, a target
// nothing in the content can reach, a reaction window a six-year-old cannot use. The
// bot gate reports all of them as "the perfect bot scored 62" — this gate reports which
// number to change.

/** Reaction time a falling/conveyor element must allow, per Piaget band. Deliberately
 *  generous: this catches "0.3 seconds to decide", not fine tuning. */
const MIN_REACTION_SECONDS: Record<GameTier, number> = { 1: 2, 2: 1.4, 3: 1 };
/** No tier, at any ladder rung, may go below this. */
const ABSOLUTE_MIN_REACTION_SECONDS = 0.5;

/** A pass score of 0 hands out XP for doing nothing; one above this is unreachable in
 *  practice once any penalty lands. */
const MIN_PASS_SCORE = 1;
const MAX_PASS_SCORE = 95;

/** Sums every declared scoring weight, wherever the mechanic keeps it (`score_weights.*`
 *  for sorter/stacker/defender/autobattler/explorer, `scoring.*_weight` for
 *  runner/launcher/flyer). Mechanic-agnostic so a ninth mechanic is covered on arrival. */
function sumScoreWeights(node: unknown, insideWeights: boolean): { found: boolean; total: number } {
  if (node === null || node === undefined) return { found: false, total: 0 };
  if (typeof node === 'number') return insideWeights ? { found: true, total: node } : { found: false, total: 0 };
  if (Array.isArray(node)) {
    let found = false;
    let total = 0;
    for (const entry of node) {
      const child = sumScoreWeights(entry, insideWeights);
      found = found || child.found;
      total += child.total;
    }
    return { found, total };
  }
  if (typeof node !== 'object') return { found: false, total: 0 };
  let found = false;
  let total = 0;
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    const nested = insideWeights || key === 'score_weights' || key.endsWith('_weight');
    const child = sumScoreWeights(value, nested);
    found = found || child.found;
    total += child.total;
  }
  return { found, total };
}

function sorterBounds(document: GameDocument, problems: GameGateProblem[]): void {
  const view = sorterView(document);
  if (view === null) return;
  const { config, content } = view;
  const tier = document.meta.tier;

  // ---- the ladder must climb ----
  for (let i = 1; i < config.ladder.length; i += 1) {
    const previous = config.ladder[i - 1];
    const current = config.ladder[i];
    if (previous === undefined || current === undefined) continue;
    if (current.spawn_interval_ticks > previous.spawn_interval_ticks) {
      problems.push(
        problem(
          4,
          `config.ladder.${i}.spawn_interval_ticks`,
          `rung ${i} spawns SLOWER than rung ${i - 1} (${current.spawn_interval_ticks} > ${previous.spawn_interval_ticks} ticks) — a difficulty ladder must not descend`,
        ),
      );
    }
    if (current.fall_speed < previous.fall_speed) {
      problems.push(
        problem(
          4,
          `config.ladder.${i}.fall_speed`,
          `rung ${i} falls SLOWER than rung ${i - 1} (${current.fall_speed} < ${previous.fall_speed} px/tick) — a difficulty ladder must not descend`,
        ),
      );
    }
    if (current.max_active < previous.max_active) {
      problems.push(
        problem(
          4,
          `config.ladder.${i}.max_active`,
          `rung ${i} allows FEWER simultaneous elements than rung ${i - 1} (${current.max_active} < ${previous.max_active})`,
        ),
      );
    }
  }

  // ---- the reaction window ----
  if (config.mode !== 'static') {
    const travel = Math.max(1, config.field.height - config.field.item_size);
    config.ladder.forEach((level, index) => {
      const speed = level.fall_speed + level.speed_variance;
      if (speed <= 0) return;
      const seconds = (travel / speed) * (TICK_MS / 1000);
      const floor = index === 0 ? MIN_REACTION_SECONDS[tier] : ABSOLUTE_MIN_REACTION_SECONDS;
      if (seconds < floor) {
        problems.push(
          problem(
            4,
            `config.ladder.${index}.fall_speed`,
            `an element crosses the field in ${seconds.toFixed(2)}s at ${speed} px/tick, below the ${floor}s a tier-${tier} player needs to read it and decide — lower fall_speed or raise field.height`,
          ),
        );
      }
    });
  }

  // ---- config <-> content ----
  if (config.category_count !== content.categories.length) {
    problems.push(
      problem(
        4,
        'config.category_count',
        `declares ${config.category_count} containers but content.categories has ${content.categories.length} — the simulator only ever accepts a DECLARED container, so the surplus is unreachable and the shortfall is unsortable`,
      ),
    );
  }

  const sortable = content.items.filter((item) => item.category !== undefined).length;
  if (!config.repeat_items && config.round.target_correct > sortable) {
    problems.push(
      problem(
        4,
        'config.round.target_correct',
        `needs ${config.round.target_correct} correct placements but only ${sortable} item(s) belong in any container and repeat_items is false — the target can never be reached`,
      ),
    );
  }

  const bestPoints = Math.max(...config.ladder.map((level) => level.points_per_correct));
  const ceiling = config.round.target_correct * bestPoints * config.combo.max;
  if (config.round.target_points > ceiling) {
    problems.push(
      problem(
        4,
        'config.round.target_points',
        `is ${config.round.target_points}, above the ${ceiling} a flawless run can earn (${config.round.target_correct} placements x ${bestPoints} points x combo ${config.combo.max})`,
      ),
    );
  }

  if (config.mode === 'static' && config.initial_fill === 0) {
    problems.push(
      problem(
        4,
        'config.initial_fill',
        'is 0 in static mode, where nothing ever falls in — the tray starts empty and stays empty',
      ),
    );
  }
}

function runnerBounds(document: GameDocument, problems: GameGateProblem[]): void {
  const config = runnerConfigOf(document);
  if (config === null) return;

  // Maximum distance the avatar can cover if it never stumbles: every phase run at its
  // own speed for its whole span, capped at the tick budget.
  const phases = [...config.speed.phases].sort((a, b) => a.from_tick - b.from_tick);
  let reachable = 0;
  for (const [index, phase] of phases.entries()) {
    const next = phases[index + 1];
    const until = Math.min(next === undefined ? config.max_ticks : next.from_tick, config.max_ticks);
    const span = Math.max(0, until - phase.from_tick);
    reachable += span * phase.units_per_tick;
  }
  if (reachable < config.target_distance) {
    problems.push(
      problem(
        4,
        'config.target_distance',
        `is ${config.target_distance} units, but the speed ramp covers at most ${reachable} units in max_ticks (${config.max_ticks}) — the finish line is unreachable at any skill level`,
      ),
    );
  }

  // Collect target vs. what the spawner can put on the track. `max_gap_units` is the
  // FEWEST patterns a run meets, so this bound never false-fails.
  const patterns = Math.max(1, Math.floor(config.target_distance / config.spawn.max_gap_units) + 1);
  const bestPerPattern = Math.max(
    0,
    ...config.spawn.patterns.map((pattern) => pattern.elements.filter((element) => element.role === 'good').length),
  );
  const collectible = patterns * bestPerPattern * config.scoring.collect_points * config.scoring.combo.max;
  if (bestPerPattern === 0 && config.scoring.collect_weight > 0) {
    problems.push(
      problem(
        4,
        'config.spawn.patterns',
        'no pattern contains a "good" element, but scoring.collect_weight is above 0 — the collection signal can never be earned',
      ),
    );
  } else if (bestPerPattern > 0 && config.scoring.collect_target > collectible) {
    problems.push(
      problem(
        4,
        'config.scoring.collect_target',
        `is ${config.scoring.collect_target}, above the ${collectible} points the spawner can put on a ${config.target_distance}-unit track`,
      ),
    );
  }
}

function launcherBounds(document: GameDocument, problems: GameGateProblem[]): void {
  const config = launcherConfigOf(document);
  if (config === null) return;

  const roundTicks = config.rounds.reduce((sum, round) => sum + round.max_ticks, 0);
  if (roundTicks > config.max_ticks) {
    problems.push(
      problem(
        4,
        'config.max_ticks',
        `is ${config.max_ticks}, less than the ${roundTicks} its ${config.rounds.length} rounds ask for — the later rounds can never be played`,
      ),
    );
  }

  const shots = config.rounds.reduce((sum, round) => sum + round.shots, 0);
  const ceiling = shots * config.scoring.hit_points * config.scoring.combo.max;
  if (config.scoring.points_target > ceiling) {
    problems.push(
      problem(
        4,
        'config.scoring.points_target',
        `is ${config.scoring.points_target}, above the ${ceiling} a flawless run can earn (${shots} shots x ${config.scoring.hit_points} points x combo ${config.scoring.combo.max})`,
      ),
    );
  }
}

function stackerBounds(document: GameDocument, problems: GameGateProblem[]): void {
  const view = stackerView(document);
  if (view === null) return;
  const { config } = view;

  // The most generous reading of the catalogue: every piece placed on its tall axis,
  // every use spent. If that still cannot reach the target, no plan can.
  const reachable = config.catalog.reduce(
    (sum, piece) => sum + Math.max(piece.w, piece.h) * piece.max_uses,
    0,
  );
  if (reachable < config.stability.target_height) {
    problems.push(
      problem(
        4,
        'config.stability.target_height',
        `is ${config.stability.target_height}, above the ${reachable} design units the whole catalogue can stack even with every piece on its tall axis`,
      ),
    );
  }
}

function explorerBounds(document: GameDocument, problems: GameGateProblem[]): void {
  const view = explorerView(document);
  if (view === null) return;
  const { config, content } = view;

  if (config.action_budget > config.tick_budget) {
    problems.push(
      problem(
        4,
        'config.action_budget',
        `is ${config.action_budget} actions but the run only lasts ${config.tick_budget} ticks, and every action costs at least one tick — the efficiency signal is unreachable`,
      ),
    );
  }

  if (config.collectibles.enabled) {
    const placed = content.nodes.filter((node) => node.collectible !== undefined).length;
    if (config.collectibles.target > placed) {
      problems.push(
        problem(
          4,
          'config.collectibles.target',
          `asks for ${config.collectibles.target} but only ${placed} node(s) carry a collectible`,
        ),
      );
    }
  }
}

function defenderBounds(document: GameDocument, problems: GameGateProblem[]): void {
  const config = defenderConfigOf(document);
  if (config === null) return;

  // Every wave costs its prep window plus the time its slowest group takes to finish
  // spawning. A tick budget under that sum ends the run mid-content.
  let needed = 0;
  for (const wave of config.waves) {
    const spawnTicks = Math.max(
      0,
      ...wave.groups.map((group) => group.start_tick + (group.count - 1) * group.interval_ticks),
    );
    needed += config.prep_ticks + spawnTicks;
  }
  if (needed > config.tick_budget) {
    problems.push(
      problem(
        4,
        'config.tick_budget',
        `is ${config.tick_budget}, less than the ${needed} ticks its ${config.waves.length} waves need just to prep and spawn — the last waves can never arrive`,
      ),
    );
  }
}

function autobattlerBounds(document: GameDocument, problems: GameGateProblem[]): void {
  const config = autobattlerConfigOf(document);
  if (config === null) return;

  if (config.targets.rounds_won > config.rounds.length) {
    problems.push(
      problem(
        4,
        'config.targets.rounds_won',
        `asks for ${config.targets.rounds_won} wins but only ${config.rounds.length} round(s) are played`,
      ),
    );
  }

  const perRound = config.prep.max_ticks + config.combat.max_combat_ticks * config.combat.engine_ticks_per_combat_tick;
  const needed = perRound * config.rounds.length;
  if (needed > config.max_ticks) {
    problems.push(
      problem(
        4,
        'config.max_ticks',
        `is ${config.max_ticks}, less than the ${needed} ticks its ${config.rounds.length} rounds can take (${perRound} each) — the run ends before its own content does`,
      ),
    );
  }
}

function flyerBounds(document: GameDocument, problems: GameGateProblem[]): void {
  const config = flyerConfigOf(document);
  if (config === null) return;

  const reachable = config.mount.top_speed * config.max_ticks;
  if (reachable < config.target_distance) {
    problems.push(
      problem(
        4,
        'config.target_distance',
        `is ${config.target_distance} units, but a mount held at top_speed (${config.mount.top_speed}) for all ${config.max_ticks} ticks covers only ${Math.floor(reachable)} — the goal is unreachable`,
      ),
    );
  }
}

export function runConfigBoundsGate(document: GameDocument): GameGateProblem[] {
  const problems: GameGateProblem[] = [];
  const { scoring, meta, adaptive } = document;

  // ---- shared bounds ----
  if (scoring.mode === 'cheer' && scoring.lives !== null && scoring.lives !== undefined) {
    problems.push(
      problem(4, 'scoring.lives', `is ${scoring.lives} in cheer mode — cheer has no fail state, lives must be null`),
    );
  }
  if (scoring.mode === 'arcade' && (scoring.lives === null || scoring.lives === undefined)) {
    problems.push(problem(4, 'scoring.lives', 'is null in arcade mode — arcade needs a number of lives to spend'));
  }
  if (scoring.pass_score < MIN_PASS_SCORE) {
    problems.push(
      problem(
        4,
        'scoring.pass_score',
        `is ${scoring.pass_score} — a pass score of 0 grants XP for doing nothing, which is exactly what the random-bot half of the winnability gate exists to refuse`,
      ),
    );
  }
  if (scoring.pass_score > MAX_PASS_SCORE) {
    problems.push(
      problem(
        4,
        'scoring.pass_score',
        `is ${scoring.pass_score}, above the ${MAX_PASS_SCORE} ceiling — a single unavoidable penalty then makes an otherwise flawless run a failure`,
      ),
    );
  }
  if (adaptive?.enabled === true && adaptive.ease_factor >= 1) {
    problems.push(
      problem(
        4,
        'adaptive.ease_factor',
        `is ${adaptive.ease_factor} with adaptive.enabled true — a factor of 1 eases nothing, so the assistance the document promises never arrives`,
      ),
    );
  }

  const weights = sumScoreWeights(document.config, false);
  if (weights.found && weights.total <= 0) {
    problems.push(
      problem(
        4,
        'config.score_weights',
        'every scoring weight is 0 — no signal carries any share, so the score is a constant and the pass_score is meaningless',
      ),
    );
  }

  const ticks = tickBudgetForMechanic(document);
  if (ticks !== null) {
    const budgetSeconds = (ticks * TICK_MS) / 1000;
    if (budgetSeconds > meta.estimated_minutes * 60) {
      problems.push(
        problem(
          4,
          'meta.estimated_minutes',
          `promises ${meta.estimated_minutes} min but the hard tick budget allows ${(budgetSeconds / 60).toFixed(1)} min — the estimate a child is shown must cover the run it may actually get`,
        ),
      );
    }
  }

  // ---- per-mechanic bounds ----
  sorterBounds(document, problems);
  runnerBounds(document, problems);
  launcherBounds(document, problems);
  stackerBounds(document, problems);
  explorerBounds(document, problems);
  defenderBounds(document, problems);
  autobattlerBounds(document, problems);
  flyerBounds(document, problems);

  return problems;
}

// ---- Gate 5: economy solvency ---------------------------------------------------------
//
// THE GATE NO JUDGE REPLACES. Four mechanics teach a resource decision (stacker's
// budget, defender's gold, autobattler's income/interest, flyer's energy reserve), and
// in every one of them the author picks BOTH the price list and the amount of money.
// Get that pair wrong and the challenge is not hard, it is arithmetically unwinnable —
// and an LLM reading the manifest will not add the numbers up. Neither will the bot
// gate say why: it reports "the perfect bot scored 0".
//
// Every bound below is a LOWER bound on what any winning line must spend, so a failure
// here is a proof, never a heuristic.

function stackerSolvency(document: GameDocument, problems: GameGateProblem[]): void {
  const view = stackerView(document);
  if (view === null) return;
  const { config, content } = view;
  const { budget } = config.economy;

  const costs = config.catalog.map((piece) => ({ piece, cost: costOfPiece(config, piece) }));
  const cheapest = Math.min(...costs.map((entry) => entry.cost));
  const tallest = Math.max(...config.catalog.map((piece) => Math.max(piece.w, piece.h)));

  if (tallest > 0) {
    const minPieces = Math.ceil(config.stability.target_height / tallest);
    const floor = minPieces * cheapest;
    if (floor > budget) {
      problems.push(
        problem(
          5,
          'config.economy.budget',
          `is ${budget}, but reaching stability.target_height (${config.stability.target_height}) needs at least ${minPieces} piece(s) and the cheapest costs ${cheapest} — no plan can afford ${floor}`,
        ),
      );
    }
  }

  // The authored model answer is `content.roles.foundation`. If the document's own
  // "this is what a stable plan looks like" set is unaffordable, the lesson contradicts
  // the economy it is teaching.
  let foundationCost = 0;
  const unpriced: string[] = [];
  for (const id of content.roles.foundation) {
    const entry = costs.find((candidate) => candidate.piece.item_id === id);
    if (entry === undefined) {
      unpriced.push(id);
      continue;
    }
    foundationCost += entry.cost;
  }
  if (unpriced.length > 0) {
    problems.push(
      problem(
        5,
        'content.roles.foundation',
        `names ${unpriced.map((id) => `"${id}"`).join(', ')}, which no config.catalog entry prices — the recommended plan cannot be bought`,
      ),
    );
  } else if (foundationCost > budget) {
    problems.push(
      problem(
        5,
        'config.economy.budget',
        `is ${budget}, less than the ${foundationCost} the document's own foundation plan (${content.roles.foundation.join(', ')}) costs — the recommended solution is unaffordable`,
      ),
    );
  }
}

function defenderSolvency(document: GameDocument, problems: GameGateProblem[]): void {
  const config = defenderConfigOf(document);
  if (config === null) return;
  const { economy, build, efficiency } = config;

  const cheapestTower = Math.min(...config.towers.map((tower) => tower.cost));
  if (cheapestTower > economy.starting_gold) {
    problems.push(
      problem(
        5,
        'config.economy.starting_gold',
        `is ${economy.starting_gold}, below the cheapest tower (${cheapestTower}) — wave 1 arrives with nothing the player could have built`,
      ),
    );
  }

  // Optimistic total gold: every wave cleared, nothing ever spent, interest ignored.
  let gold = economy.starting_gold;
  for (const wave of config.waves) {
    gold += economy.wave_clear_bonus + wave.bonus_gold;
  }
  const authoredSolution = efficiency.wall_budget * build.wall_cost + cheapestTower;
  if (authoredSolution > gold) {
    problems.push(
      problem(
        5,
        'config.efficiency.wall_budget',
        `describes a solution costing at least ${authoredSolution} (${efficiency.wall_budget} walls x ${build.wall_cost} + one ${cheapestTower} tower), but clearing every wave without spending yields only ${gold} gold`,
      ),
    );
  }

  const secondary = economy.secondary;
  if (secondary !== undefined) {
    const enemies = config.waves.reduce(
      (sum, wave) => sum + wave.groups.reduce((groupSum, group) => groupSum + group.count, 0),
      0,
    );
    const gems =
      secondary.starting + secondary.per_wave * config.waves.length + secondary.per_kill * enemies;
    const cheapestAbility = Math.min(...secondary.abilities.map((ability) => ability.cost));
    if (cheapestAbility > gems) {
      problems.push(
        problem(
          5,
          'config.economy.secondary.starting',
          `a whole flawless run yields ${gems} gems, below the cheapest ability (${cheapestAbility}) — the ability layer is dead content the child can see and never use`,
        ),
      );
    }
  }
}

function autobattlerSolvency(document: GameDocument, problems: GameGateProblem[]): void {
  const config = autobattlerConfigOf(document);
  if (config === null) return;
  const { economy, targets } = config;

  const cheapestUnit = Math.min(...config.units.map((unit) => unit.cost));
  if (economy.start_gold < cheapestUnit) {
    problems.push(
      problem(
        5,
        'config.economy.start_gold',
        `is ${economy.start_gold}, below the cheapest unit (${cheapestUnit}) — round 1 is fought with an empty board`,
      ),
    );
  }

  // Every gold the run can ever produce, spending nothing: the start plus each round's
  // capped base income. Interest is excluded on purpose — it is what we are testing.
  let income = economy.start_gold;
  for (let round = 0; round < config.rounds.length; round += 1) {
    income += Math.min(economy.income_cap, economy.base_income + economy.income_growth_per_round * round);
  }

  const perRound = economy.interest.max_steps * economy.interest.amount_per_step;
  const maxInterest = perRound * config.rounds.length;
  if (targets.interest > maxInterest) {
    problems.push(
      problem(
        5,
        'config.targets.interest',
        `asks for ${targets.interest} but ${config.rounds.length} rounds can pay at most ${maxInterest} (${economy.interest.max_steps} steps x ${economy.interest.amount_per_step} per round) — the saving target is unreachable`,
      ),
    );
  }
  if (targets.interest > 0 && income < economy.interest.gold_per_step) {
    problems.push(
      problem(
        5,
        'config.economy.base_income',
        `the whole run yields ${income} gold, below the ${economy.interest.gold_per_step} one interest step requires — the child can never bank enough to earn any interest at all`,
      ),
    );
  }
}

function flyerSolvency(document: GameDocument, problems: GameGateProblem[]): void {
  const config = flyerConfigOf(document);
  if (config === null) return;
  const { energy, upgrades, lanes, scoring } = config;

  const capacity = energy.capacity + upgrades.energy_capacity_bonus;
  if (energy.manoeuvre_cost > capacity) {
    problems.push(
      problem(
        5,
        'config.energy.manoeuvre_cost',
        `is ${energy.manoeuvre_cost}, above the ${capacity} the reserve can ever hold — a single climb or dive can never be paid for`,
      ),
    );
  }
  if (lanes.enabled && lanes.energy_cost > capacity) {
    problems.push(
      problem(
        5,
        'config.lanes.energy_cost',
        `is ${lanes.energy_cost}, above the ${capacity} the reserve can ever hold — a lane shift can never be paid for`,
      ),
    );
  }

  // The energy SIGNAL has to be losable, or its weight is free marks.
  const bestRegen = Math.max(
    energy.level_regen_per_tick,
    energy.glide_regen_per_tick,
    energy.thermal_regen_per_tick,
  );
  const obtainable = energy.start + bestRegen * config.max_ticks;
  if (scoring.energy_weight > 0 && scoring.energy_budget > obtainable) {
    problems.push(
      problem(
        5,
        'config.scoring.energy_budget',
        `is ${scoring.energy_budget}, above the ${obtainable} energy a whole run can even hold or regenerate — the energy signal can never be spent down, so its weight is free marks rather than a decision`,
      ),
    );
  }
}

export function runEconomySolvencyGate(document: GameDocument): GameGateProblem[] {
  const problems: GameGateProblem[] = [];
  stackerSolvency(document, problems);
  defenderSolvency(document, problems);
  autobattlerSolvency(document, problems);
  flyerSolvency(document, problems);
  return problems;
}

// ---- Gate 6: sidecar consistency --------------------------------------------------------
//
// `game_documents.validation` is the ANTI-CHEAT ENVELOPE Core enforces on the reward
// path: it caps the input log, floors the duration and bounds the score. A wrong bound
// is not cosmetic — too tight rejects honest children with a `422 RESULT_REJECTED` and
// no XP, too loose hands a forged log the grant it was built to steal. Nothing else in
// the pipeline looks at these three numbers, so this gate is their only check.

/** The fewest input events an honest, flawless run needs. Deliberately CONSERVATIVE
 *  (an underestimate), because it is compared with `>=`: overestimating would reject a
 *  correct sidecar. `null` when the mechanic gives no honest floor. */
function minimumEventsForPerfectRun(document: GameDocument): { events: number; why: string } | null {
  const mechanic: MechanicId = document.meta.mechanic;
  switch (mechanic) {
    case 'sorter': {
      const view = sorterView(document);
      if (view === null) return null;
      return {
        events: view.config.round.target_correct,
        why: `one placement per required correct sort (round.target_correct = ${view.config.round.target_correct})`,
      };
    }
    case 'stacker': {
      const view = stackerView(document);
      if (view === null) return null;
      const pieces = view.content.roles.foundation.length;
      return { events: pieces, why: `one placement per foundation piece (${pieces})` };
    }
    case 'launcher': {
      const config = launcherConfigOf(document);
      if (config === null) return null;
      const targets = config.rounds.reduce((sum, round) => sum + round.targets.length, 0);
      return { events: targets, why: `at least one shot per declared target (${targets})` };
    }
    case 'explorer': {
      const config = explorerConfigOf(document);
      if (config === null) return null;
      return { events: config.action_budget, why: `the authored action_budget (${config.action_budget})` };
    }
    case 'defender': {
      const config = defenderConfigOf(document);
      if (config === null) return null;
      return { events: config.waves.length, why: `at least one build action per wave (${config.waves.length})` };
    }
    case 'autobattler': {
      const config = autobattlerConfigOf(document);
      if (config === null) return null;
      return { events: config.rounds.length, why: `at least one shop action per round (${config.rounds.length})` };
    }
    case 'runner': {
      const config = runnerConfigOf(document);
      if (config === null) return null;
      const patterns = Math.max(1, Math.floor(config.target_distance / config.spawn.max_gap_units));
      return { events: patterns, why: `one action per spawned pattern at the widest gap (${patterns})` };
    }
    case 'flyer': {
      const config = flyerConfigOf(document);
      if (config === null) return null;
      const patterns = Math.max(1, Math.floor(config.target_distance / config.spawn.max_gap_units));
      return { events: patterns, why: `one action per spawned pattern at the widest gap (${patterns})` };
    }
  }
}

/** Every simulator normalizes to a 0..100 integer (GAME_ENGINE.md §6, core/scoring.ts),
 *  so the sidecar's theoretical maximum is 100 for every mechanic that exists. */
const NORMALIZED_MAX_SCORE = 100;

function explorerConfigOf(document: GameDocument): ExplorerConfig | null {
  return explorerView(document)?.config ?? null;
}

export function runSidecarConsistencyGate(
  document: GameDocument,
  validation: GameValidation,
): GameGateProblem[] {
  const problems: GameGateProblem[] = [];

  // ---- max_score ----
  if (validation.max_score !== NORMALIZED_MAX_SCORE) {
    problems.push(
      problem(
        6,
        'validation.max_score',
        `is ${validation.max_score}; every simulator normalizes its result to 0..100 (GAME_ENGINE.md §6), so the theoretical maximum is ${NORMALIZED_MAX_SCORE}`,
      ),
    );
  }
  if (validation.max_score < document.scoring.pass_score) {
    problems.push(
      problem(
        6,
        'validation.max_score',
        `is ${validation.max_score}, below scoring.pass_score (${document.scoring.pass_score}) — the document declares a pass nobody can reach`,
      ),
    );
  }

  const ticks = tickBudgetForMechanic(document);

  // ---- min_duration_seconds ----
  if (ticks !== null) {
    const longestRunSeconds = (ticks * TICK_MS) / 1000;
    if (validation.min_duration_seconds > longestRunSeconds) {
      problems.push(
        problem(
          6,
          'validation.min_duration_seconds',
          `is ${validation.min_duration_seconds}s, longer than the ${longestRunSeconds}s the hard tick budget (${ticks} ticks) even allows — every honest attempt would be rejected as too fast`,
        ),
      );
    }
  }
  if (validation.min_duration_seconds > document.meta.estimated_minutes * 60) {
    problems.push(
      problem(
        6,
        'validation.min_duration_seconds',
        `is ${validation.min_duration_seconds}s, above the ${document.meta.estimated_minutes * 60}s meta.estimated_minutes advertises — a child who plays exactly as long as promised is rejected`,
      ),
    );
  }

  // ---- max_events ----
  const minimum = minimumEventsForPerfectRun(document);
  if (minimum !== null && validation.max_events < minimum.events) {
    problems.push(
      problem(
        6,
        'validation.max_events',
        `is ${validation.max_events}, below the ${minimum.events} a flawless run needs — ${minimum.why}. The cap would reject the very run this game is designed around`,
      ),
    );
  }
  if (ticks !== null) {
    const structuralCap = (ticks + 1) * DEFAULT_MAX_EVENTS_PER_TICK;
    if (validation.max_events > structuralCap) {
      problems.push(
        problem(
          6,
          'validation.max_events',
          `is ${validation.max_events}, above the engine's own structural ceiling of ${structuralCap} (${DEFAULT_MAX_EVENTS_PER_TICK} events per tick over ${ticks} ticks) — a cap looser than that is not an envelope, it is a formality`,
        ),
      );
    }
  }

  // ---- item_values ----
  const values = validation.item_values;
  if (values !== undefined) {
    const byId = new Map(document.content.items.map((item) => [item.id, item]));
    for (const id of Object.keys(values).sort()) {
      const declared = values[id];
      const item = byId.get(id);
      if (item === undefined) {
        problems.push(
          problem(6, `validation.item_values.${id}`, `"${id}" is not a declared content.items id`),
        );
        continue;
      }
      if (item.value !== undefined && declared !== undefined && item.value !== declared) {
        problems.push(
          problem(
            6,
            `validation.item_values.${id}`,
            `is ${declared} but content.items declares value ${item.value} — the server bound and the played value must be the same number`,
          ),
        );
      }
    }
  }

  return problems;
}

// ---- Gate 7: readability ------------------------------------------------------------------
//
// PORTED FROM `coursegen/src/pipeline/readability.ts` (no workspaces, so it is copied
// rather than imported): one formula per locale, never a shared threshold, and the
// per-tier bands calibrated there against 186 judge-approved published documents. The
// gate exists to catch prose that reads like an adult paragraph BEFORE a paid judge
// call — it is an outlier detector, not a grade-level argument.
//
//   en-US  Flesch-Kincaid GRADE LEVEL (lower = easier)
//   es-MX  Fernández-Huerta EASE      (higher = easier)
//   pt-BR  Flesch EASE, PT-adapted    (higher = easier)

const VOWELS: Record<GameLocale, RegExp> = {
  'en-US': /[aeiouy]+/gi,
  'es-MX': /[aeiouáéíóúü]+/gi,
  'pt-BR': /[aeiouáéíóúâêôãõà]+/gi,
};

/** Heuristic syllables for one word (>=1 by definition). */
export function syllableCount(word: string, locale: GameLocale): number {
  const clean = word.toLowerCase().replace(/[^a-záéíóúüâêôãõàñç]/gi, '');
  if (clean.length === 0) return 0;
  const groups = clean.match(VOWELS[locale]);
  let count = groups ? groups.length : 1;
  // English: silent final e ("make") unless the word ends in -le ("table").
  if (locale === 'en-US' && /e$/.test(clean) && !/le$/.test(clean) && count > 1) count -= 1;
  return Math.max(1, count);
}

/**
 * The locale's readability number. The MEANING differs per locale (en-US is a grade,
 * the other two are ease scores), so callers must never compare across locales.
 * `null` when there is too little text for the formulas to mean anything.
 */
export function readabilityScore(text: string, locale: GameLocale): number | null {
  const plain = text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~#>]/g, '')
    .trim();
  const words = plain.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word));
  const sentences = Math.max(
    1,
    plain
      .split(/[.!?…]+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 0).length,
  );
  if (words.length < 30) return null;

  const syllables = words.reduce((sum, word) => sum + syllableCount(word, locale), 0);
  const asl = words.length / sentences;
  const asw = syllables / words.length;
  switch (locale) {
    case 'en-US':
      return 0.39 * asl + 11.8 * asw - 15.59;
    case 'es-MX':
      return 206.84 - 0.6 * (asw * 100) - 1.02 * (100 / asl);
    case 'pt-BR':
      return 248.835 - 1.015 * asl - 84.6 * asw;
  }
}

const EN_MAX_GRADE: Record<GameTier, number> = { 1: 9, 2: 11, 3: 13 };
const ES_MIN_EASE: Record<GameTier, number> = { 1: 66, 2: 60, 3: 54 };
const PT_MIN_EASE: Record<GameTier, number> = { 1: 58, 2: 52, 3: 46 };

/**
 * The prose a player actually READS around the play: the concept recap, the results
 * card, the rotating feedback and the interlude questions. Item labels are excluded on
 * purpose — they are two-word canvas captions, and feeding fragments to a
 * sentence-length formula measures nothing.
 */
export function learnerText(document: GameDocument): string {
  const parts: string[] = [document.meta.concept.recap_md, document.content.feedback.results_md];
  parts.push(...document.content.feedback.correct_md, ...document.content.feedback.incorrect_md);
  for (const interlude of document.content.interludes ?? []) {
    parts.push(interlude.prompt_md);
    for (const option of interlude.options) {
      if (option.rationale_md !== undefined) parts.push(option.rationale_md);
    }
  }
  return parts.join(' ');
}

export function runReadabilityGate(document: GameDocument): GameGateProblem[] {
  const locale = document.meta.locale;
  const tier = document.meta.tier;
  const score = readabilityScore(learnerText(document), locale);
  if (score === null) return [];

  if (locale === 'en-US') {
    const max = EN_MAX_GRADE[tier];
    if (score > max) {
      return [
        problem(
          7,
          'content.feedback',
          `the recap and feedback measure Flesch-Kincaid grade ${score.toFixed(1)}, above the tier-${tier} ceiling of ${max} — shorten sentences and prefer everyday words`,
        ),
      ];
    }
    return [];
  }

  const min = locale === 'es-MX' ? ES_MIN_EASE[tier] : PT_MIN_EASE[tier];
  if (score < min) {
    return [
      problem(
        7,
        'content.feedback',
        `the recap and feedback measure ease ${score.toFixed(0)} (${locale === 'es-MX' ? 'Fernández-Huerta' : 'Flesch-PT'}), below the tier-${tier} floor of ${min} — shorten sentences and prefer everyday words`,
      ),
    ];
  }
  return [];
}

// ---- Gate 8: anti-genericity ----------------------------------------------------------------
//
// The schema proves a document is WELL-FORMED. It cannot prove it is worth playing.
// Forge's equivalent gate exists because the 2026-07-23 manual QA found lessons that
// were mechanically valid and boring; the game version of that failure is a manifest
// full of "Objeto 1", feedback that rotates between three identical sentences, and a
// recap that restates the title. Every check below is zero-false-positive by
// construction: it fires only on content that is unambiguously placeholder-shaped.

/** `Item 1`, `Objeto 2`, `Categoria 3`, `bin-4` … in the three locales. */
const PLACEHOLDER_LABEL_RE =
  /^(item|element|thing|object|category|bin|group|tile|card|objeto|elemento|cosa|categoria|grupo|caja|carta|coisa|caixa)[\s#_-]*\d+$/;

/** Curated per-locale filler — deliberately short, grown only from real offenders
 *  (coursegen's rule: a gate that cries wolf trains people to ignore it). */
const BANNED_FILLER_BY_LOCALE: Record<GameLocale, readonly string[]> = {
  'es-MX': ['es muy importante', 'como ya sabemos', 'en este juego aprenderas', 'sigue intentando'],
  'en-US': ['this is very important', 'as we already know', 'in this game you will learn', 'keep trying'],
  'pt-BR': ['isso e muito importante', 'como ja sabemos', 'neste jogo voce vai aprender', 'continue tentando'],
};

/** Words that make a miss feel like a verdict. `incorrect_md` is outcome-neutral by
 *  contract (core/schemaBase.ts: "never punishing — no red WRONG in a kid product") and
 *  nothing else enforces it. */
const PUNISHING_BY_LOCALE: Record<GameLocale, readonly string[]> = {
  'es-MX': ['mal', 'fallaste', 'perdiste', 'error', 'incorrecto'],
  'en-US': ['wrong', 'you failed', 'you lost', 'incorrect', 'bad'],
  'pt-BR': ['errado', 'voce perdeu', 'falhou', 'incorreto'],
};

function tokensOf(value: string): string[] {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4);
}

/** Normalized edit distance <= 20% of the longer string — coursegen's calibrated
 *  near-duplicate test, ported rather than reinvented. Token OVERLAP was tried first
 *  and rejected: a good recap legitimately reuses the title's content words ("ahorro"
 *  in a game called "Ahorro total"), so an overlap rule fails exactly the documents it
 *  should pass. Edit distance only fires when one string genuinely restates the other. */
const NEAR_DUPLICATE_MAX_RATIO = 0.2;

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i += 1) {
    const curr: number[] = [i];
    for (let j = 1; j <= n; j += 1) {
      const cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
      curr.push(Math.min((prev[j] ?? 0) + 1, (curr[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost));
    }
    prev = curr;
  }
  return prev[n] ?? 0;
}

function isNearDuplicateText(left: string, right: string): boolean {
  const a = normalizeText(left).trim();
  const b = normalizeText(right).trim();
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return false;
  return levenshteinDistance(a, b) / longest <= NEAR_DUPLICATE_MAX_RATIO;
}

export function runAntiGenericityGate(
  document: GameDocument,
  opts: { topicTitle?: string } = {},
): GameGateProblem[] {
  const problems: GameGateProblem[] = [];
  const { content, meta } = document;
  const locale = meta.locale;

  // ---- items ----
  const categoryLabels = new Map(
    (content.categories ?? []).map((category) => [category.id, category.label_md]),
  );
  const labelCounts = new Map<string, number>();

  for (const [index, item] of content.items.entries()) {
    const at = `content.items.${index}.label_md`;
    const normalized = normalizeText(item.label_md).trim();

    if (PLACEHOLDER_LABEL_RE.test(normalized)) {
      problems.push(
        problem(
          8,
          at,
          `"${item.label_md}" is a placeholder, not a thing a child recognizes — name the concrete object the concept is about`,
        ),
      );
    }
    if (normalized === normalizeText(item.id).replace(/[_-]+/g, ' ').trim()) {
      problems.push(
        problem(8, at, `"${item.label_md}" just repeats the id "${item.id}" — the label is what the child reads on the canvas`),
      );
    }
    const categoryLabel = item.category === undefined ? undefined : categoryLabels.get(item.category);
    if (categoryLabel !== undefined && normalizeText(categoryLabel).trim() === normalized) {
      problems.push(
        problem(
          8,
          at,
          `"${item.label_md}" is identical to its category label — sorting an item into the bin that shares its name is a reading test, not a concept decision`,
        ),
      );
    }
    labelCounts.set(normalized, (labelCounts.get(normalized) ?? 0) + 1);
  }

  for (const [label, count] of [...labelCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (count > 1) {
      problems.push(
        problem(
          8,
          'content.items',
          `${count} items share the label "${label}" — two identical captions on one canvas are indistinguishable to the player`,
        ),
      );
    }
  }

  // ---- categories ----
  for (const [index, category] of (content.categories ?? []).entries()) {
    if (PLACEHOLDER_LABEL_RE.test(normalizeText(category.label_md).trim())) {
      problems.push(
        problem(
          8,
          `content.categories.${index}.label_md`,
          `"${category.label_md}" is a placeholder — name the idea the container stands for`,
        ),
      );
    }
  }

  // ---- feedback ----
  const fillers = BANNED_FILLER_BY_LOCALE[locale].map((phrase) => normalizeText(phrase));
  const punishing = PUNISHING_BY_LOCALE[locale].map((word) => ({ word, re: buildForbiddenRegex(word) }));

  const lines: { field: string; values: readonly string[] }[] = [
    { field: 'content.feedback.correct_md', values: content.feedback.correct_md },
    { field: 'content.feedback.incorrect_md', values: content.feedback.incorrect_md },
  ];
  for (const { field, values } of lines) {
    const seen = new Set<string>();
    for (const [index, value] of values.entries()) {
      const normalized = normalizeText(value).trim();
      if (seen.has(normalized)) {
        problems.push(
          problem(8, `${field}.${index}`, `"${value}" repeats an earlier line — rotating feedback that repeats does not rotate`),
        );
      }
      seen.add(normalized);
      for (const [fillerIndex, filler] of fillers.entries()) {
        if (normalized.includes(filler)) {
          problems.push(
            problem(
              8,
              `${field}.${index}`,
              `contains the filler phrase "${BANNED_FILLER_BY_LOCALE[locale][fillerIndex] ?? filler}" — say something about what just happened instead`,
            ),
          );
        }
      }
    }
  }
  for (const [index, value] of content.feedback.incorrect_md.entries()) {
    const normalized = normalizeText(value);
    for (const { word, re } of punishing) {
      if (re.test(normalized)) {
        problems.push(
          problem(
            8,
            `content.feedback.incorrect_md.${index}`,
            `"${value}" uses "${word}" — a miss is outcome-neutral in this product, never a verdict on the child`,
          ),
        );
      }
    }
  }

  // ---- recap & results ----
  const recap = meta.concept.recap_md;
  if (isNearDuplicateText(recap, meta.title)) {
    problems.push(
      problem(
        8,
        'meta.concept.recap_md',
        `restates meta.title ("${meta.title}") — the recap is what the child just LEARNED, not what the game is called`,
      ),
    );
  }
  if (opts.topicTitle !== undefined && isNearDuplicateText(recap, opts.topicTitle)) {
    problems.push(
      problem(
        8,
        'meta.concept.recap_md',
        `restates the topic title ("${opts.topicTitle}") — say what the child can now DO, in their own words`,
      ),
    );
  }

  // The results card must be traceable to this game: a number, a canon character, or a
  // word the content actually uses. Anything else is a sentence that would fit any game
  // ever generated. (Forge's `genericityExplanation`, same heuristic.)
  const results = content.feedback.results_md;
  const contentTokens = new Set<string>();
  for (const item of content.items) for (const token of tokensOf(item.label_md)) contentTokens.add(token);
  for (const category of content.categories ?? []) {
    for (const token of tokensOf(category.label_md)) contentTokens.add(token);
  }
  for (const token of tokensOf(recap)) contentTokens.add(token);

  const canon: readonly string[] = CHARACTER_IDS;
  const traceable =
    /\d/.test(results) ||
    canon.some((id) => normalizeText(results).includes(id)) ||
    tokensOf(results).some((token) => contentTokens.has(token));
  if (!traceable) {
    problems.push(
      problem(
        8,
        'content.feedback.results_md',
        `"${results.slice(0, 80)}" names nothing from this game — no number, no character, no word from its items or recap. It would fit any game ever generated`,
      ),
    );
  }

  // ---- the misconception rule (teaching value, GAME_ENGINE.md §9 `gate`) ----
  for (const [index, interlude] of (content.interludes ?? []).entries()) {
    for (const [optionIndex, option] of interlude.options.entries()) {
      if (!option.correct && option.rationale_md === undefined) {
        problems.push(
          problem(
            8,
            `content.interludes.${index}.options.${optionIndex}.rationale_md`,
            `the wrong option "${option.label_md}" carries no rationale — a distractor without a reason teaches nothing, it only costs points`,
          ),
        );
      }
    }
  }

  return problems;
}

// ---- Orchestration -----------------------------------------------------------------------

/**
 * The eight gates, in order, cheap-first. Gate 1 short-circuits: with no typed document
 * every later gate would either crash or report noise on top of the real cause.
 *
 * Never throws. A gate stage that threw would turn a content defect into a crashed run,
 * and the whole point of `gate` owning no checkpoint state is that its output goes back
 * into the author's corrective-retry loop as feedback.
 */
export function runAllGates(
  rawDocument: unknown,
  rawSidecar: unknown,
  ctx: GameGateContext,
): GameGateReport {
  const gate1 = runContractGate(rawDocument, rawSidecar);
  if (!gate1.ok || gate1.document === undefined || gate1.validation === undefined) {
    return { ok: false, problems: gate1.problems };
  }
  const document = gate1.document;
  const validation = gate1.validation;

  const vocabulary: ForbiddenVocabularyResult =
    ctx.forbiddenVocabulary === undefined
      ? loadForbiddenVocabulary({
          course: ctx.course,
          tier: document.meta.tier,
          locale: document.meta.locale,
          ...(ctx.coursegenCurriculumRoot === undefined
            ? {}
            : { coursegenCurriculumRoot: ctx.coursegenCurriculumRoot }),
        })
      : { words: ctx.forbiddenVocabulary };

  const problems: GameGateProblem[] = [
    ...runVocabularyGate(document, vocabulary),
    ...runReferentialIntegrityGate(document),
    ...runConfigBoundsGate(document),
    ...runEconomySolvencyGate(document),
    ...runSidecarConsistencyGate(document, validation),
    ...runReadabilityGate(document),
    ...runAntiGenericityGate(document, ctx.topicTitle === undefined ? {} : { topicTitle: ctx.topicTitle }),
  ];

  return { ok: problems.length === 0, problems, document, validation };
}
