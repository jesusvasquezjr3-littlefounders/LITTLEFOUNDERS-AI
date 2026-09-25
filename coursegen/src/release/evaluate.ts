// The release acceptance evaluation behind `verify:course` (S05.4c), pure over
// already-loaded inputs so it is testable without Vault.
//
// It produces exactly one result per id in FORGE_RELEASE_CHECKS. The result
// list is the release attestation `verify:course` writes to
// `course_release_verifications.checks`, and Vault's `release_course`
// preflight refuses a release unless every id it requires carries `ok: true`
// (Product G.2: Core's staff publish route and the local publish command share
// that one preflight).
//
// Per-gate document checks are also the release-time snapshot of Appendix C
// Part 1.3's Forge Gate Pass Rate (per gate).

import type { CourseCatalog, LoadIssue } from '../catalog/loader.js';
import { checkProgression } from '../catalog/progression.js';
import { runAllGates, type GateNumber } from '../pipeline/gates.js';
import { collectSceneImages, inspectIllustrationCoverage } from '../pipeline/images.js';
import { buildCoursePolicy, type CoursePolicy } from '../contentGates/policyGates.js';
import { runContentGates } from '../contentGates/runner.js';
import type { CatalogString } from '../contentGates/sources.js';
import { runV2DocumentGates } from '../v2/gates.js';
import { FORGE_RELEASE_CHECKS, releaseCheck, type ReleaseCheckDefinition } from './gateManifest.js';

export interface ReleaseLessonRow {
  id: string;
  slug: string;
  status: string;
  /** Age tier of the lesson's adventure (Vault join). */
  tier?: string;
}

export interface ReleaseDocumentRow {
  lesson_id: string;
  locale: string;
  document: { segments?: Array<{ id: string } & Record<string, unknown>> } & Record<string, unknown>;
  answer_keys: Record<string, unknown> | null;
  audio?: { version?: unknown } | null;
  illustration_style_version: string | null;
}

/** An ACTIVATED v2 document of the course (lesson_document_version_current → lesson_document_versions). */
export interface ReleaseV2DocumentRow {
  lesson_id: string;
  locale: string;
  document: unknown;
}

export interface ReleaseTopicRow {
  id: string;
  title: unknown;
}

export interface ReleaseInput {
  catalog: CourseCatalog;
  catalogIssues: readonly LoadIssue[];
  /** Catalog strings (sources.loadCatalogStrings) for the catalog tone and Copy Budget checks. */
  catalogStrings: readonly CatalogString[];
  /** Every Vault lesson of the course, whatever its status. */
  lessons: readonly ReleaseLessonRow[];
  topics: readonly ReleaseTopicRow[];
  /** Documents of the review-or-published lessons. */
  documents: readonly ReleaseDocumentRow[];
  /** Activated v2 documents of the course's lessons (none until a v2 publication path exists). */
  v2Documents?: readonly ReleaseV2DocumentRow[];
  /** Orphaned Vault lessons (not named by the catalog) that carry learner progress. */
  orphansWithProgress: readonly string[];
  orphanCount: number;
  illustrationStyleVersion: string;
  /** Precomputed policy (tests); built from the catalog otherwise. */
  coursePolicy?: CoursePolicy;
}

export interface ReleaseCheckResult {
  /** Manifest id, the key `release_course` checks. */
  gate: string;
  name: string;
  ok: boolean;
  detail: string;
  /** Documents passing, for per-gate document checks. */
  passed?: number;
  total?: number;
  /** Documents excused by a declared known_exception (legacy gates 1-9 only). */
  excepted?: number;
}

export interface ReleaseEvaluation {
  checks: ReleaseCheckResult[];
  ok: boolean;
  /** "<slug> [<locale>]" → gate problems, for the itemized report. */
  gateFailures: Map<string, string[]>;
  exceptions: Map<string, string>;
  /** Lessons whose failures were excused by their declared exception. */
  excepted: Set<string>;
  narratedDocuments: number;
}

const DOCUMENT_GATES = FORGE_RELEASE_CHECKS.filter((check): check is ReleaseCheckDefinition & { gate: GateNumber } => check.gate !== undefined);

/**
 * Only USER-VISIBLE text counts for the currency-leak check: option ids are
 * locale-stable by design (localize freezes them so answer keys match).
 */
