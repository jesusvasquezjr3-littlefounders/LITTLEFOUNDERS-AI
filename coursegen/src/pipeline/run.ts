// Run orchestration — wires validate→plan→write→gate→review→localize→
// images→publish per slot, with checkpoint/resume, a small concurrency
// pool, and the budget kill switches (COURSE_ENGINE.md §4).

import path from 'node:path';
import { getConfig, requireGenerationKeys } from '../env.js';
import { loadCourseCatalog, resolveReviewSources, type CourseCatalog, type LoadedAdventure } from '../catalog/loader.js';
import type { AdventureFile, CatalogFile, TaxonomyFile } from '../catalog/schema.js';
import { UsageLedger, BudgetExceededError } from '../providers/usage.js';
import { CheckpointStore, newRunCheckpoint, getSlot, setSlotState, isSlotDone, type RunCheckpoint } from './checkpoint.js';
import { planLesson, buildForcedSkeleton, type PlanContext, type PlanSkeleton } from './plan.js';
import { writeLessonDocument } from './write.js';
import { runAllGates, type GateContext } from './gates.js';
import { reviewLesson } from './review.js';
import { localizeLesson, translateTitle } from './localize.js';
import { illustrateSegments } from './images.js';
import { publishLessonSlot, type PublishInput } from './publish.js';
import { resolveRegister, type Register } from './register.js';
import type { LessonDocumentParsed } from '../contract/schema.js';
import type { LessonLocale } from '../contract/core/types.js';

export interface Slot {
  slotId: string;
  tier: string;
  adventure: AdventureFile['adventure'];
  saga: AdventureFile['sagas'][number];
  topic: AdventureFile['sagas'][number]['topics'][number];
  lesson: AdventureFile['sagas'][number]['topics'][number]['lessons'][number];
  /**
   * Connect-to-prior (COURSE_ENGINE.md §3.1/§4): the previous slot's
   * micro_objective in the GLOBAL linear walk (enumeration order) — same
   * topic's previous lesson, or the last lesson of the previous topic when
   * this lesson is position 1. Undefined ONLY for the course's very first
   * lesson (exempt from the connect-to-prior requirement).
   */
  priorMicroObjective?: string;
}

export function enumerateSlots(adventures: LoadedAdventure[]): Slot[] {
  const slots: Slot[] = [];
  let previousMicroObjective: string | undefined;
  for (const { data } of adventures) {
    for (const saga of data.sagas) {
      for (const topic of saga.topics) {
        for (const lesson of topic.lessons) {
          slots.push({
            slotId: `${data.adventure.slug}/${saga.slug}/${topic.slug}/${lesson.slug}`,
            tier: data.adventure.age_tier,
            adventure: data.adventure,
            saga,
            topic,
            lesson,
            priorMicroObjective: previousMicroObjective,
          });
          previousMicroObjective = lesson.micro_objective;
        }
      }
    }
  }
  return slots;
}

export function filterSlots(slots: Slot[], patterns?: string[]): Slot[] {
  if (!patterns || patterns.length === 0) return slots;
  return slots.filter((slot) => patterns.some((p) => slot.slotId === p || slot.slotId.startsWith(`${p}/`)));
}

export interface RunOptions {
  course: string;
  slots?: string[];
  locales?: LessonLocale[];
  noImages?: boolean;
  dryRun?: boolean;
  runId?: string;
  curriculumRoot: string;
  runsRoot: string;
  /** COURSE_ENGINE.md §3.3 — defaults to 'kid'. */
  register?: Register;
}

export interface RunDeps {
  ledger?: UsageLedger;
}

const DEFAULT_LOCALES: LessonLocale[] = ['es-MX', 'en-US', 'pt-BR'];
const AUTHORING_LOCALE: LessonLocale = 'es-MX';

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

function courseTitleText(catalog: CatalogFile, locale: LessonLocale): string {
  return catalog.course.title[locale];
}

