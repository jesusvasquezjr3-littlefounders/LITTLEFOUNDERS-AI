#!/usr/bin/env node
/*
 * graph:backfill — fills in the two competency-graph columns migration 0042
 * added and NOTHING ever wrote, on already-live content, without regenerating
 * a single lesson.
 *
 *   npm run graph:backfill -- --course <slug|all> [--prereqs-only|--probes-only]
 *                             [--dry-run] [--confirm] [--max-usd N]
 *                             [--concurrency N] [--limit N]
 *
 * WHY THIS EXISTS. Production carried 871 topics with 0 placement probes and 0
 * prerequisites, so `computePlacement` took its `no_probe_content_fallback`
 * branch for every learner who ever ran the quiz — 5 of the 6 real placement
 * rows, including two adults who declared themselves "confident" and were
 * dropped at lesson 1 of 1,305. The catalog HAD the prerequisites all along
 * (43 of them in financial-education); they simply never reached Vault,
 * because the content predates 0042 and `author-publish.ts` hardcoded
 * `placementProbe: null`. Republishing 1,305 live lessons to fix two columns
 * would be the expensive, risky way to do it: publish re-enters the human
 * release gate and would pull live kid-facing content out of the catalog.
 * This writes ONLY the two columns, on rows that already exist.
 *
 * INVARIANTS
 *  - ADDITIVE. The PATCH body names `prerequisites` and/or `placement_probe`
 *    and nothing else; every sibling column (status, concept_md, review_of…)
 *    is untouched, and no lesson row is read or written at all.
 *  - RESUMABLE. A topic that already has a probe is skipped, so an interrupted
 *    run costs nothing to resume. Re-running after a catalog edit re-writes
 *    prerequisites (free) but never re-pays for a probe that exists — use
 *    --force-probes to deliberately re-author.
 *  - PAID WORK IS OPT-IN. Probe authoring calls DeepSeek. Without --confirm
 *    the run reports exactly what it WOULD author and spends nothing.
 *  - THE AUDIENCE IS DERIVED, NEVER ASSUMED. Each probe carries its own
 *    course's subject and age band (/AGENTS.md §1.14) — an entrepreneurship
 *    probe can never inherit financial-education's 6-year-old register.
 *  - A TOPIC WITH NO LIVE LESSON IS NOT PROBED. Placement walks live content;
 *    paying to author a question about 733 archived lessons is money burned.
 *
 * Operator-triggered only — never CI.
 */

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { loadCourseCatalog } from '../catalog/loader.js';
import {
  authorPlacementProbe,
  translatePlacementProbe,
  type PlacementProbe,
  type ProbeAudience,
} from '../pipeline/placementProbe.js';
import { UsageLedger } from '../providers/usage.js';
import { vaultSelect, vaultPatch } from '../vault/restClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '../..');
const CURRICULUM_ROOT = path.join(PACKAGE_ROOT, 'curriculum');

type Locale = 'es-MX' | 'en-US' | 'pt-BR';
type ProbeBundle = Record<Locale, PlacementProbe>;

export interface CatalogPrerequisite {
  path: string;
  strength: 'hard' | 'soft';
  reason: string;
}

/** One catalog topic, flattened to everything a backfill decision needs. */
export interface CatalogTopic {
  /** "<adventure>/<saga>/<topic>" — the join key against Vault. */
  topicPath: string;
  kind: string;
  concept: string;
  learningObjective: string;
  keyVocabulary: string[];
  factRefs: string[];
  prerequisites: CatalogPrerequisite[];
  /** A hand-authored catalog probe, if the curriculum carries one. */
  override?: { prompt: string; options: string[]; correctIndex: number };
  audience: ProbeAudience;
}

/** One Vault topic row, with just enough of its lessons to know if it is live. */
export interface VaultTopic {
  id: string;
  topicPath: string;
  hasProbe: boolean;
  prerequisiteCount: number;
  liveLessonCount: number;
}

export interface BackfillPlan {
  prereqWrites: Array<{ id: string; topicPath: string; prerequisites: CatalogPrerequisite[] }>;
  probeTargets: Array<{ id: string; topicPath: string; topic: CatalogTopic }>;
  /** Diagnostics — a catalog topic Vault has never heard of, and vice versa. */
  unmatchedCatalog: string[];
  unmatchedVault: string[];
  skippedArchived: string[];
}

// ── Pure planning (dependency-free, unit-tested) ─────────────────────────────