const VISIBLE_KEYS = new Set([
  'prompt_md', 'text_md', 'body_md', 'explanation_md', 'recap_md', 'label', 'title',
  'front_md', 'back_md', 'claim_md', 'artifact_md', 'intro_md', 'instruction_md',
  'criterion_md', 'rationale_md', 'fix_md', 'a_md', 'b_md', 'opening_md', 'role_md',
  'unknown_label', 'ask_label', 'hints',
]);
const WRONG_CURRENCY: Record<string, RegExp> = {
  'es-MX': /\bdollars?\b|\breais\b/i,
  'en-US': /\bpesos?\b|\breais\b/i,
  'pt-BR': /\bpesos?\b|\bdollars?\b/i,
};

function visibleText(node: unknown, key?: string): string[] {
  if (typeof node === 'string') return key && VISIBLE_KEYS.has(key) ? [node] : [];
  if (Array.isArray(node)) return node.flatMap((v) => visibleText(v, key));
  if (node && typeof node === 'object') {
    return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) => visibleText(v, k));
  }
  return [];
}

function catalogLessons(catalog: CourseCatalog) {
  const out = [];
  for (const adventure of catalog.adventures) {
    for (const saga of adventure.data.sagas) for (const topic of saga.topics) for (const lesson of topic.lessons) out.push(lesson);
  }
  return out;
}