function buildPlanContext(
  slot: Slot,
  course: CourseCatalog,
  catalog: CatalogFile,
  taxonomy: TaxonomyFile,
  register: ReturnType<typeof resolveRegister>,
): PlanContext {
  const review =
    slot.topic.kind !== 'teaching' && slot.topic.review_of
      ? {
          kind: slot.topic.kind,
          sources: resolveReviewSources(course, slot.topic.review_of).map((s) => ({
            path: s.path,
            concept: s.concept,
            learningObjective: s.learningObjective,
            keyVocabulary: s.keyVocabulary,
          })),
        }
      : undefined;

  return {
    tier: slot.tier,
    taxonomy,
    courseTitle: courseTitleText(catalog, AUTHORING_LOCALE),
    adventureNarrativeArc: slot.adventure.narrative_arc,
    topic: {
      concept: slot.topic.concept,
      learningObjective: slot.topic.learning_objective,
      keyVocabulary: slot.topic.key_vocabulary,
      priorKnowledge: slot.topic.prior_knowledge,
      factRefs: slot.topic.fact_refs,
    },
    lesson: {
      microObjective: slot.lesson.micro_objective,
      narrativeBeat: slot.lesson.narrative_beat,
      difficulty: slot.lesson.difficulty,
      suggestedFamilies: slot.lesson.suggested_families,
    },
    review,
    prior: slot.priorMicroObjective,
    register: { fullPalette: register.fullPalette, toneDirectiveEs: register.toneDirectiveEs },
  };
}

interface ProcessSlotOutcome {
  slotId: string;
  state: 'published' | 'failed' | 'skipped';
  error?: string;
}

