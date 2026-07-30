// Run orchestration — wires validate → plan → author → gate → simulate → judge →
// localize → illustrate → publish per slot, with checkpoint/resume, a small
// concurrency pool, and the budget kill switches (GAME_ENGINE.md §9).
//
// Ported from `coursegen/src/pipeline/run.ts`. Forge is battle-tested against real
// paid runs and every defensive branch below records a failure that actually
// happened; Arcade inherits the fixes verbatim (gamegen/AGENTS.md).
//
// THE ORDERING FACT (GAME_ENGINE.md §9, and the whole reason the stage list looks
// the way it does): `illustrate` runs on the es-MX document BEFORE the `localize`
// string-freeze. `sprites`, `background_url`, `palette`, `sfx` and `bgm` are
// CONTAINER keys `nonVisibleKeys.ts` skips, so they copy verbatim into en-US and
// pt-BR — ONE image serves THREE locales. The separate `illustrated` checkpoint
// state is the belt-and-braces sweep that follows, which makes ZERO Prism calls on
// the happy path.

import path from 'node:path';
import {
  getConfig,
  requireGenerationKeys,
  requireIllustrationKeys,
  requirePublishKeys,
} from '../env.js';
import { loadGameCatalog } from '../catalog/loader.js';
import type { GameBlueprint, GamesFile } from '../catalog/schema.js';
import { GAME_LOCALES } from '../contract/core/types.js';
import type {
  GameDocument,
  GameLocale,
  GameValidation,
  MechanicId,
} from '../contract/core/types.js';
import { isMechanicId } from '../contract/registry.js';
import { UsageLedger, BudgetExceededError } from '../providers/usage.js';
import { isFatalProviderError } from '../providers/errors.js';
import {
  CheckpointStore,
  newRunCheckpoint,
  getSlot,
  setSlotState,
  isSlotDone,
  describeParamMismatch,
  type RunCheckpoint,
  type RunParams,
  type SlotState,
} from './checkpoint.js';
import { planGame, type PlanContext, type PlanSkeleton } from './plan.js';
import { authorGameDocument, type AuthorContext, type AuthorGateReport } from './author.js';
import {
  runAllGates,
  runVocabularyGate,
  loadForbiddenVocabulary,
  type GameGateContext,
} from './gates.js';
import { simulateGate } from './simulateGate.js';
import {
  judgeGame,
  GameJudgeEscalationError,
  GameRubricLog,
  type GameRubric,
} from './judge.js';
import { localizeGame, type GameTargetLocale, type LocalizeGameProblem } from './localize.js';
import { illustrateGame, type GameImageInheritance, type GameImageSkipReason } from './images.js';
import { publishGameSlot, type PublishGameResult } from './publish.js';

/**
 * es-MX authors, en-US + pt-BR are derived from it by the string-freeze.
 *
 * Typed as the LITERAL (not widened to `GameLocale`) on purpose: it is what lets
 * `locale === AUTHORING_LOCALE ? continue : …` narrow the loop variable to
 * `GameTargetLocale`, so `localizeGame` can never be handed its own source locale.
 */
const AUTHORING_LOCALE = 'es-MX' as const satisfies GameLocale;
const DEFAULT_LOCALES: GameLocale[] = ['es-MX', 'en-US', 'pt-BR'];

/**
 * Run ids are namespaced so they can NEVER collide with a Forge run id in the
 * shared `generation_runs` / `generation_slots` telemetry tables (GAME_ENGINE.md §9:
 * `games-<courseSlug>-<ISO8601>`). An operator-supplied --run-id is normalized into
 * the same namespace deterministically, so a resume with the same flag resolves to
 * the same directory.
 */
export const RUN_ID_PREFIX = 'games-';

export function namespaceRunId(runId: string): string {
  return runId.startsWith(RUN_ID_PREFIX) ? runId : `${RUN_ID_PREFIX}${runId}`;
}

// ---- Slot enumeration -------------------------------------------------------------

export interface GameSlot {
  /** `"<adventure>/<saga>/<topic>/<game-slug>"` — prefix-filterable by --slots. */
  slotId: string;
  topicPath: string;
  /**
   * Resolved `games.position`. The catalog leaves it optional; `games.position` is
   * NOT NULL with `UNIQUE (topic_id, position)`, so resolving the default from
   * declaration order is the caller's job (publish.ts's `PublishGameBlueprint`
   * explicitly refuses to guess).
   */
  position: number;
  blueprint: GameBlueprint;
}

/**
 * Enumeration order IS declaration order — reproducible slot ids across runs.
 * Positions are resolved per topic: explicit values are reserved first, then every
 * blueprint without one takes the next free integer, so an author may pin some and
 * leave the rest implicit without ever producing a duplicate.
 */
export function enumerateSlots(catalog: GamesFile): GameSlot[] {
  const byTopic = new Map<string, GameBlueprint[]>();
  for (const blueprint of catalog.games) {
    const list = byTopic.get(blueprint.topic_path) ?? [];
    list.push(blueprint);
    byTopic.set(blueprint.topic_path, list);
  }

  const positions = new Map<GameBlueprint, number>();
  for (const list of byTopic.values()) {
    const taken = new Set<number>();
    for (const blueprint of list) {
      if (blueprint.position !== undefined) taken.add(blueprint.position);
    }
    let next = 1;
    for (const blueprint of list) {
      if (blueprint.position !== undefined) {
        positions.set(blueprint, blueprint.position);
        continue;
      }
      while (taken.has(next)) next += 1;
      taken.add(next);
      positions.set(blueprint, next);
    }
  }

  return catalog.games.map((blueprint) => ({
    slotId: `${blueprint.topic_path}/${blueprint.slug}`,
    topicPath: blueprint.topic_path,
    position: positions.get(blueprint) ?? 1,
    blueprint,
  }));
}

/** `--slots` — exact slot id, or a prefix that selects a whole topic/saga/adventure. */
export function filterSlots(slots: GameSlot[], patterns?: string[]): GameSlot[] {
  if (!patterns || patterns.length === 0) return slots;
  return slots.filter((slot) => patterns.some((p) => slot.slotId === p || slot.slotId.startsWith(`${p}/`)));
}