/**
 * Decides what to write, from a catalog snapshot and a Vault snapshot. Pure so
 * the interesting decisions — which topics are archived, which already have a
 * probe, which prerequisites actually changed — are testable without a network
 * or a paid call.
 */
export function planBackfill(
  catalogTopics: readonly CatalogTopic[],
  vaultTopics: readonly VaultTopic[],
  options: { forceProbes?: boolean } = {},
): BackfillPlan {
  const byPath = new Map(vaultTopics.map((t) => [t.topicPath, t]));
  const catalogPaths = new Set(catalogTopics.map((t) => t.topicPath));

  const plan: BackfillPlan = {
    prereqWrites: [],
    probeTargets: [],
    unmatchedCatalog: [],
    unmatchedVault: [],
    skippedArchived: [],
  };

  for (const topic of catalogTopics) {
    const vault = byPath.get(topic.topicPath);
    if (!vault) {
      plan.unmatchedCatalog.push(topic.topicPath);
      continue;
    }

    // Prerequisites are free to write and idempotent. Write when the catalog
    // declares any and Vault has none — the exact production state — and
    // whenever the counts disagree, which is how a catalog edit propagates.
    if (topic.prerequisites.length > 0 && topic.prerequisites.length !== vault.prerequisiteCount) {
      plan.prereqWrites.push({ id: vault.id, topicPath: topic.topicPath, prerequisites: topic.prerequisites });
    }

    // Probes: teaching topics only, live lessons only, not already probed.
    if (topic.kind !== 'teaching') continue;
    if (vault.liveLessonCount === 0) {
      plan.skippedArchived.push(topic.topicPath);
      continue;
    }
    if (vault.hasProbe && !options.forceProbes) continue;
    plan.probeTargets.push({ id: vault.id, topicPath: topic.topicPath, topic });
  }

  for (const vault of vaultTopics) {
    if (!catalogPaths.has(vault.topicPath)) plan.unmatchedVault.push(vault.topicPath);
  }
  return plan;
}

// ── Catalog + Vault readers ──────────────────────────────────────────────────

/** Flattens one course directory's YAML into the shape `planBackfill` consumes. */
export function readCatalogTopics(courseDir: string): { topics: CatalogTopic[]; courseSlug: string } {
  const load = loadCourseCatalog(courseDir);
  const errors = load.issues.filter((i) => i.level === 'error');
  if (errors.length > 0) {
    throw new Error(`catalog ${courseDir} failed to load: ${errors.map((e) => e.message).join('; ')}`);
  }
  const courseSlug = load.course.catalog?.course.slug ?? path.basename(courseDir);
  const subject = load.course.catalog?.course.subject ?? 'unknown';
  const ageTiers = load.course.taxonomy?.age_tiers ?? {};
  // The catalog register is 'kid' for every course generated so far; an adult
  // course publishes under its own `-adultos` slug and its own directory, so
  // reading it off the taxonomy here would be guessing. Stated, not inferred.
  const register: 'kid' | 'adult' = courseDir.endsWith('-adultos') ? 'adult' : 'kid';

  const topics: CatalogTopic[] = [];
  for (const { data } of load.course.adventures) {
    const ages = ageTiers[data.adventure.age_tier]?.ages ?? data.adventure.age_tier;
    for (const saga of data.sagas) {
      for (const topic of saga.topics) {
        topics.push({
          topicPath: `${data.adventure.slug}/${saga.slug}/${topic.slug}`,
          kind: topic.kind ?? 'teaching',
          concept: topic.concept,
          learningObjective: topic.learning_objective,
          keyVocabulary: topic.key_vocabulary ?? [],
          factRefs: topic.fact_refs ?? [],
          prerequisites: (topic.prerequisites ?? []) as CatalogPrerequisite[],
          override: topic.placement_probe
            ? {
                prompt: topic.placement_probe.prompt,
                options: topic.placement_probe.options,
                correctIndex: topic.placement_probe.correct_index,
              }
            : undefined,
          audience: { subject, ages, register },
        });
      }
    }
  }
  return { topics, courseSlug };
}

interface VaultTopicRow {
  id: string;
  slug: string;
  kind: string;
  placement_probe: unknown;
  prerequisites: unknown;
  lessons: Array<{ status: string }>;
}