async function processSlot(
  slot: Slot,
  course: CourseCatalog,
  checkpoint: RunCheckpoint,
  store: CheckpointStore,
  options: RunOptions,
  ledger: UsageLedger,
  register: ReturnType<typeof resolveRegister>,
): Promise<ProcessSlotOutcome> {
  if (isSlotDone(checkpoint, slot.slotId)) return { slotId: slot.slotId, state: 'published' };
  if (!course.taxonomy || !course.facts || !course.catalog) {
    return { slotId: slot.slotId, state: 'skipped', error: 'course taxonomy/facts/catalog failed to load' };
  }
  const gateCtx: GateContext = {
    taxonomy: course.taxonomy,
    tier: slot.tier,
    facts: course.facts,
    topicTitle: slot.topic.title_es,
    skipVocabularyGate: !register.vocabularyGates,
  };
  const locales = options.locales ?? DEFAULT_LOCALES;

  try {
    ledger.checkBudget();

    // ---- plan ----
    let current = getSlot(checkpoint, slot.slotId);
    const planCtx = buildPlanContext(slot, course, course.catalog, course.taxonomy, register);
    let skeleton = current.data?.skeleton as PlanSkeleton | undefined;
    if (!skeleton || current.state === 'pending' || current.state === 'failed') {
      // QA/authoring override (COURSE_ENGINE.md §4 addendum): forced_types
      // skips the plan-stage LLM call entirely — deterministic, free, and
      // exact-coverage by construction.
      skeleton = slot.lesson.forced_types
        ? buildForcedSkeleton(slot.lesson.forced_types, slot.lesson.micro_objective)
        : (await planLesson(planCtx, { ledger })).skeleton;
      checkpoint = setSlotState(checkpoint, slot.slotId, 'planned', { data: { skeleton } });
      await store.save(checkpoint);
    }

    // ---- write (es-MX) ----
    current = getSlot(checkpoint, slot.slotId);
    let documents = (current.data?.documents as Partial<Record<LessonLocale, LessonDocumentParsed>>) ?? {};
    if (!documents[AUTHORING_LOCALE]) {
      const writeResult = await writeLessonDocument(
        {
          ctx: planCtx,
          skeleton: skeleton!,
          facts: course.facts,
          locale: AUTHORING_LOCALE,
          slug: slot.lesson.slug,
          subject: course.catalog.course.subject,
          // Gates run inside write's corrective loop (actionable feedback →
          // retry) — this outer re-run below stays as the final authority
          // because write's salvage/last-resort paths bypass the loop.
          gateCtx,
        },
        { ledger },
      );
      const gateReport = runAllGates(writeResult.document, gateCtx);
      if (!gateReport.ok || !gateReport.document) {
        throw new Error(`gate failure on es-MX write: ${gateReport.problems.slice(0, 5).map((p) => p.message).join('; ')}`);
      }
      documents = { ...documents, [AUTHORING_LOCALE]: gateReport.document };
      checkpoint = setSlotState(checkpoint, slot.slotId, 'written', { data: { skeleton, documents } });
      await store.save(checkpoint);
    }

    // ---- review (Qwen judge, es-MX only) ----
    current = getSlot(checkpoint, slot.slotId);
    if (current.state === 'written') {
      const reviewResult = await reviewLesson(documents[AUTHORING_LOCALE]!, gateCtx, {
        ledger,
        // COURSE_ENGINE.md §4 review: the judge's concreteness dimension asks
        // "does it connect to the prior lesson, unless it's the first?" —
        // without telling it WHICH lesson came before (or that none did), it
        // guessed, and guessed against us (top false-rejection cause on the
        // first real QA run).
        priorMicroObjective: slot.priorMicroObjective ?? null,
      });
      documents = { ...documents, [AUTHORING_LOCALE]: reviewResult.document };
      checkpoint = setSlotState(checkpoint, slot.slotId, 'reviewed', { data: { skeleton, documents, rubric: reviewResult.rubric } });
      await store.save(checkpoint);
    }

    // ---- localize ----
    current = getSlot(checkpoint, slot.slotId);
    if (current.state === 'reviewed') {
      for (const locale of locales) {
        if (locale === AUTHORING_LOCALE || documents[locale]) continue;
        const localized = await localizeLesson(documents[AUTHORING_LOCALE]!, locale as 'en-US' | 'pt-BR', gateCtx, {
          ledger,
          registerToneEs: register.toneDirectiveEs,
          skipVocabularyGate: !register.vocabularyGates,
        });
        documents = { ...documents, [locale]: localized.document };
      }
      checkpoint = setSlotState(checkpoint, slot.slotId, 'localized', { data: { skeleton, documents } });
      await store.save(checkpoint);
    }

    // ---- images (optional) ----
    current = getSlot(checkpoint, slot.slotId);
    if (current.state === 'localized') {
      for (const locale of Object.keys(documents) as LessonLocale[]) {
        const illustrated = await illustrateSegments(documents[locale]!, { skip: options.noImages }, { ledger });
        documents = { ...documents, [locale]: illustrated.document };
      }
      checkpoint = setSlotState(checkpoint, slot.slotId, 'illustrated', { data: { skeleton, documents } });
      await store.save(checkpoint);
    }

    // ---- publish ----
    current = getSlot(checkpoint, slot.slotId);
    if (current.state === 'illustrated') {
      if (options.dryRun) {
        checkpoint = setSlotState(checkpoint, slot.slotId, 'published', { data: { skeleton, documents, dryRun: true } });
        await store.save(checkpoint);
        return { slotId: slot.slotId, state: 'published' };
      }
      // COURSE_ENGINE.md §3.3 — adult register publishes as a PARALLEL course,
      // never overwriting the kid course: `<slug>-adultos`, title +" (Adultos)"
      // in all 3 locales. Content itself was already regenerated end-to-end
      // above (never filtered/dressed-up kid content — the documented
      // anti-pattern this whole module exists to avoid).
      const publishInput: PublishInput = {
        course: {
          slug: `${course.catalog.course.slug}${register.slugSuffix}`,
          subject: course.catalog.course.subject,
          title: {
            'en-US': `${course.catalog.course.title['en-US']}${register.titleSuffix}`,
            'es-MX': `${course.catalog.course.title['es-MX']}${register.titleSuffix}`,
            'pt-BR': `${course.catalog.course.title['pt-BR']}${register.titleSuffix}`,
          },
          description: course.catalog.course.description,
          position: 0,
        },
        adventure: {
          slug: slot.adventure.slug,
          position: slot.adventure.position,
          theme: slot.adventure.theme,
          ageTier: slot.tier,
          title: slot.adventure.title,
          description: slot.adventure.description,
          narrativeArc: slot.adventure.narrative_arc,
        },
        saga: {
          slug: slot.saga.slug,
          position: slot.saga.position,
          icon: slot.saga.icon,
          title: slot.saga.title,
          description: slot.saga.description,
        },
        topic: {
          slug: slot.topic.slug,
          position: slot.topic.position,
          title: {
            'es-MX': slot.topic.title_es,
            'en-US': await translateTitle(slot.topic.title_es, 'en-US', { ledger }),
            'pt-BR': await translateTitle(slot.topic.title_es, 'pt-BR', { ledger }),
          },
          conceptMd: slot.topic.concept,
          learningObjective: { 'en-US': slot.topic.learning_objective, 'es-MX': slot.topic.learning_objective, 'pt-BR': slot.topic.learning_objective },
          keyVocabulary: slot.topic.key_vocabulary,
          priorKnowledge: slot.topic.prior_knowledge,
        },
        lesson: {
          slug: slot.lesson.slug,
          position: slot.lesson.position,
          difficulty: slot.lesson.difficulty,
          estimatedMinutes: documents[AUTHORING_LOCALE]!.meta.estimated_minutes,
          cast: documents[AUTHORING_LOCALE]!.meta.cast,
        },
        documents,
      };
      const publishResult = await publishLessonSlot(publishInput);
      checkpoint = setSlotState(checkpoint, slot.slotId, 'published', { data: { publishResult } });
      await store.save(checkpoint);
    }

    return { slotId: slot.slotId, state: 'published' };
  } catch (err) {
    if (err instanceof BudgetExceededError) throw err; // stop the whole run, don't mark this slot failed
    const message = err instanceof Error ? err.message : String(err);
    checkpoint = setSlotState(checkpoint, slot.slotId, 'failed', { error: message });
    await store.save(checkpoint);
    return { slotId: slot.slotId, state: 'failed', error: message };
  }
}