/** `--mechanic` — regenerate exactly one mechanic's games (e.g. after a simulator fix). */
export function filterMechanics(slots: GameSlot[], mechanics?: string[]): GameSlot[] {
  if (!mechanics || mechanics.length === 0) return slots;
  const wanted = new Set(mechanics);
  return slots.filter((slot) => wanted.has(slot.blueprint.mechanic));
}

// ---- Options ----------------------------------------------------------------------

/**
 * Concept context for one bound topic, when the caller can resolve it.
 *
 * WIRING GAP (reported, not silently papered over): `catalog/loader.ts` currently
 * indexes Forge's catalog by topic PATH only (its `TopicRef` carries `ageTier` and
 * nothing else), so the run has no access to the bound topic's `concept`,
 * `learning_objective`, `key_vocabulary` or `prior_knowledge`. This seam lets a
 * caller supply them today and lets the loader supply them tomorrow without
 * touching any stage. When absent, the blueprint's own `micro_objective` is the
 * only concept context a prompt carries — which is correct but thinner than Forge's.
 *
 * §1.9: everything here is CURRICULUM text. Never a child, a name, a profile field,
 * or anything derived from a user row. There is no per-child generation path.
 */
export interface TopicConceptContext {
  concept?: string;
  learningObjective?: string;
  keyVocabulary?: string[];
  /** What the bound LESSON already taught — a game reinforces, it never teaches cold. */
  priorKnowledge?: string;
  narrativeArc?: string;
  /** Human title of the bound topic; powers the anti-genericity gate's echo check. */
  title?: string;
}

export interface RunOptions {
  course: string;
  slots?: string[];
  /** Closed-set mechanic ids to restrict the run to. */
  mechanics?: string[];
  locales?: GameLocale[];
  noImages?: boolean;
  dryRun?: boolean;
  runId?: string;
  /** `gamegen/curriculum` — where `<course>/games.yaml` lives. */
  curriculumRoot: string;
  /** `gamegen/runs` — where `<run-id>/{checkpoint,ledger,rubrics}` land. */
  runsRoot: string;
  /** Overrides Forge's curriculum tree (cross-catalog + forbidden vocabulary). Tests only. */
  coursegenCurriculumRoot?: string;
  /** Course title for the prompts; defaults to the catalog's course slug. */
  courseTitle?: string;
  /** Per-topic-path concept context — see `TopicConceptContext`. */
  topicContext?: Record<string, TopicConceptContext>;
  /**
   * Hard USD ceiling override (`--budget-usd`). It only ever LOWERS the scaled
   * budget, never raises it: an operator flag must be able to tighten a cap and
   * must never be able to buy headroom the config did not grant.
   */
  maxUsdOverride?: number;
}

export interface RunDeps {
  ledger?: UsageLedger;
}

// ---- Concurrency ------------------------------------------------------------------

async function promisePool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>): Promise<void> {
  let index = 0;
  const size = Math.max(1, Math.min(concurrency, items.length || 1));
  async function next(): Promise<void> {
    for (;;) {
      const i = index++;
      if (i >= items.length) return;
      await worker(items[i]!);
    }
  }
  await Promise.all(Array.from({ length: size }, () => next()));
}

// ---- Per-slot outcome -------------------------------------------------------------

export interface ProcessSlotOutcome {
  slotId: string;
  /** 'already-published' = done by an EARLIER invocation (isSlotDone) — routed to the
   *  summary's alreadyDone bucket, never to `published`, so a resume pass reports only
   *  NEW work as progress. */
  state: 'published' | 'already-published' | 'failed' | 'skipped' | 'dry-run';
  /** Prism illustrations placed on this slot (inherited + cached + fresh). */
  imagesGenerated?: number;
  /** Of those, how many were FRESH — i.e. actually paid for. */
  imagesBilled?: number;
  /** Sprite slots filled from art this run already drew — the money NOT spent. */
  imagesInherited?: number;
  /** Why illustration was skipped, when it was (e.g. 'not-configured'). */
  imageSkipReasons?: GameImageSkipReason[];
  /** True when the author stage SALVAGED a partial manifest (items were dropped). */
  salvaged?: boolean;
  droppedItems?: number;
  error?: string;
  /** The stage state the slot held when it failed (checkpoint `failedFrom`) — the per-stage failure heatmap datum. */
  failedFrom?: SlotState;
  /**
   * A `kid_safety` escalation. TERMINAL for the slot: the outer retry must NOT
   * re-draw it. A safety verdict is routed to a human, never patched by the model
   * that wrote it (judge.ts), and re-rolling it would spend money to launder a
   * child-safety finding into a different random draw.
   */
  escalated?: boolean;
  /** Wall-clock this invocation spent on the slot, all outer attempts included (telemetry-only). */
  durationMs?: number;
}

/** The stage-defined payload carried in `SlotCheckpoint.data`. Read back with casts,
 *  exactly as Forge does — the checkpoint file is JSON, so its shape is a contract
 *  between this module's stages and nothing else. */
interface SlotData {
  skeleton?: PlanSkeleton;
  documents?: Partial<Record<GameLocale, GameDocument>>;
  validation?: GameValidation;
  rubric?: GameRubric;
  publishResult?: PublishGameResult;
  salvaged?: boolean;
  droppedItems?: number;
}

function slotData(checkpoint: RunCheckpoint, slotId: string): SlotData {
  return (getSlot(checkpoint, slotId).data ?? {}) as SlotData;
}

// ---- One slot ---------------------------------------------------------------------

interface SlotContext {
  courseSlug: string;
  courseTitle: string;
  concept: TopicConceptContext;
  gateCtx: GameGateContext;
  /** Course-scoped art index, SHARED across the run's slots and updated in place by
   *  `illustrateGame` — one distinct object is paid for exactly once per run. */
  inherit: GameImageInheritance;
}