/** Reads every topic of one course out of Vault, paginated (PostgREST caps at 1000). */
export async function readVaultTopics(courseSlug: string): Promise<VaultTopic[]> {
  const rows: VaultTopic[] = [];
  const adventures = await vaultSelect<{
    slug: string;
    sagas: Array<{ slug: string; topics: VaultTopicRow[] }>;
  }>(
    `/adventures?select=slug,sagas(slug,topics(id,slug,kind,placement_probe,prerequisites,lessons(status)))` +
      `&course.slug=eq.${encodeURIComponent(courseSlug)}&course=not.is.null`,
  ).catch(async () => {
    // The embedded filter above needs the FK alias to resolve; fall back to
    // filtering by course id, which always works.
    const [course] = await vaultSelect<{ id: string }>(`/courses?select=id&slug=eq.${encodeURIComponent(courseSlug)}`);
    if (!course) throw new Error(`no course with slug "${courseSlug}" in Vault`);
    return vaultSelect<{ slug: string; sagas: Array<{ slug: string; topics: VaultTopicRow[] }> }>(
      `/adventures?select=slug,sagas(slug,topics(id,slug,kind,placement_probe,prerequisites,lessons(status)))&course_id=eq.${course.id}`,
    );
  });

  for (const adventure of adventures) {
    for (const saga of adventure.sagas ?? []) {
      for (const topic of saga.topics ?? []) {
        rows.push({
          id: topic.id,
          topicPath: `${adventure.slug}/${saga.slug}/${topic.slug}`,
          hasProbe: topic.placement_probe !== null && topic.placement_probe !== undefined,
          prerequisiteCount: Array.isArray(topic.prerequisites) ? topic.prerequisites.length : 0,
          liveLessonCount: (topic.lessons ?? []).filter((l) => l.status !== 'archived').length,
        });
      }
    }
  }
  return rows;
}

// ── Probe authoring ──────────────────────────────────────────────────────────

/**
 * Authors (or lifts from the catalog) one probe in es-MX and translates it into
 * the other two locales. Identical semantics to run.ts's `resolvePlacementProbe`
 * — deliberately the same shape, so the backfilled probes are the same artifact
 * a fresh generation would have produced.
 */
export async function authorProbeBundle(topic: CatalogTopic, ledger?: UsageLedger): Promise<ProbeBundle> {
  const esMx: PlacementProbe = topic.override
    ? { prompt: topic.override.prompt, options: topic.override.options, correctIndex: topic.override.correctIndex }
    : await authorPlacementProbe(
        {
          concept: topic.concept,
          learningObjective: topic.learningObjective,
          keyVocabulary: topic.keyVocabulary,
          factRefs: topic.factRefs,
          audience: topic.audience,
        },
        { ledger },
      );

  const [enUs, ptBr] = await Promise.all([
    translatePlacementProbe(esMx, 'en-US', topic.audience, { ledger }),
    translatePlacementProbe(esMx, 'pt-BR', topic.audience, { ledger }),
  ]);
  return { 'es-MX': esMx, 'en-US': enUs, 'pt-BR': ptBr };
}

async function pool<T>(items: readonly T[], concurrency: number, worker: (item: T, index: number) => Promise<void>): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      await worker(items[index]!, index);
    }
  });
  await Promise.all(runners);
}

// ── CLI ──────────────────────────────────────────────────────────────────────

interface Flags {
  course: string;
  dryRun: boolean;
  confirm: boolean;
  prereqsOnly: boolean;
  probesOnly: boolean;
  forceProbes: boolean;
  concurrency: number;
  limit: number | null;
  maxUsd: number | null;
}