export interface RunSummary {
  runId: string;
  published: string[];
  failed: { slotId: string; error: string }[];
  stoppedOnBudget: boolean;
  tokensUsed: number;
  usdUsed: number;
}

export async function runGeneration(options: RunOptions, deps: RunDeps = {}): Promise<RunSummary> {
  requireGenerationKeys();
  const config = getConfig();
  const courseDir = path.join(options.curriculumRoot, options.course);
  const loadResult = loadCourseCatalog(courseDir);
  const errors = loadResult.issues.filter((i) => i.level === 'error');
  if (errors.length > 0) {
    throw new Error(`generate: catalog failed to load — ${errors.map((e) => e.message).join('; ')}`);
  }

  const runId = options.runId ?? `${options.course}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const runDir = path.join(options.runsRoot, runId);
  const store = new CheckpointStore(path.join(runDir, 'checkpoint.json'));
  const checkpoint = (await store.load()) ?? newRunCheckpoint(runId, options.course);

  const ledger = deps.ledger ?? new UsageLedger(runDir);
  const allSlots = enumerateSlots(loadResult.course.adventures);
  const slots = filterSlots(allSlots, options.slots);
  const register = resolveRegister(loadResult.course.taxonomy, options.register ?? 'kid');

  const published: string[] = [];
  const failed: { slotId: string; error: string }[] = [];
  let stoppedOnBudget = false;

  try {
    await promisePool(slots, config.FORGE_CONCURRENCY, async (slot) => {
      if (stoppedOnBudget) return;
      // Outer per-slot attempts (FORGE_SLOT_ATTEMPTS): a judge rejection or
      // write exhaustion resets the slot and regenerates it FROM SCRATCH — a
      // fresh draw converges far better than more revise cycles on the same
      // bad draft. BudgetExceededError still aborts the whole run (rethrown
      // by processSlot), so retries can never blow past the kill-switches.
      let outcome = await processSlot(slot, loadResult.course, checkpoint, store, options, ledger, register);
      let attempt = 1;
      while (outcome.state === 'failed' && attempt < config.FORGE_SLOT_ATTEMPTS && !stoppedOnBudget) {
        attempt++;
        console.warn(`[forge] slot ${slot.slotId} failed (attempt ${attempt - 1}/${config.FORGE_SLOT_ATTEMPTS}) — regenerating from scratch: ${outcome.error?.slice(0, 160)}`);
        // setSlotState mutates the shared checkpoint object in place (the same
        // object every worker holds) — no reassignment needed or allowed here.
        setSlotState(checkpoint, slot.slotId, 'pending', { data: undefined });
        await store.save(checkpoint);
        outcome = await processSlot(slot, loadResult.course, checkpoint, store, options, ledger, register);
      }
      if (outcome.state === 'published') published.push(outcome.slotId);
      else if (outcome.state === 'failed') failed.push({ slotId: outcome.slotId, error: outcome.error ?? 'unknown error' });
    });
  } catch (err) {
    if (err instanceof BudgetExceededError) stoppedOnBudget = true;
    else throw err;
  }

  return {
    runId,
    published,
    failed,
    stoppedOnBudget,
    tokensUsed: ledger.tokens,
    usdUsed: ledger.usd,
  };
}