async function processSlot(
  slot: GameSlot,
  ctx: SlotContext,
  checkpoint: RunCheckpoint,
  store: CheckpointStore,
  options: RunOptions,
  ledger: UsageLedger,
  rubricLog?: GameRubricLog,
): Promise<ProcessSlotOutcome> {
  if (isSlotDone(checkpoint, slot.slotId)) return { slotId: slot.slotId, state: 'already-published' };

  /*
   * --dry-run stops HERE, before every paid stage (plan, author, judge, localize,
   * illustrate). Forge's dry run once only skipped the final publish: it ran and
   * BILLED the whole generation while the summary claimed nothing was paid for.
   *
   * A dry run must also never DESTROY work: setSlotState replaces `data` wholesale,
   * so marking an in-progress slot (planned…illustrated, or a resumable 'failed')
   * would wipe its skeleton / judge-approved manifest and a later real run would
   * silently re-pay them. Only a PRISTINE pending slot gets the marker; anything
   * carrying state or data is counted as validated WITHOUT touching the checkpoint.
   */
  if (options.dryRun) {
    const current = getSlot(checkpoint, slot.slotId);
    if (current.state === 'pending' && !current.data) {
      checkpoint = setSlotState(checkpoint, slot.slotId, 'dry-run', { data: { dryRun: true } });
      await store.save(checkpoint);
    }
    return { slotId: slot.slotId, state: 'dry-run' };
  }

  // Outcome telemetry that must survive to the summary — money spent BEFORE a
  // failure is exactly the money an operator most needs to see, so these are
  // reported on the failure path too.
  let imagesGenerated = 0;
  let imagesBilled = 0;
  let imagesInherited = 0;
  const imageSkipReasons = new Set<GameImageSkipReason>();
  let salvaged = false;
  let droppedItems = 0;

  const locales = options.locales ?? DEFAULT_LOCALES;
  const blueprint = slot.blueprint;

  /** The target-locale vocabulary re-gate `localize` needs: forbidden-vocabulary lists
   *  are PER LOCALE, so a manifest that passed the es-MX gate can land on a forbidden
   *  en-US or pt-BR word purely through translation. The gate has to run on the OUTPUT. */
  const regate = (document: GameDocument, locale: GameTargetLocale): LocalizeGameProblem[] => {
    const vocabulary = loadForbiddenVocabulary({
      course: ctx.gateCtx.course,
      tier: document.meta.tier,
      locale,
      ...(options.coursegenCurriculumRoot === undefined
        ? {}
        : { coursegenCurriculumRoot: options.coursegenCurriculumRoot }),
    });
    return runVocabularyGate(document, vocabulary).map((problem) => ({ message: problem.message }));
  };

  /**
   * The free stages, cheap-first, wired as ONE function so they can be injected in
   * two places:
   *   - into `author`'s corrective-retry loop, where a gate/bot failure becomes
   *     actionable feedback for the next attempt (this is why `gate` owns no
   *     checkpoint state of its own — GAME_ENGINE.md §9);
   *   - into `judge`'s revalidate hook, because a revise cycle is exactly the edit
   *     that makes a target unreachable, and re-judging an unwinnable manifest
   *     spends a PAID call to learn something a free gate already knew.
   * The standalone `simulate` stage below remains the authority: author's salvage
   * and last-resort paths bypass the loop by design.
   */
  const freeGates = (document: GameDocument, validation: GameValidation): AuthorGateReport => {
    const report = runAllGates(document, validation, ctx.gateCtx);
    if (!report.ok || report.document === undefined || report.validation === undefined) {
      return { ok: false, problems: report.problems };
    }
    const verdict = simulateGate(report.document, report.validation, { mechanic: blueprint.mechanic });
    if (!verdict.ok) {
      return { ok: false, problems: verdict.feedback.map((message) => ({ gate: 'simulate', message })) };
    }
    return { ok: true, problems: [] };
  };

  try {
    ledger.checkBudget();

    // ---- plan (PAID: DeepSeek, unless the blueprint pins a skeleton) ----
    let current = getSlot(checkpoint, slot.slotId);
    let data = slotData(checkpoint, slot.slotId);
    let skeleton = data.skeleton;
    if (!skeleton || current.state === 'pending' || current.state === 'failed') {
      const planCtx: PlanContext = {
        courseTitle: ctx.courseTitle,
        topic: {
          concept: ctx.concept.concept ?? blueprint.micro_objective,
          learningObjective: ctx.concept.learningObjective ?? blueprint.micro_objective,
          keyVocabulary: ctx.concept.keyVocabulary ?? [],
        },
        ...(ctx.concept.narrativeArc === undefined ? {} : { adventureNarrativeArc: ctx.concept.narrativeArc }),
        ...(ctx.concept.priorKnowledge === undefined ? {} : { priorKnowledge: ctx.concept.priorKnowledge }),
      };
      const planResult = await planGame(blueprint, planCtx, { ledger });
      skeleton = planResult.skeleton;
      if (planResult.fixes.length > 0) {
        // A stage that repairs the SAME rule on every slot is a prompt bug, not a
        // model quirk — which is only visible if the repairs are printed.
        console.warn(
          `[arcade] slot ${slot.slotId}: plan repaired ${planResult.fixes.length} field(s) — ${planResult.fixes.slice(0, 3).join('; ')}`,
        );
      }
      checkpoint = setSlotState(checkpoint, slot.slotId, 'planned', { data: { skeleton } });
      await store.save(checkpoint);
    }

    // ---- author (PAID: DeepSeek) + gate (free, INSIDE the retry loop) ----
    current = getSlot(checkpoint, slot.slotId);
    data = slotData(checkpoint, slot.slotId);
    let documents: Partial<Record<GameLocale, GameDocument>> = data.documents ?? {};
    let validation = data.validation;
    if (!documents[AUTHORING_LOCALE] || validation === undefined) {
      const authorCtx: AuthorContext = {
        mechanic: blueprint.mechanic,
        slug: blueprint.slug,
        topicPath: blueprint.topic_path,
        tier: blueprint.tier,
        difficulty: blueprint.difficulty,
        microObjective: blueprint.micro_objective,
        skinBrief: blueprint.skin_brief,
        courseTitle: ctx.courseTitle,
        topic: {
          ...(ctx.concept.concept === undefined ? {} : { concept: ctx.concept.concept }),
          ...(ctx.concept.learningObjective === undefined
            ? {}
            : { learningObjective: ctx.concept.learningObjective }),
          ...(ctx.concept.keyVocabulary === undefined ? {} : { keyVocabulary: ctx.concept.keyVocabulary }),
          ...(ctx.concept.priorKnowledge === undefined ? {} : { priorKnowledge: ctx.concept.priorKnowledge }),
        },
      };
      const authored = await authorGameDocument({ ctx: authorCtx, skeleton }, { ledger, gate: freeGates });
      salvaged = salvaged || authored.salvaged;
      droppedItems += authored.droppedItems;
      if (authored.salvaged) {
        // Forge shipped lessons that had silently lost half their planned segments
        // because this flag was returned and never read.
        console.warn(
          `[arcade] slot ${slot.slotId}: author SALVAGED — ${authored.droppedItems} item(s) dropped. ` +
            `The game is smaller than its skeleton asked for.`,
        );
      }
      /*
       * The standalone gate run is the FINAL authority. `authored.gatePassed === false`
       * also means "not run" (the salvage and last-resort paths bypass the loop by
       * design), so trusting that flag would let an ungated manifest through.
       */
      const gateReport = runAllGates(authored.document, authored.validation, ctx.gateCtx);
      if (!gateReport.ok || gateReport.document === undefined || gateReport.validation === undefined) {
        throw new Error(
          `gate failure on the es-MX manifest: ${gateReport.problems.slice(0, 5).map((p) => p.message).join('; ')}`,
        );
      }
      documents = { ...documents, [AUTHORING_LOCALE]: gateReport.document };
      validation = gateReport.validation;
      checkpoint = setSlotState(checkpoint, slot.slotId, 'authored', {
        data: { skeleton, documents, validation, salvaged: authored.salvaged, droppedItems: authored.droppedItems },
      });
      await store.save(checkpoint);
    }

    /*
     * Carry the salvage bookkeeping across a RESUME. The author stage may have run
     * in an EARLIER invocation, so these facts live in the checkpoint, not in this
     * invocation's locals — without this, resuming a salvaged slot from 'judged'
     * would report it as a clean, full-size game. `droppedItems` is written exactly
     * once (by author), so max() is both correct and idempotent.
     */
    const persisted = slotData(checkpoint, slot.slotId);
    salvaged = salvaged || persisted.salvaged === true;
    droppedItems = Math.max(droppedItems, persisted.droppedItems ?? 0);

    // ---- simulate (FREE: the bot-play winnability gate) ----
    // Deterministic, costs nothing, and runs BEFORE the paid judge. The perfect bot
    // MUST reach pass_score (otherwise a child fails content that is broken, not
    // hard) and the random bot MUST NOT (otherwise mashing is a complete strategy
    // and the XP is free).
    current = getSlot(checkpoint, slot.slotId);
    if (current.state === 'authored') {
      const source = documents[AUTHORING_LOCALE]!;
      const verdict = simulateGate(source, validation ?? null, { mechanic: blueprint.mechanic });
      if (!verdict.ok) {
        // The bot TRACE, not a summary of it — this text is what the next author
        // attempt receives as corrective feedback after the outer retry resets.
        throw new Error(`simulate gate failed: ${verdict.feedback.slice(0, 6).join(' | ')}`);
      }
      checkpoint = setSlotState(checkpoint, slot.slotId, 'simulated', {
        data: { skeleton, documents, validation, salvaged, droppedItems },
      });
      await store.save(checkpoint);
    }

    // ---- judge (PAID: Qwen, the decorrelated provider, es-MX only) ----
    current = getSlot(checkpoint, slot.slotId);
    if (current.state === 'simulated') {
      const judged = await judgeGame(documents[AUTHORING_LOCALE]!, {
        ledger,
        slotId: slot.slotId,
        // §1.9: curriculum concept context only — age tier and generic concept text.
        conceptSummary: ctx.concept.concept ?? blueprint.micro_objective,
        ...(rubricLog === undefined ? {} : { rubricLog }),
        revalidate: (raw) => {
          const report = runAllGates(raw, validation, ctx.gateCtx);
          if (!report.ok || report.document === undefined || report.validation === undefined) {
            return { ok: false, issues: report.problems.map((p) => p.message) };
          }
          const verdict = simulateGate(report.document, report.validation, { mechanic: blueprint.mechanic });
          if (!verdict.ok) return { ok: false, issues: [...verdict.feedback] };
          return { ok: true, document: report.document };
        },
      });
      documents = { ...documents, [AUTHORING_LOCALE]: judged.document };
      checkpoint = setSlotState(checkpoint, slot.slotId, 'judged', {
        data: { skeleton, documents, validation, rubric: judged.rubric, salvaged, droppedItems },
      });
      await store.save(checkpoint);
    }

    // ---- illustrate-then-localize (PAID: Prism, then DeepSeek) ----
    current = getSlot(checkpoint, slot.slotId);
    if (current.state === 'judged') {
      /*
       * Illustrate the AUTHORING document BEFORE localizing. `sprites`,
       * `background_url`, `palette`, `sfx` and `bgm` are CONTAINER keys the
       * string-freeze skips, so they copy verbatim into en-US and pt-BR — the art
       * carries no text by design (Prism's identity brief), so ONE generated image
       * serves all three locales. 3x fewer image calls per game, on the dominant
       * cost of mass generation.
       */
      const illustrated = await illustrateGame(documents[AUTHORING_LOCALE]!, {
        skip: options.noImages === true,
        skinBrief: blueprint.skin_brief,
        inherit: ctx.inherit,
        ledger,
      });
      documents = { ...documents, [AUTHORING_LOCALE]: illustrated.document };
      /*
       * Image outcomes must LEAVE this function. Forge destructured them away, so an
       * unconfigured or down Prism published a visual-first curriculum with zero
       * illustrations while the run reported complete success — and nothing
       * downstream re-checks, because the judge runs BEFORE illustration.
       */
      imagesGenerated += illustrated.generated;
      imagesBilled += illustrated.billed;
      imagesInherited += illustrated.inherited;
      if (illustrated.skippedReason) imageSkipReasons.add(illustrated.skippedReason);

      for (const locale of locales) {
        if (locale === AUTHORING_LOCALE || documents[locale]) continue;
        const localized = await localizeGame(documents[AUTHORING_LOCALE]!, locale, { ledger, regate });
        documents = { ...documents, [locale]: localized.document };
      }
      checkpoint = setSlotState(checkpoint, slot.slotId, 'localized', {
        data: { skeleton, documents, validation, salvaged, droppedItems },
      });
      await store.save(checkpoint);
    }

    // ---- illustrate sweep (belt-and-braces; ZERO Prism calls on the happy path) ----
    current = getSlot(checkpoint, slot.slotId);
    if (current.state === 'localized') {
      // Anything still missing a sprite URL — a locale document restored from an
      // older checkpoint, a per-locale regeneration — is filled here. On a RESUME
      // this stage may run without the pre-localize pass having run at all, which is
      // exactly why it is its own state and not an extension of the block above.
      for (const locale of Object.keys(documents) as GameLocale[]) {
        const document = documents[locale];
        if (document === undefined) continue;
        const swept = await illustrateGame(document, {
          skip: options.noImages === true,
          skinBrief: blueprint.skin_brief,
          inherit: ctx.inherit,
          ledger,
        });
        documents = { ...documents, [locale]: swept.document };
        imagesGenerated += swept.generated;
        imagesBilled += swept.billed;
        imagesInherited += swept.inherited;
        if (swept.skippedReason) imageSkipReasons.add(swept.skippedReason);
      }
      checkpoint = setSlotState(checkpoint, slot.slotId, 'illustrated', {
        data: { skeleton, documents, validation, salvaged, droppedItems },
      });
      await store.save(checkpoint);
    }

    // ---- publish (FREE, idempotent, status='review' — NEVER auto-published) ----
    current = getSlot(checkpoint, slot.slotId);
    if (current.state === 'illustrated') {
      if (validation === undefined) {
        throw new Error(
          'publish: the slot has no server-only GameValidation sidecar in its checkpoint — ' +
            'refusing to publish a game Core could never bound-check a submitted run against',
        );
      }
      if (!isMechanicId(blueprint.mechanic)) {
        // Unreachable through the catalog (its schema pins the closed set) — but
        // publish writes a CHECK-constrained column, so the narrowing is real work,
        // not ceremony.
        throw new Error(`publish: blueprint mechanic "${blueprint.mechanic}" is outside the closed mechanic set`);
      }
      const mechanic: MechanicId = blueprint.mechanic;
      const publishResult = await publishGameSlot({
        courseSlug: ctx.courseSlug,
        blueprint: {
          slug: blueprint.slug,
          topicPath: blueprint.topic_path,
          mechanic,
          tier: blueprint.tier,
          position: slot.position,
        },
        documents,
        validation,
      });
      checkpoint = setSlotState(checkpoint, slot.slotId, 'published', { data: { publishResult } });
      await store.save(checkpoint);
    }

    /*
     * NEVER claim success without proof. Forge's equivalent return used to be
     * unconditional at the end of the try block, so a slot whose state fell outside
     * the expected lifecycle — a hand-edited or partially-written checkpoint, or any
     * state added later — skipped every stage guard above and was reported published
     * with NOTHING in Vault. Assert the state machine actually arrived.
     */
    const finalState = getSlot(checkpoint, slot.slotId).state;
    if (finalState !== 'published') {
      const message =
        `slot finished the pipeline in state "${finalState}" instead of "published" — no stage claimed it, ` +
        `so nothing was written to Vault. This usually means the checkpoint holds an unexpected state.`;
      checkpoint = setSlotState(checkpoint, slot.slotId, 'failed', { error: message, failedFrom: finalState });
      await saveQuietly(store, checkpoint, slot.slotId);
      return {
        slotId: slot.slotId,
        state: 'failed',
        error: message,
        failedFrom: finalState,
        imagesGenerated,
        imagesBilled,
        imagesInherited,
        imageSkipReasons: [...imageSkipReasons],
        salvaged,
        droppedItems,
      };
    }

    return {
      slotId: slot.slotId,
      state: 'published',
      imagesGenerated,
      imagesBilled,
      imagesInherited,
      imageSkipReasons: [...imageSkipReasons],
      salvaged,
      droppedItems,
    };
  } catch (err) {
    // Stop the whole run, don't mark this slot failed: the kill switch only exists
    // if the error ESCAPES (gamegen/AGENTS.md).
    if (err instanceof BudgetExceededError) throw err;
    /*
     * A dead credential or an empty balance is not a slot-level problem, and every
     * further call is guaranteed to fail while still costing an HTTP round trip and
     * discarding whatever paid work already succeeded. A real Forge run hit DeepSeek
     * "Insufficient Balance" and then burned 2.17M tokens / ~$10 failing all 62 slots
     * three times each before exiting. Abort the way a budget stop does, so the
     * operator sees ONE clear cause instead of N derived symptoms.
     */
    if (isFatalProviderError(err)) throw err;

    const message = err instanceof Error ? err.message : String(err);
    const escalated = err instanceof GameJudgeEscalationError;
    /*
     * Record WHERE the failure happened (the last stage state the slot reached) so
     * the outer retry can choose between "regenerate from scratch" (the
     * measured-better path for plan/author/judge failures) and "resume from the
     * checkpoint" (a localize/illustrate/publish failure whose judge-approved input
     * is sitting right there in `data`). getSlot returns the last PERSISTED state —
     * stages only persist on success, so this is exactly the last stage that
     * completed before the throw.
     */
    const stateAtFailure = getSlot(checkpoint, slot.slotId).state;
    /*
     * The failure bookkeeping must not itself be able to kill the run. `store.save`
     * does disk I/O (ENOSPC, EACCES, a transient FS error on a multi-hour run), and
     * an exception thrown HERE would escape this catch, propagate through the pool
     * and abort every remaining slot — turning one game's failure into a dead run.
     */
    checkpoint = setSlotState(checkpoint, slot.slotId, 'failed', {
      error: message,
      failedFrom: stateAtFailure === 'failed' ? getSlot(checkpoint, slot.slotId).failedFrom : stateAtFailure,
    });
    await saveQuietly(store, checkpoint, slot.slotId);

    return {
      slotId: slot.slotId,
      state: 'failed',
      error: message,
      failedFrom: getSlot(checkpoint, slot.slotId).failedFrom,
      escalated,
      imagesGenerated,
      imagesBilled,
      imagesInherited,
      imageSkipReasons: [...imageSkipReasons],
      salvaged,
      droppedItems,
    };
  }
}