export function evaluateRelease(input: ReleaseInput): ReleaseEvaluation {
  const results = new Map<string, ReleaseCheckResult>();
  const add = (id: string, ok: boolean, detail: string, counts: Partial<Pick<ReleaseCheckResult, 'passed' | 'total' | 'excepted'>> = {}) => {
    const definition = releaseCheck(id);
    results.set(id, { gate: id, name: definition.description, ok, detail, ...counts });
  };
  const { catalog } = input;

  // ---- catalog ----------------------------------------------------------------
  const catalogErrors = input.catalogIssues.filter((issue) => issue.level === 'error');
  add('forge.catalog.loads', catalogErrors.length === 0, `${catalogErrors.length} error(s)`);
  const progression = checkProgression(catalog);
  const progressionErrors = progression.filter((issue) => issue.level === 'error');
  add(
    'forge.catalog.progression',
    progressionErrors.length === 0,
    progressionErrors.length === 0 ? `${progression.length} warning(s)` : progressionErrors.map((issue) => issue.code).join(', '),
  );

  const policy = input.coursePolicy ?? buildCoursePolicy(catalog);
  const policyBlocks = (gate: number) => policy.findings.filter((f) => f.gate === gate && f.severity === 'block');
  const { metrics } = policy;
  add('forge.catalog.concept-cap', policyBlocks(14).length === 0, `${policyBlocks(14).length} blocking; density declared ${metrics.densityDeclared}/${metrics.lessons}`);
  add(
    'forge.catalog.mentor-misjudgment',
    policyBlocks(15).length === 0,
    `${policyBlocks(15).length} blocking; episodes ${metrics.misjudgmentEpisodes}/${metrics.misjudgmentMinimum} minimum`,
  );
  add(
    'forge.catalog.regional-adaptation',
    policyBlocks(16).length === 0,
    `${policyBlocks(16).length} blocking; market scenarios ${metrics.regionalDeclared}/${metrics.regionalRequired}`,
  );

  const catalogReport = runContentGates({
    ...(catalog.taxonomy ? { taxonomy: catalog.taxonomy } : {}),
    register: 'kid',
    documents: [],
    catalog: input.catalogStrings,
    ui: [],
    uiLiterals: [],
  });
  add(
    'forge.catalog.tone',
    input.catalogStrings.length > 0 && catalogReport.catalog.tone.length === 0,
    input.catalogStrings.length === 0
      ? 'no catalog strings were loaded'
      : `${catalogReport.catalog.tone.length} blocking of ${input.catalogStrings.length} strings; ${catalogReport.catalog.toneReview.length} for Stage 3 review`,
  );
  add(
    'forge.catalog.copy-budget',
    input.catalogStrings.length > 0 && catalogReport.catalog.copyBudget.length === 0,
    input.catalogStrings.length === 0 ? 'no catalog strings were loaded' : `${catalogReport.catalog.copyBudget.length} over budget of ${input.catalogStrings.length} strings`,
  );

  // ---- documents --------------------------------------------------------------
  const releaseReady = input.lessons.filter((lesson) => lesson.status === 'review' || lesson.status === 'published');
  const slugById = new Map(releaseReady.map((lesson) => [lesson.id, lesson.slug]));
  const tierById = new Map(releaseReady.map((lesson) => [lesson.id, lesson.tier]));
  const exceptions = new Map<string, string>();
  for (const lesson of catalogLessons(catalog)) if (lesson.known_exception) exceptions.set(lesson.slug, lesson.known_exception);

  const gateFailures = new Map<string, string[]>();
  const excepted = new Set<string>();
  const perGate = new Map<number, { passed: number; excepted: number }>(DOCUMENT_GATES.map((check) => [check.gate, { passed: 0, excepted: 0 }]));
  for (const row of input.documents) {
    const slug = slugById.get(row.lesson_id) ?? row.lesson_id;
    const keys = row.answer_keys ?? {};
    const merged = {
      ...row.document,
      segments: (row.document.segments ?? []).map((segment) => (keys[segment.id] ? { ...segment, answer: keys[segment.id] } : segment)),
    };
    const tier = tierById.get(row.lesson_id);
    const failing = new Set<number>();
    const problems: string[] = [];
    const contextOk = !!tier && !!catalog.taxonomy && !!catalog.facts;
    let evaluated = false;
    if (!contextOk) {
      problems.push('release context: could not determine the lesson age tier, taxonomy, or facts');
    } else {
      const lessonPolicy = policy.lessons.get(slug);
      const report = runAllGates(merged, {
        taxonomy: catalog.taxonomy!,
        facts: catalog.facts!,
        tier: tier!,
        ...(lessonPolicy ? { lessonPolicy } : {}),
      });
      // A document failing the contract never reaches gates 2-16: they were not
      // evaluated, so they cannot count as passed (fail closed).
      evaluated = !report.problems.some((p) => p.gate === 1);
      for (const problem of report.problems) {
        failing.add(problem.gate);
        problems.push(`gate ${problem.gate}: ${problem.message}`);
      }
    }
    const exception = exceptions.has(slug);
    let unexcused = false;
    for (const check of DOCUMENT_GATES) {
      const counts = perGate.get(check.gate)!;
      const passed = check.gate === 1 ? contextOk && !failing.has(1) : evaluated && !failing.has(check.gate);
      if (passed) counts.passed += 1;
      else if (exception && check.exemptable) counts.excepted += 1;
      else unexcused = true;
    }
    if (problems.length === 0) continue;
    if (!unexcused) excepted.add(slug);
    else gateFailures.set(`${slug} [${row.locale}]`, problems);
  }
  const documentTotal = input.documents.length;
  for (const check of DOCUMENT_GATES) {
    const counts = perGate.get(check.gate)!;
    const exceptedNote = counts.excepted > 0 ? `, ${counts.excepted} excused by a declared exception` : '';
    add(
      check.id,
      documentTotal > 0 && counts.passed + counts.excepted === documentTotal,
      documentTotal === 0 ? 'no release-ready documents' : `${counts.passed}/${documentTotal} documents pass${exceptedNote}`,
      { passed: counts.passed, total: documentTotal, excepted: counts.excepted },
    );
  }

  // ---- course release ---------------------------------------------------------
  const blueprintCount = catalogLessons(catalog).length;
  add(
    'forge.release.lessons-complete',
    releaseReady.length === blueprintCount && blueprintCount > 0,
    `${releaseReady.length} review-or-published / ${blueprintCount} blueprints`,
  );
  add(
    'forge.release.locales-complete',
    documentTotal === releaseReady.length * 3 && documentTotal > 0,
    `${documentTotal} documents / ${releaseReady.length * 3} expected`,
  );
  const stale = input.documents.filter((row) => row.illustration_style_version !== input.illustrationStyleVersion);
  add(
    'forge.release.illustration-style',
    stale.length === 0 && documentTotal > 0,
    `${documentTotal - stale.length}/${documentTotal} documents use ${input.illustrationStyleVersion}`,
  );

  const visualGaps: string[] = [];
  let requiredVisuals = 0;
  let presentVisuals = 0;
  for (const row of input.documents) {
    const coverage = inspectIllustrationCoverage(row.document as never);
    requiredVisuals += coverage.required;
    presentVisuals += coverage.present;
    if (coverage.missing.length > 0) visualGaps.push(`${slugById.get(row.lesson_id) ?? row.lesson_id} [${row.locale}]: ${coverage.missing.length}`);
  }
  add(
    'forge.release.visual-coverage',
    visualGaps.length === 0,
    `${presentVisuals}/${requiredVisuals} present${visualGaps.length > 0 ? `; missing in ${visualGaps.slice(0, 5).join(', ')}` : ''}`,
  );

  // A scene depicts one lesson's situation; the three locale documents of one
  // lesson share it legitimately (illustrations carry no text).
  const sceneLessonsByUrl = new Map<string, Set<string>>();
  for (const row of input.documents) {
    for (const url of collectSceneImages(row.document as never).values()) {
      const lessons = sceneLessonsByUrl.get(url) ?? new Set<string>();
      lessons.add(row.lesson_id);
      sceneLessonsByUrl.set(url, lessons);
    }
  }
  const shared = [...sceneLessonsByUrl.entries()].filter(([, lessons]) => lessons.size > 1).sort((a, b) => b[1].size - a[1].size);
  add(
    'forge.release.distinct-scenes',
    shared.length === 0,
    shared.length === 0
      ? `${sceneLessonsByUrl.size} distinct scene image(s), each in exactly one lesson`
      : `${shared.length} scene image(s) shared across lessons; worst serves ${shared[0]![1].size} lessons (${shared[0]![0]})`,
  );

  add(
    'forge.release.orphan-progress',
    input.orphansWithProgress.length === 0,
    input.orphansWithProgress.length === 0
      ? `${input.orphanCount} orphan(s), none with progress`
      : `ORPHANED WITH PROGRESS: ${input.orphansWithProgress.join(', ')}`,
  );

  // Not exemptable: a leaked currency word is a B.16 localization defect.
  const leaks: string[] = [];
  for (const row of input.documents) {
    if (WRONG_CURRENCY[row.locale]?.test(visibleText(row.document).join(' \n '))) leaks.push(`${slugById.get(row.lesson_id) ?? ''} [${row.locale}]`);
  }
  add('forge.release.currency-locale', leaks.length === 0, leaks.length === 0 ? 'none' : leaks.slice(0, 5).join(', '));

  const untranslated = input.topics.filter((topic) => {
    const title = topic.title as Record<string, string> | null;
    if (!title) return true;
    const values = ['en-US', 'es-MX', 'pt-BR'].map((locale) => (title[locale] ?? '').trim());
    return values.some((value) => value.length === 0) || new Set(values).size === 1;
  });
  add('forge.release.topic-titles', untranslated.length === 0, `${untranslated.length} topic(s) blank or identical across locales`);

  // v2: the document half of the Forge content gates (tone, Copy Budget,
  // another market's anchors or currency). The plan-level half (B.17, B.11,
  // B.16 scenarios) ran when the emitter built the document.
  const v2Documents = input.v2Documents ?? [];
  const v2Failures: string[] = [];
  for (const row of v2Documents) {
    const slug = slugById.get(row.lesson_id) ?? row.lesson_id;
    const document = row.document as { schema_version?: unknown; locale?: unknown; segments?: unknown } | null;
    // Fail closed: an unreadable, non-v2 or mislabelled activation is never attested.
    const problems =
      !document || typeof document !== 'object' || document.schema_version !== 2 || !Array.isArray(document.segments) || document.locale !== row.locale
        ? ['release context: the activated version is not a readable v2 document for this locale']
        : runV2DocumentGates(document as Record<string, unknown>).problems.map((p) => `gate ${p.gate}: ${p.message}`);
    if (problems.length > 0) {
      gateFailures.set(`${slug} [${row.locale}] (v2)`, problems);
      v2Failures.push(`${slug} [${row.locale}]`);
    }
  }
  add(
    'forge.release.v2-content',
    v2Failures.length === 0,
    v2Documents.length === 0
      ? 'no activated v2 documents'
      : `${v2Documents.length - v2Failures.length}/${v2Documents.length} activated v2 documents pass${v2Failures.length > 0 ? `; failing ${v2Failures.slice(0, 5).join(', ')}` : ''}`,
    { passed: v2Documents.length - v2Failures.length, total: v2Documents.length },
  );

  const checks = FORGE_RELEASE_CHECKS.map((definition) => {
    const result = results.get(definition.id);
    if (!result) throw new Error(`release evaluation did not record "${definition.id}"`);
    return result;
  });
  return {
    checks,
    ok: checks.every((check) => check.ok),
    gateFailures,
    exceptions,
    excepted,
    narratedDocuments: input.documents.filter((row) => row.audio?.version).length,
  };
}
