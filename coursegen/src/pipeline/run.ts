// Run orchestration — wires validate→plan→write→gate→review→localize→
// images→publish per slot, with checkpoint/resume, a small concurrency
// pool, and the budget kill switches (COURSE_ENGINE.md §4).

import path from 'node:path';
import { getConfig, requireGenerationKeys } from '../env.js';
import { loadCourseCatalog, resolveReviewSources, type CourseCatalog, type LoadedAdventure } from '../catalog/loader.js';
import type { AdventureFile, CatalogFile, TaxonomyFile } from '../catalog/schema.js';
import { LESSON_LOCALES } from '../contract/core/types.js';
import { UsageLedger, BudgetExceededError } from '../providers/usage.js';
import { isFatalProviderError } from '../providers/errors.js';
import { vaultSelect } from '../vault/restClient.js';
import { buildImageInheritance } from './imageInheritance.js';
import {
  CheckpointStore,
  newRunCheckpoint,
  getSlot,
  setSlotState,
  isSlotDone,
  describeParamMismatch,
  type RunCheckpoint,
  type RunParams,
} from './checkpoint.js';
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
  state: 'published' | 'failed' | 'skipped' | 'dry-run';
  /** How many Prism illustrations this slot actually produced (cached + fresh). */
  imagesGenerated?: number;
  /** Of those, how many were FRESH — i.e. actually paid for. */
  imagesBilled?: number;
  /** Slots filled from this lesson's PREVIOUS art — the money NOT spent. */
  imagesInherited?: number;
  /** Why illustration was skipped, when it was (e.g. 'not-configured'). */
  imageSkipReasons?: string[];
  /** True when the write stage SALVAGED a partial document (segments were dropped). */
  salvaged?: boolean;
  droppedSegments?: number;
  error?: string;
}


/**
 * The documents this lesson published LAST time, for image inheritance.
 *
 * Scoped to the course through the embedded-resource filter so a lesson slug that
 * repeats in another course can never donate its art here. Failure is swallowed by
 * design: inheritance is a cost optimisation, never a precondition — if Vault is
 * unreachable we simply pay for the images, which is the old behaviour.
 */