// ---- Stage-aware retry ------------------------------------------------------------

/**
 * Stages whose failures do NOT discard judge-approved work. A slot that failed from
 * one of these holds a judged es-MX manifest (and possibly its translations and
 * sprite URLs) in `data` — re-running it resumes at the failed stage instead of
 * re-paying plan + author + revise cycles + judge to redo work whose input was fine.
 *
 * Failures from pending/planned/authored/simulated keep the measured from-scratch
 * behaviour: a fresh draw converges far better than revising a bad draft (the
 * ARCADE_SLOT_ATTEMPTS rationale in env.ts).
 */
const RESUMABLE_FAILED_FROM: ReadonlySet<SlotState> = new Set(['judged', 'localized', 'illustrated']);

export type RetryPreparation = 'resumed' | 'reset' | 'untouched';

/**
 * Normalizes a 'failed' slot before a (re-)attempt. Stage-aware:
 *
 * - failedFrom ∈ {judged, localized, illustrated} with data present → restore that
 *   state so processSlot's stage guards skip everything already done and the attempt
 *   resumes exactly at the failed stage.
 * - anything else (plan/author/simulate/judge failures, missing data, or
 *   `forceFresh`) → full reset to pending with data wiped: regenerate from scratch.
 *
 * `forceFresh` is the escalation valve: the LAST outer attempt always resets fully,
 * so a DETERMINISTIC late-stage failure (e.g. a translation that trips the target
 * locale's vocabulary gate every single time) still gets one fresh draw — the only
 * path that changes that stage's input — instead of retrying into the same wall.
 */