function parseFlags(argv: string[]): Flags {
  const get = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const has = (name: string) => argv.includes(`--${name}`);
  const num = (name: string): number | null => {
    const raw = get(name);
    if (raw === undefined) return null;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`--${name} must be a positive number`);
    return parsed;
  };
  return {
    course: get('course') ?? 'all',
    dryRun: has('dry-run'),
    confirm: has('confirm'),
    prereqsOnly: has('prereqs-only'),
    probesOnly: has('probes-only'),
    forceProbes: has('force-probes'),
    concurrency: num('concurrency') ?? 4,
    limit: num('limit'),
    maxUsd: num('max-usd'),
  };
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const courseDirs =
    flags.course === 'all'
      ? ['financial-education', 'entrepreneurship', 'investing'].map((s) => path.join(CURRICULUM_ROOT, s))
      : [path.isAbsolute(flags.course) ? flags.course : path.join(CURRICULUM_ROOT, flags.course)];

  // One ledger for the whole run, in a stable directory so an interrupted run
  // resumes with its spend intact rather than restarting the budget at zero.
  const runDir = path.join(PACKAGE_ROOT, 'runs', 'graph-backfill');
  mkdirSync(runDir, { recursive: true });
  const ledger = new UsageLedger(runDir);
  await ledger.hydrate(flags.maxUsd ? { maxUsd: flags.maxUsd } : undefined);
  const usdAtStart = ledger.usd;

  let totalProbesWritten = 0;
  let totalPrereqsWritten = 0;
  let totalProbeFailures = 0;

  for (const courseDir of courseDirs) {
    const { topics: catalogTopics, courseSlug } = readCatalogTopics(courseDir);
    const vaultTopics = await readVaultTopics(courseSlug);
    const plan = planBackfill(catalogTopics, vaultTopics, { forceProbes: flags.forceProbes });

    console.log(`\n=== ${courseSlug} ===`);
    console.log(`  catalog topics: ${catalogTopics.length}   vault topics: ${vaultTopics.length}`);
    console.log(`  prerequisite writes pending: ${plan.prereqWrites.length}`);
    console.log(`  probes to author: ${plan.probeTargets.length}${flags.limit ? ` (limited to ${flags.limit})` : ''}`);
    console.log(`  skipped (all lessons archived): ${plan.skippedArchived.length}`);
    if (plan.unmatchedCatalog.length > 0) {
      console.warn(`  ⚠ ${plan.unmatchedCatalog.length} catalog topic(s) absent from Vault, e.g. ${plan.unmatchedCatalog.slice(0, 3).join(', ')}`);
    }
    if (plan.unmatchedVault.length > 0) {
      console.warn(`  ⚠ ${plan.unmatchedVault.length} Vault topic(s) absent from the catalog, e.g. ${plan.unmatchedVault.slice(0, 3).join(', ')}`);
    }

    // ---- prerequisites (free) ----
    if (!flags.probesOnly) {
      for (const write of plan.prereqWrites) {
        if (flags.dryRun) {
          console.log(`  [dry-run] prerequisites ${write.topicPath} <- ${write.prerequisites.length} edge(s)`);
          continue;
        }
        await vaultPatch(`/topics?id=eq.${write.id}`, { prerequisites: write.prerequisites });
        totalPrereqsWritten++;
      }
      if (!flags.dryRun && plan.prereqWrites.length > 0) {
        console.log(`  ✓ wrote prerequisites on ${plan.prereqWrites.length} topic(s)`);
      }
    }

    // ---- probes (paid) ----
    if (flags.prereqsOnly) continue;
    const targets = flags.limit ? plan.probeTargets.slice(0, flags.limit) : plan.probeTargets;
    if (targets.length === 0) continue;

    if (flags.dryRun || !flags.confirm) {
      console.log(
        `  [${flags.dryRun ? 'dry-run' : 'not confirmed'}] would author ${targets.length} probe(s) ` +
          `(${targets.length} authoring + ${targets.length * 2} translation DeepSeek calls). ` +
          `Re-run with --confirm to spend.`,
      );
      continue;
    }

    let done = 0;
    await pool(targets, flags.concurrency, async (target) => {
      try {
        const bundle = await authorProbeBundle(target.topic, ledger);
        await vaultPatch(`/topics?id=eq.${target.id}`, { placement_probe: bundle });
        totalProbesWritten++;
      } catch (err) {
        // One topic failing must not abandon the other 599. It stays unprobed,
        // which the placement algorithm already treats as "not yet authored",
        // and a re-run picks it up for free.
        totalProbeFailures++;
        console.error(`  ✗ ${target.topicPath}: ${(err as Error).message}`);
      }
      done++;
      if (done % 25 === 0 || done === targets.length) {
        console.log(`  … ${done}/${targets.length} probes  ($${(ledger.usd - usdAtStart).toFixed(4)} so far)`);
      }
    });
  }

  console.log(`\n── summary ──`);
  console.log(`  prerequisites written: ${totalPrereqsWritten}`);
  console.log(`  probes written:        ${totalProbesWritten}`);
  console.log(`  probe failures:        ${totalProbeFailures}`);
  console.log(`  spent this run:        $${(ledger.usd - usdAtStart).toFixed(4)}`);
  if (totalProbeFailures > 0) {
    console.log(`  (re-run to retry the failures — already-written probes are skipped for free)`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => {
    console.error(`graph:backfill failed: ${(err as Error).message}`);
    process.exit(1);
  });
}