async function previousArtDocuments(courseSlug: string, lessonSlug: string): Promise<LessonDocumentParsed[]> {
  try {
    const rows = await vaultSelect<{ locale: string; document: unknown }>(
      `/lesson_documents?select=locale,document,lessons!inner(slug,topics!inner(sagas!inner(adventures!inner(courses!inner(slug)))))` +
        `&lessons.slug=eq.${encodeURIComponent(lessonSlug)}` +
        `&lessons.topics.sagas.adventures.courses.slug=eq.${encodeURIComponent(courseSlug)}`,
    );
    // Authoring locale first so `buildImageInheritance`'s first-wins rule is stable.
    const ordered = [...rows].sort((a, b) => (a.locale === AUTHORING_LOCALE ? -1 : b.locale === AUTHORING_LOCALE ? 1 : 0));
    return ordered.map((r) => r.document as LessonDocumentParsed);
  } catch {
    return [];
  }
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
  // Outcome telemetry that must survive to the summary (see ProcessSlotOutcome).
  let imagesGenerated = 0;
  let imagesBilled = 0;
  let imagesInherited = 0;
  const imageSkipReasons = new Set<string>();
  let salvaged = false;
  let droppedSegments = 0;
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
      // `salvaged`/`droppedSegments` were returned by write and never read, so a
      // lesson that lost up to 8 of 14 planned segments published as a clean success.
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
      salvaged = salvaged || writeResult.salvaged;
      droppedSegments += writeResult.droppedSegments;
      if (writeResult.salvaged) {
        console.warn(
          `[forge] slot ${slot.slotId}: write SALVAGED — ${writeResult.droppedSegments} planned segment(s) dropped. ` +
            `The lesson is shorter than its blueprint.`,
        );
      }
      const gateReport = runAllGates(writeResult.document, gateCtx);
      if (!gateReport.ok || !gateReport.document) {
        throw new Error(`gate failure on es-MX write: ${gateReport.problems.slice(0, 5).map((p) => p.message).join('; ')}`);
      }
      documents = { ...documents, [AUTHORING_LOCALE]: gateReport.document };
      checkpoint = setSlotState(checkpoint, slot.slotId, 'written', {
        data: { skeleton, documents, salvaged: writeResult.salvaged, droppedSegments: writeResult.droppedSegments },
      });
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
        // first real QA run). A `standalone` course (type-coverage / practice
        // harness) has no narrative arc between arbitrary forced-type demos, so
        // every lesson is exempt (null) — otherwise the continuity requirement
        // false-fails otherwise-excellent standalone lessons.
        priorMicroObjective: course.catalog.course.standalone ? null : (slot.priorMicroObjective ?? null),
        standalone: course.catalog.course.standalone ?? false,
      });
      documents = { ...documents, [AUTHORING_LOCALE]: reviewResult.document };
      checkpoint = setSlotState(checkpoint, slot.slotId, 'reviewed', { data: { skeleton, documents, rubric: reviewResult.rubric } });
      await store.save(checkpoint);
    }

    // ---- localize ----
    current = getSlot(checkpoint, slot.slotId);
    if (current.state === 'reviewed') {
      // Consumption discipline ("optimizar consumo"): illustrate the AUTHORING
      // document BEFORE localizing. `image_url` is in NON_VISIBLE_KEYS, so the
      // string-freeze translation copies it verbatim into en-US/pt-BR — the
      // illustrations carry no text by design (Prism's identity brief), so one
      // generated image serves all 3 locales. 3× fewer image calls per lesson.
      /*
       * Inherit the art this lesson already has before paying for any of it. A
       * regeneration rewrites labels and contexts, so Prism's request-hash cache
       * always misses even when the object is identical — and illustration is the
       * dominant cost of mass generation (~$100 per 1000-lesson course). Object art
       * is reused by normalized label; scene anchors are never inherited.
       */
      const inherit = options.noImages
        ? undefined
        : buildImageInheritance(await previousArtDocuments(course.catalog.course.slug, slot.lesson.slug));
      const illustratedSource = await illustrateSegments(documents[AUTHORING_LOCALE]!, { skip: options.noImages, ledger, inherit });
      documents = { ...documents, [AUTHORING_LOCALE]: illustratedSource.document };
      // Image outcomes must LEAVE this function. They used to be destructured away,
      // so an unconfigured or down Prism published a visual-first curriculum with
      // zero illustrations while the run reported complete success — and nothing
      // downstream re-checks, since the judge runs BEFORE illustration.
      imagesGenerated += illustratedSource.generated ?? 0;
      imagesBilled += illustratedSource.billed ?? 0;
      imagesInherited += illustratedSource.inherited ?? 0;
      if (illustratedSource.skippedReason) imageSkipReasons.add(illustratedSource.skippedReason);
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

    // ---- images (optional; a no-op when the pre-localize pass covered everything) ----
    current = getSlot(checkpoint, slot.slotId);
    if (current.state === 'localized') {
      // Own index: this belt-and-braces sweep is a separate stage from the
      // pre-localize illustrate above, so it cannot reuse that const — and on a
      // RESUME this stage may run without the earlier one having run at all.
      const localeInherit = options.noImages
        ? undefined
        : buildImageInheritance(await previousArtDocuments(course.catalog.course.slug, slot.lesson.slug));
      // Belt-and-braces sweep: anything still missing an image_url (a locale
      // document restored from an older checkpoint, a per-locale regen) gets
      // filled here. With the pre-localize illustration above this loop makes
      // ZERO Prism calls on the happy path — and Prism's cache would dedupe
      // identical prompts anyway.
      for (const locale of Object.keys(documents) as LessonLocale[]) {
        const illustrated = await illustrateSegments(documents[locale]!, { skip: options.noImages, ledger, inherit: localeInherit });
        documents = { ...documents, [locale]: illustrated.document };
        imagesGenerated += illustrated.generated ?? 0;
        imagesBilled += illustrated.billed ?? 0;
        imagesInherited += illustrated.inherited ?? 0;
        if (illustrated.skippedReason) imageSkipReasons.add(illustrated.skippedReason);
      }
      checkpoint = setSlotState(checkpoint, slot.slotId, 'illustrated', { data: { skeleton, documents } });
      await store.save(checkpoint);
    }

    // ---- publish ----
    current = getSlot(checkpoint, slot.slotId);
    if (current.state === 'illustrated') {
      if (options.dryRun) {
        // 'dry-run', never 'published': marking it published made isSlotDone treat a
        // validation pass as real work, so a dry run followed by the real run under
        // the same --run-id published NOTHING while reporting every slot done.
        checkpoint = setSlotState(checkpoint, slot.slotId, 'dry-run', { data: { skeleton, documents, dryRun: true } });
        await store.save(checkpoint);
        return { slotId: slot.slotId, state: 'dry-run', imagesGenerated, imagesBilled, imagesInherited, imageSkipReasons: [...imageSkipReasons] };
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

    /*
     * NEVER claim success without proof. This return used to be unconditional at the
     * end of the try block, so a slot whose state fell outside the expected lifecycle
     * — a hand-edited or partially-written checkpoint, or any state added later —
     * skipped every stage guard above and was reported published with NOTHING in
     * Vault. Assert the state machine actually arrived.
     */
    const finalState = getSlot(checkpoint, slot.slotId).state;
    if (finalState !== 'published') {
      const message =
        `slot finished the pipeline in state "${finalState}" instead of "published" — no stage claimed it, ` +
        `so nothing was written to Vault. This usually means the checkpoint holds an unexpected state.`;
      checkpoint = setSlotState(checkpoint, slot.slotId, 'failed', { error: message });
      await saveQuietly(store, checkpoint, slot.slotId);
      return { slotId: slot.slotId, state: 'failed', error: message, imagesGenerated, imagesBilled, imagesInherited, salvaged, droppedSegments };
    }
    return {
      slotId: slot.slotId,
      state: 'published',
      imagesGenerated,
      imagesBilled,
      imagesInherited,
      imageSkipReasons: [...imageSkipReasons],
      salvaged,
      droppedSegments,
    };
  } catch (err) {
    if (err instanceof BudgetExceededError) throw err; // stop the whole run, don't mark this slot failed
    /*
     * A dead credential or an empty balance is not a slot-level problem, and every
     * further call is guaranteed to fail while still costing an HTTP round trip and
     * (for whatever already succeeded) discarding paid work. Measured: a real run hit
     * DeepSeek "Insufficient Balance" and then burned 2.17M tokens / ~$10 failing all
     * 62 slots three times each before exiting. Abort the run the way a budget stop
     * does, so the operator sees ONE clear cause instead of 62 derived symptoms.
     */
    if (isFatalProviderError(err)) throw err;
    const message = err instanceof Error ? err.message : String(err);
    /*
     * The failure bookkeeping must not itself be able to kill the run. `store.save`
     * does disk I/O (ENOSPC, EACCES, a transient FS error on a multi-day run), and
     * an exception thrown HERE escapes this catch, propagates through the pool and
     * aborts every remaining slot — turning one lesson's failure into a dead run.
     */
    checkpoint = setSlotState(checkpoint, slot.slotId, 'failed', { error: message });
    await saveQuietly(store, checkpoint, slot.slotId);
    /*
     * Telemetry travels with a FAILURE too. Found on the 62-slot run that died on a
     * provider balance error: the summary printed "images: 0 placed, 0 freshly
     * generated" while the ledger had recorded 424 paid generations ($8.48) — because
     * a failed slot returned no counts. Money spent before a failure is exactly the
     * money an operator most needs to see.
     */
    return { slotId: slot.slotId, state: 'failed', error: message, imagesGenerated, imagesBilled, imagesInherited, salvaged, droppedSegments };
  }
}

/** Persists the checkpoint, downgrading a write failure to a warning (see the catch above). */
async function saveQuietly(store: CheckpointStore, checkpoint: RunCheckpoint, slotId: string): Promise<void> {
  try {
    await store.save(checkpoint);
  } catch (saveErr) {
    console.error(
      `[forge] WARNING: could not persist the checkpoint after slot ${slotId} failed ` +
        `(${saveErr instanceof Error ? saveErr.message : String(saveErr)}). The run continues, but this slot ` +
        `will be retried on resume.`,
    );
  }
}

/**
 * Every enumerated slot lands in EXACTLY ONE bucket. The old summary carried only
 * `published` and `failed`, so slots that were never attempted (budget stop, or
 * already finished by an earlier invocation) vanished from the report and a run
 * that touched 300 of 1000 slots printed a clean partial success.
 */
export interface RunSummary {
  runId: string;
  published: string[];
  failed: { slotId: string; error: string }[];
  /** Validated by --dry-run; nothing was written or paid for. */
  dryRun: string[];
  /** Deliberately not processed (e.g. the course catalog failed to load). */
  skipped: { slotId: string; reason: string }[];
  /** Already 'published' in the checkpoint before this invocation started. */
  alreadyDone: string[];
  /** Enumerated but never reached — the honest name for what used to be invisible. */
  notAttempted: string[];
  slotsEnumerated: number;
  /** Set when a dead credential / empty balance aborted the run (401/402/403). */
  fatalProviderError: string | null;
  /** Prism illustrations produced — zero on a visual-first course is a RED FLAG, not a success. */
  imagesGenerated: number;
  /** Of those, FRESH generations — the ones that cost money (cache hits are free). */
  imagesBilled: number;
  /** Slots filled from the lesson's PREVIOUS art — the money this run did NOT spend. */
  imagesInherited: number;
  /** Distinct reasons illustration was skipped (e.g. 'not-configured'). */
  imageSkipReasons: string[];
  /** Lessons published SHORTER than their blueprint because write had to salvage. */
  salvagedSlots: { slotId: string; droppedSegments: number }[];
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

  /*
   * A resume must be provably COMPATIBLE with what produced the existing slots.
   * `isSlotDone` only reads the state string, so without this check a resume with
   * different flags silently treats incompatible work as finished and reports
   * success — the single worst failure mode found in the mass-generation audit,
   * because a 1000-lesson course REQUIRES multiple invocations and every variation
   * (fewer locales, --no-images, a different register) was reachable in normal use.
   */
  const runParams: RunParams = {
    course: options.course,
    locales: [...(options.locales ?? LESSON_LOCALES)],
    noImages: options.noImages === true,
    register: options.register ?? 'kid',
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

  const allSlots = enumerateSlots(loadResult.course.adventures);
  const slots = filterSlots(allSlots, options.slots);

  /*
   * Budget scaled to the enumerated work, then hydrated from the run's own ledger.
   *
   * Two separate mass-generation failures live here. (1) The absolute 5M-token cap
   * is sized for ~48 lessons, so a 1000+ lesson course was arithmetically
   * guaranteed to abort partway through — the cap has to grow with the slot count
   * or it is a bug, not a guard. (2) The totals restarted at zero in every process,
   * so the "per-run" ceilings were per-invocation and bounded nothing across the
   * resumes a long run requires. `hydrate()` replays ledger.jsonl to fix (2).
   */
  const ledger = deps.ledger ?? new UsageLedger(runDir);
  const scaled = {
    maxTokens: Math.max(config.FORGE_MAX_TOKENS_PER_RUN, slots.length * config.FORGE_MAX_TOKENS_PER_SLOT),
    maxUsd: Math.max(config.FORGE_MAX_USD_PER_RUN, slots.length * config.FORGE_MAX_USD_PER_SLOT),
  };
  await ledger.hydrate(scaled);
  console.log(
    `[forge] budget for ${slots.length} slot(s): ${scaled.maxTokens.toLocaleString()} tokens, $${scaled.maxUsd.toFixed(2)}`,
  );
  const register = resolveRegister(loadResult.course.taxonomy, options.register ?? 'kid');

  const published: string[] = [];
  const failed: { slotId: string; error: string }[] = [];
  const dryRun: string[] = [];
  const skipped: { slotId: string; reason: string }[] = [];
  let imagesGenerated = 0;
  let imagesBilled = 0;
  let imagesInherited = 0;
  const imageSkipReasons = new Set<string>();
  const salvagedSlots: { slotId: string; droppedSegments: number }[] = [];
  let stoppedOnBudget = false;
  let fatalProviderError: string | null = null;

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
      imagesGenerated += outcome.imagesGenerated ?? 0;
      imagesBilled += outcome.imagesBilled ?? 0;
      imagesInherited += outcome.imagesInherited ?? 0;
      for (const r of outcome.imageSkipReasons ?? []) imageSkipReasons.add(r);
      if (outcome.salvaged) salvagedSlots.push({ slotId: outcome.slotId, droppedSegments: outcome.droppedSegments ?? 0 });
      if (outcome.state === 'published') published.push(outcome.slotId);
      else if (outcome.state === 'failed') failed.push({ slotId: outcome.slotId, error: outcome.error ?? 'unknown error' });
      else if (outcome.state === 'dry-run') dryRun.push(outcome.slotId);
      else skipped.push({ slotId: outcome.slotId, reason: outcome.error ?? 'skipped' });
    });
  } catch (err) {
    if (err instanceof BudgetExceededError) stoppedOnBudget = true;
    else if (isFatalProviderError(err)) {
      // One clear cause, not 62 derived symptoms. Everything already published stays
      // published; everything else stays resumable from the checkpoint.
      fatalProviderError = err instanceof Error ? err.message : String(err);
    } else throw err;
  }

  /*
   * THE SUMMARY MUST ACCOUNT FOR EVERY SLOT. Previously a slot that was never
   * attempted — because a budget stop made the pool return early, or because it
   * was already published by an earlier invocation — appeared in NEITHER
   * `published` NOR `failed`, so a run that touched 300 of 1000 slots printed a
   * clean partial success and an operator had no way to see the other 700. Now
   * every slot is in exactly one bucket and the totals are asserted to add up.
   */
  const accountedIds = new Set([
    ...published,
    ...failed.map((f) => f.slotId),
    ...dryRun,
    ...skipped.map((s) => s.slotId),
  ]);
  const alreadyDone: string[] = [];
  const notAttempted: string[] = [];
  for (const slot of slots) {
    if (accountedIds.has(slot.slotId)) continue;
    (isSlotDone(checkpoint, slot.slotId) ? alreadyDone : notAttempted).push(slot.slotId);
  }

  const summary: RunSummary = {
    runId,
    published,
    failed,
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
  };
  const tallied =
    published.length + failed.length + dryRun.length + skipped.length + alreadyDone.length + notAttempted.length;
  if (tallied !== slots.length) {
    // Never silently: an accounting hole here is exactly how lessons went missing.
    console.warn(
      `[forge] BUG: summary accounts for ${tallied} slot(s) but ${slots.length} were enumerated — please report this run id.`,
    );
  }
  return summary;
}