export function prepareSlotForAttempt(
  checkpoint: RunCheckpoint,
  slotId: string,
  opts: { forceFresh: boolean },
): RetryPreparation {
  const slot = getSlot(checkpoint, slotId);
  if (slot.state !== 'failed') return 'untouched';
  if (!opts.forceFresh && slot.failedFrom && RESUMABLE_FAILED_FROM.has(slot.failedFrom) && slot.data) {
    // setSlotState keeps `data` (spread) and clears error/failedFrom on a non-failed
    // transition — the slot looks exactly like it did after the failed stage's
    // predecessor succeeded.
    setSlotState(checkpoint, slotId, slot.failedFrom, {});
    return 'resumed';
  }
  setSlotState(checkpoint, slotId, 'pending', { data: undefined });
  return 'reset';
}

/** Persists the checkpoint, downgrading a write failure to a warning (see the catch above). */
async function saveQuietly(store: CheckpointStore, checkpoint: RunCheckpoint, slotId: string): Promise<void> {
  try {
    await store.save(checkpoint);
  } catch (saveErr) {
    console.error(
      `[arcade] WARNING: could not persist the checkpoint after slot ${slotId} failed ` +
        `(${saveErr instanceof Error ? saveErr.message : String(saveErr)}). The run continues, but this slot ` +
        `will be retried on resume.`,
    );
  }
}

// ---- Summary ----------------------------------------------------------------------

/**
 * Every enumerated slot lands in EXACTLY ONE bucket. Forge's summary once carried
 * only `published` and `failed`, so slots that were never attempted — a budget stop,
 * or work already finished by an earlier invocation — vanished from the report and a
 * run that touched 300 of 1000 slots printed a clean partial success.
 */
export interface RunSummary {
  runId: string;
  /** Written to Vault with `status='review'` — a human still has to approve them. */
  published: string[];
  /** `failedFrom` = the stage the slot failed from; the per-stage failure heatmap datum. */
  failed: { slotId: string; error: string; failedFrom?: SlotState }[];
  /** Slots the judge escalated on `kid_safety`. NOT retried — routed to a human. */
  escalated: string[];
  /** Validated by --dry-run; nothing was written and nothing was paid for. */
  dryRun: string[];
  /** Deliberately not processed (e.g. the catalog failed to load). */
  skipped: { slotId: string; reason: string }[];
  /** Already 'published' in the checkpoint before this invocation started. */
  alreadyDone: string[];
  /** Enumerated but never reached — the honest name for what used to be invisible. */
  notAttempted: string[];
  slotsEnumerated: number;
  /** Set when a dead credential / empty balance aborted the run (401/402/403). */
  fatalProviderError: string | null;
  /** Prism illustrations placed — zero on a sprite-driven arcade is a RED FLAG, not a success. */
  imagesGenerated: number;
  /** Of those, FRESH generations — the ones that cost money (cache hits are free). */
  imagesBilled: number;
  /** Sprite slots filled from art this run already drew — the money NOT spent. */
  imagesInherited: number;
  /** Distinct reasons illustration was skipped (e.g. 'not-configured'). */
  imageSkipReasons: GameImageSkipReason[];
  /** Games published SMALLER than their skeleton because author had to salvage. */
  salvagedSlots: { slotId: string; droppedItems: number }[];
  stoppedOnBudget: boolean;
  tokensUsed: number;
  usdUsed: number;
  /** Prompt tokens served by provider context caches (subset of tokensUsed) — the prefix-stability scoreboard. */
  cachedTokens: number;
  /** The effective caps this run was held to, after work-scaling and --budget-usd. */
  budget: { maxTokens: number; maxUsd: number };
}

// ---- The run ----------------------------------------------------------------------

export async function runGeneration(options: RunOptions, deps: RunDeps = {}): Promise<RunSummary> {
  /*
   * A dry run makes zero provider calls by construction (processSlot stops before
   * every paid stage), so it must not demand keys either — validating a catalog and
   * an enumeration is exactly what an operator does on a machine without
   * credentials, and a keyless dry-run test is the regression pin (GAME_ENGINE.md §9).
   */
  if (!options.dryRun) {
    requireGenerationKeys();
    requirePublishKeys();
    // Missing Prism config is a REFUSAL, not a skip: an art-less game manifest is a
    // different (worse) product, not the same one minus a nicety. Checked UP FRONT so
    // the refusal costs nothing — discovering it after the judge has been paid does not.
    if (options.noImages !== true) requireIllustrationKeys();
  }

  const config = getConfig();
  const courseDir = path.join(options.curriculumRoot, options.course);
  const loadResult = loadGameCatalog(courseDir, {
    ...(options.coursegenCurriculumRoot === undefined
      ? {}
      : { coursegenCurriculumRoot: options.coursegenCurriculumRoot }),
  });
  const errors = loadResult.issues.filter((i) => i.level === 'error');
  if (errors.length > 0) {
    // The `validate` stage. Free, and it runs before a single paid call — including
    // the cross-catalog check that every `topic_path` resolves to a real Forge topic.
    // Orphan games do not exist.
    throw new Error(
      `generate: game catalog failed to validate — ${errors.map((e) => `${e.file}: ${e.message}`).join('; ')}`,
    );
  }
  for (const warning of loadResult.issues.filter((i) => i.level === 'warning')) {
    console.warn(`[arcade] catalog warning — ${warning.message}`);
  }
  const catalog = loadResult.catalog;
  if (!catalog) {
    throw new Error(`generate: game catalog at ${loadResult.file} produced no parsed content`);
  }

  const runId = namespaceRunId(
    options.runId ?? `${options.course}-${new Date().toISOString().replace(/[:.]/g, '-')}`,
  );
  const runDir = path.join(options.runsRoot, runId);
  const store = new CheckpointStore(path.join(runDir, 'checkpoint.json'));

  /*
   * A resume must be provably COMPATIBLE with what produced the existing slots.
   * `isSlotDone` only reads the state string, so without this check a resume with
   * different flags silently treats incompatible work as finished and reports success
   * — the worst failure mode found in Forge's mass-generation audit, because a whole
   * course REQUIRES multiple invocations and every variation is reachable in normal use.
   */
  const runParams: RunParams = {
    kind: 'games',
    course: options.course,
    locales: [...(options.locales ?? GAME_LOCALES)],
    noImages: options.noImages === true,
  };
  const loaded = await store.load();
  if (loaded) {
    const mismatch = describeParamMismatch(loaded.params, runParams);
    const doneCount = Object.values(loaded.slots).filter((sl) => sl.state === 'published').length;
    if (mismatch && doneCount > 0) {
      throw new Error(
        `refusing to resume run "${runId}": it was created with different parameters (${mismatch}), ` +
          `and ${doneCount} slot(s) are already marked published. Those slots were produced under the OLD ` +
          `parameters and would be silently skipped, so the run would report success without doing the work. ` +
          `Use a fresh --run-id for the new parameters, or re-run with the original ones.`,
      );
    }
    if (mismatch) loaded.params = runParams; // nothing published yet — safe to adopt
  }
  const checkpoint = loaded ?? newRunCheckpoint(runId, options.course, runParams);
  if (!checkpoint.params) checkpoint.params = runParams;

  const allSlots = enumerateSlots(catalog);
  const slots = filterMechanics(filterSlots(allSlots, options.slots), options.mechanics);

  /*
   * Budget scaled to the enumerated work, then hydrated from the run's own ledger.
   *
   * Two separate Forge mass-generation failures live here. (1) An absolute token cap
   * sized for a smoke test makes a large catalog arithmetically guaranteed to abort
   * partway through — the cap has to grow with the slot count or it is a bug, not a
   * guard. (2) The totals restarted at zero in every process, so the "per-run"
   * ceilings were per-INVOCATION and bounded nothing across the resumes a long run
   * requires. `hydrate()` replays ledger.jsonl to fix (2).
   */
  const ledger = deps.ledger ?? new UsageLedger(runDir);
  const scaled = {
    maxTokens: Math.max(config.ARCADE_MAX_TOKENS_PER_RUN, slots.length * config.ARCADE_MAX_TOKENS_PER_SLOT),
    maxUsd: Math.max(config.ARCADE_MAX_USD_PER_RUN, slots.length * config.ARCADE_MAX_USD_PER_SLOT),
  };
  // Only ever LOWERS the cap — an operator flag may tighten a ceiling, never buy headroom.
  if (options.maxUsdOverride !== undefined) scaled.maxUsd = Math.min(scaled.maxUsd, options.maxUsdOverride);
  await ledger.hydrate(scaled);
  console.log(
    `[arcade] run ${runId} — budget for ${slots.length} slot(s): ` +
      `${scaled.maxTokens.toLocaleString()} tokens, $${scaled.maxUsd.toFixed(2)} ` +
      `(concurrency ${config.ARCADE_CONCURRENCY}, ${config.ARCADE_SLOT_ATTEMPTS} attempt(s) per slot)`,
  );

  const rubricLog = new GameRubricLog(runDir);
  const courseTitle = options.courseTitle ?? catalog.course;
  const inherit: GameImageInheritance = new Map<string, string>();

  const published: string[] = [];
  const failed: { slotId: string; error: string; failedFrom?: SlotState }[] = [];
  const escalated: string[] = [];
  const dryRun: string[] = [];
  const skipped: { slotId: string; reason: string }[] = [];
  const alreadyDone: string[] = [];
  let imagesGenerated = 0;
  let imagesBilled = 0;
  let imagesInherited = 0;
  const imageSkipReasons = new Set<GameImageSkipReason>();
  const salvagedSlots: { slotId: string; droppedItems: number }[] = [];
  let stoppedOnBudget = false;
  let fatalProviderError: string | null = null;

  try {
    await promisePool(slots, config.ARCADE_CONCURRENCY, async (slot) => {
      if (stoppedOnBudget) return;

      const concept = options.topicContext?.[slot.topicPath] ?? {};
      const slotCtx: SlotContext = {
        courseSlug: catalog.course,
        courseTitle,
        concept,
        gateCtx: {
          course: catalog.course,
          ...(options.coursegenCurriculumRoot === undefined
            ? {}
            : { coursegenCurriculumRoot: options.coursegenCurriculumRoot }),
          topicTitle: concept.title ?? slot.blueprint.micro_objective,
        },
        inherit,
      };

      /*
       * A slot left 'failed' by a PREVIOUS invocation gets the same stage-aware
       * treatment as the in-run retries below: a late-stage failure resumes from its
       * judge-approved checkpoint data instead of silently re-planning from scratch
       * (which is what the plan-stage guard's `state === 'failed'` branch would
       * otherwise do). NEVER under --dry-run: no real attempt follows, and the
       * restore/reset would mutate (and partially wipe) forensics a real run needs.
       */
      if (!options.dryRun) {
        const firstPrep = prepareSlotForAttempt(checkpoint, slot.slotId, { forceFresh: false });
        if (firstPrep !== 'untouched') await store.save(checkpoint);
      }

      const slotStartedAt = Date.now();
      let outcome = await processSlot(slot, slotCtx, checkpoint, store, options, ledger, rubricLog);
      let attempt = 1;
      /*
       * Outer per-slot attempts (ARCADE_SLOT_ATTEMPTS), stage-aware — see
       * prepareSlotForAttempt. BudgetExceededError and fatal provider errors still
       * abort the whole run (processSlot rethrows them), so retries can never blow
       * past the kill switches. A kid_safety ESCALATION is terminal and skips the
       * loop entirely: re-rolling it would spend money to launder a child-safety
       * finding into a different random draw.
       */
      while (
        outcome.state === 'failed' &&
        outcome.escalated !== true &&
        attempt < config.ARCADE_SLOT_ATTEMPTS &&
        !stoppedOnBudget
      ) {
        attempt++;
        // setSlotState (inside prepareSlotForAttempt) mutates the shared checkpoint
        // object in place — the same object every worker holds. No reassignment.
        const prep = prepareSlotForAttempt(checkpoint, slot.slotId, {
          forceFresh: attempt === config.ARCADE_SLOT_ATTEMPTS,
        });
        console.warn(
          `[arcade] slot ${slot.slotId} failed (attempt ${attempt - 1}/${config.ARCADE_SLOT_ATTEMPTS}) — ` +
            `${prep === 'resumed' ? 'resuming from checkpoint stage' : 'regenerating from scratch'}: ` +
            `${outcome.error?.slice(0, 160)}`,
        );
        await store.save(checkpoint);
        outcome = await processSlot(slot, slotCtx, checkpoint, store, options, ledger, rubricLog);
      }
      outcome.durationMs = Date.now() - slotStartedAt;

      imagesGenerated += outcome.imagesGenerated ?? 0;
      imagesBilled += outcome.imagesBilled ?? 0;
      imagesInherited += outcome.imagesInherited ?? 0;
      for (const reason of outcome.imageSkipReasons ?? []) imageSkipReasons.add(reason);
      if (outcome.salvaged) salvagedSlots.push({ slotId: outcome.slotId, droppedItems: outcome.droppedItems ?? 0 });

      if (outcome.state === 'published') published.push(outcome.slotId);
      else if (outcome.state === 'already-published') alreadyDone.push(outcome.slotId);
      else if (outcome.state === 'failed') {
        failed.push({
          slotId: outcome.slotId,
          error: outcome.error ?? 'unknown error',
          ...(outcome.failedFrom === undefined ? {} : { failedFrom: outcome.failedFrom }),
        });
        if (outcome.escalated) escalated.push(outcome.slotId);
      } else if (outcome.state === 'dry-run') dryRun.push(outcome.slotId);
      else skipped.push({ slotId: outcome.slotId, reason: outcome.error ?? 'skipped' });

      const progress = published.length + failed.length + dryRun.length + skipped.length + alreadyDone.length;
      console.log(
        `[arcade] ${progress}/${slots.length} ${outcome.slotId} → ${outcome.state}` +
          (outcome.state === 'failed' ? ` (from ${outcome.failedFrom ?? 'pending'})` : '') +
          ` · ${((outcome.durationMs ?? 0) / 1000).toFixed(1)}s · $${ledger.usd.toFixed(4)} spent`,
      );
    });
  } catch (err) {
    if (err instanceof BudgetExceededError) stoppedOnBudget = true;
    else if (isFatalProviderError(err)) {
      // ONE clear cause, not N derived symptoms. Everything already published stays
      // published; everything else stays resumable from the checkpoint.
      fatalProviderError = err instanceof Error ? err.message : String(err);
    } else throw err;
  }

  /*
   * THE SUMMARY MUST ACCOUNT FOR EVERY SLOT. A slot that was never attempted —
   * because a budget stop made the pool return early, or because it was already
   * published by an earlier invocation — used to appear in NEITHER `published` NOR
   * `failed`, so a partial run printed a clean success and the operator had no way to
   * see the rest.
   */
  const accountedIds = new Set([
    ...published,
    ...alreadyDone,
    ...failed.map((f) => f.slotId),
    ...dryRun,
    ...skipped.map((s) => s.slotId),
  ]);
  const notAttempted: string[] = [];
  for (const slot of slots) {
    if (accountedIds.has(slot.slotId)) continue;
    // Leftovers exist only when the pool returned early (budget stop): a done slot the
    // pool never reached still counts as alreadyDone, not lost.
    (isSlotDone(checkpoint, slot.slotId) ? alreadyDone : notAttempted).push(slot.slotId);
  }

  const summary: RunSummary = {
    runId,
    published,
    failed,
    escalated,
    dryRun,
    skipped,
    alreadyDone,
    notAttempted,
    slotsEnumerated: slots.length,
    fatalProviderError,
    imagesGenerated,
    imagesBilled,
    imagesInherited,
    imageSkipReasons: [...imageSkipReasons],
    salvagedSlots,
    stoppedOnBudget,
    tokensUsed: ledger.tokens,
    usdUsed: ledger.usd,
    cachedTokens: ledger.cachedTokens,
    budget: scaled,
  };

  const tallied =
    published.length + failed.length + dryRun.length + skipped.length + alreadyDone.length + notAttempted.length;
  if (tallied !== slots.length) {
    // Never silently: an accounting hole here is exactly how content goes missing.
    console.warn(
      `[arcade] BUG: summary accounts for ${tallied} slot(s) but ${slots.length} were enumerated — please report this run id.`,
    );
  }

  return summary;
}
