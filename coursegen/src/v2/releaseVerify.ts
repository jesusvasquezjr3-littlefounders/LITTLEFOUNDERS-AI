// Pure release evaluation for a canonical v2 course. Unlike the legacy
// evaluator, this reads the v2 structure and plans as the authored source and
// compares them with the exact versions selected by Vault's current pointers.

import { MIN_MISJUDGMENT_EPISODES_PER_COURSE } from '../contentGates/misjudgment.js';
import { checkCopyBudget } from '../contentGates/copyBudget.js';
import { scanTone } from '../contentGates/tone.js';
import type { ContentLocale } from '../contentGates/budgets.js';
import { FORGE_RELEASE_CHECKS, releaseCheck } from '../release/gateManifest.js';
import type { ReleaseCheckResult, ReleaseEvaluation } from '../release/evaluate.js';
import { checkCatalog, type CatalogStructure, type KcGraphFile } from './catalogCheck.js';
import { emitV2Lesson, type EmittedV2Document } from './emit.js';
import { analyzeV2Plan, runV2DocumentGates, v2TextBlocks, V2_STAGE_SCENES } from './gates.js';
import type { V2LessonPlan } from './plan.js';

export interface CurrentV2Document {
  lesson_id: string;
  locale: ContentLocale;
  version_id: string;
  document: unknown;
  answer_keys: Record<string, unknown> | null;
}

export interface V2ReleaseVerifyInput {
  structure: CatalogStructure;
  graph: KcGraphFile;
  plans: readonly V2LessonPlan[];
  current: readonly CurrentV2Document[];
  vaultLessons: readonly { id: string; slug: string; status: string }[];
  topicTitles: readonly unknown[];
  orphansWithProgress: readonly string[];
  orphanCount: number;
  corePassed: boolean;
  coreDetail: string;
}

const LOCALES: readonly ContentLocale[] = ['en-US', 'es-MX', 'pt-BR'];
const WRONG_CURRENCY: Record<ContentLocale, RegExp> = {
  'es-MX': /\bdollars?\b|\breais\b/i,
  'en-US': /\bpesos?\b|\breais\b/i,
  // "peso" also means an ordinary weight in Portuguese. Treat it as a
  // foreign currency only when an amount or Mexican-currency qualifier makes
  // that meaning explicit; otherwise balance/weighted-score lessons are false
  // positives.
  'pt-BR': /\bdollars?\b|\b\d+(?:[.,]\d+)?\s+pesos?\b|\bpesos?\s+mexican(?:os|as)?\b/i,
};

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${stable(child)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function localizedTitles(structure: CatalogStructure, plans: readonly V2LessonPlan[]) {
  const out: Array<{ locale: ContentLocale; role: 'heading'; value: string }> = [];
  for (const pathway of structure.pathways) for (const chapter of pathway.chapters) {
    for (const locale of LOCALES) out.push({ locale, role: 'heading', value: chapter.title[locale] });
  }
  for (const plan of plans) for (const locale of LOCALES) out.push({ locale, role: 'heading', value: plan.title[locale] });
  return out;
}

/** Produce every release-manifest check from v2 evidence; no v1 rows are synthesized. */
export function evaluateV2Release(input: V2ReleaseVerifyInput): ReleaseEvaluation {
  const results = new Map<string, ReleaseCheckResult>();
  const failures = new Map<string, string[]>();
  const add = (id: string, ok: boolean, detail: string, counts: Partial<Pick<ReleaseCheckResult, 'passed' | 'total' | 'excepted'>> = {}) => {
    results.set(id, { gate: id, name: releaseCheck(id).description, ok, detail, ...counts });
  };

  const catalog = checkCatalog({ structures: [input.structure], graph: input.graph, coverage: false });
  const catalogErrors = catalog.issues.filter((issue) => issue.level === 'error');
  add('forge.catalog.loads', catalogErrors.length === 0, `${catalogErrors.length} error(s)`);
  add('forge.catalog.progression', catalogErrors.length === 0, `${catalogErrors.length} blocking; ${catalog.issues.length - catalogErrors.length} warning(s)`);

  const planPolicies = input.plans.map((plan) => ({ plan, report: analyzeV2Plan(plan) }));
  const blocks = (gate: number) => planPolicies.flatMap(({ plan, report }) => report.findings.filter((f) => f.gate === gate && f.severity === 'block').map((f) => `${plan.lesson_id}: ${f.message}`));
  const conceptBlocks = blocks(14);
  const regionalBlocks = blocks(16);
  const episodes = input.plans.filter((plan) => plan.mentor_misjudgment).length;
  add('forge.catalog.concept-cap', conceptBlocks.length === 0, `${conceptBlocks.length} blocking across ${input.plans.length} plans`);
  add('forge.catalog.mentor-misjudgment', episodes >= MIN_MISJUDGMENT_EPISODES_PER_COURSE && blocks(15).length === 0, `${episodes}/${MIN_MISJUDGMENT_EPISODES_PER_COURSE} minimum`);
  add('forge.catalog.regional-adaptation', regionalBlocks.length === 0, `${regionalBlocks.length} blocking across ${input.plans.length} plans`);

  const catalogCopy = localizedTitles(input.structure, input.plans);
  const toneProblems = catalogCopy.flatMap((item) => scanTone(item.value, item.locale, 'lesson').filter((finding) => finding.severity === 'block'));
  const budgetProblems = catalogCopy.flatMap((item) => checkCopyBudget([{ segmentId: '(catalog)', path: 'title', role: item.role, text: item.value }], item.locale, { young: false, label: 'v2 catalog' }));
  add('forge.catalog.tone', catalogCopy.length > 0 && toneProblems.length === 0, `${toneProblems.length} blocking of ${catalogCopy.length} localized titles`);
  add('forge.catalog.copy-budget', catalogCopy.length > 0 && budgetProblems.length === 0, `${budgetProblems.length} over budget of ${catalogCopy.length} localized titles`);

  const currentByKey = new Map(input.current.map((row) => [`${row.lesson_id}|${row.locale}`, row]));
  const expected: EmittedV2Document[] = [];
  const emitProblems: string[] = [];
  const emitFailed = new Map<string, Set<number>>();
  for (const plan of input.plans) {
    const version = currentByKey.get(`${plan.lesson_id}|en-US`)?.version_id ?? '00000000-0000-4000-8000-000000000000';
    const emitted = emitV2Lesson(plan, { versionId: version, requireLessonDesign: true });
    if (!emitted.ok) {
      emitProblems.push(...emitted.problems.map((problem) => `${plan.lesson_id}: gate ${problem.gate}: ${problem.message}`));
      for (const problem of emitted.problems) for (const locale of problem.locale ? [problem.locale] : LOCALES) {
        const key = `${plan.lesson_id}|${locale}`;
        const gates = emitFailed.get(key) ?? new Set<number>();
        gates.add(problem.gate);
        emitFailed.set(key, gates);
      }
    }
    for (const row of emitted.documents) {
      const current = currentByKey.get(`${row.lesson_id}|${row.locale}`);
      if (current && row.document.version_id !== current.version_id) row.document.version_id = current.version_id;
      row.version_id = current?.version_id ?? row.version_id;
      expected.push(row);
    }
  }

  const documentChecks = FORGE_RELEASE_CHECKS.filter((check) => check.gate !== undefined);
  const perGate = new Map(documentChecks.map((check) => [check.gate!, 0]));
  for (const row of input.current) {
    const report = runV2DocumentGates(row.document as Record<string, unknown>, undefined, undefined, row.answer_keys ?? undefined);
    const failed = new Set([...report.problems.map((problem) => problem.gate), ...(emitFailed.get(`${row.lesson_id}|${row.locale}`) ?? [])]);
    for (const check of documentChecks) if (!failed.has(check.gate!)) perGate.set(check.gate!, (perGate.get(check.gate!) ?? 0) + 1);
    if (report.problems.length) failures.set(`${row.lesson_id} [${row.locale}]`, report.problems.map((problem) => `gate ${problem.gate}: ${problem.message}`));
  }
  for (const check of documentChecks) {
    const passed = perGate.get(check.gate!) ?? 0;
    add(check.id, input.current.length > 0 && passed === input.current.length, `${passed}/${input.current.length} current documents pass`, { passed, total: input.current.length, excepted: 0 });
  }

  const plannedIds = new Set(input.plans.map((plan) => plan.lesson_id));
  const ready = input.vaultLessons.filter((lesson) => lesson.status === 'review' || lesson.status === 'published');
  add('forge.release.lessons-complete', ready.length === input.plans.length && ready.every((lesson) => plannedIds.has(lesson.id)), `${ready.length}/${input.plans.length} planned lessons are release-ready`);
  add('forge.release.locales-complete', input.current.length === input.plans.length * LOCALES.length && input.plans.every((plan) => LOCALES.every((locale) => currentByKey.has(`${plan.lesson_id}|${locale}`))), `${input.current.length}/${input.plans.length * LOCALES.length} current documents`);

  const expectedByKey = new Map(expected.map((row) => [`${row.lesson_id}|${row.locale}`, row]));
  const drift: string[] = [];
  for (const row of input.current) {
    const authored = expectedByKey.get(`${row.lesson_id}|${row.locale}`);
    if (!authored || stable(authored.document) !== stable(row.document) || stable(authored.answer_keys) !== stable(row.answer_keys ?? {})) drift.push(`${row.lesson_id} [${row.locale}]`);
  }
  const exact = emitProblems.length === 0 && drift.length === 0 && expected.length === input.current.length;
  add('forge.release.illustration-style', exact && input.corePassed, exact ? input.coreDetail : `${emitProblems.length} emit problem(s); ${drift.length} authored/current drift(s)`);

  const visualGaps = input.current.filter((row) => {
    const doc = row.document as { segments?: Array<{ visual?: { type?: unknown } }> };
    return !Array.isArray(doc.segments) || doc.segments.some((segment) => typeof segment.visual?.type !== 'string' || segment.visual.type.length === 0);
  });
  add('forge.release.visual-coverage', visualGaps.length === 0 && input.current.length > 0, `${input.current.length - visualGaps.length}/${input.current.length} documents declare every interactive visual`);
  const badScenes = input.current.filter((row) => {
    const doc = row.document as { mentor_stage?: { scene?: unknown }; adventure_scene_id?: unknown };
    const scene = doc.mentor_stage?.scene ?? doc.adventure_scene_id;
    return !(V2_STAGE_SCENES as readonly unknown[]).includes(scene);
  });
  add('forge.release.distinct-scenes', badScenes.length === 0 && input.current.length > 0, `${input.current.length - badScenes.length}/${input.current.length} documents use an approved Mentor stage; v2 uses interactive boards rather than reusable scene illustrations`);
  add('forge.release.orphan-progress', input.orphansWithProgress.length === 0, input.orphansWithProgress.length ? `ORPHANED WITH PROGRESS: ${input.orphansWithProgress.join(', ')}` : `${input.orphanCount} orphan(s), none with progress`);

  const leaks = input.current.filter((row) => WRONG_CURRENCY[row.locale].test(v2TextBlocks(row.document as Record<string, unknown>).map((block) => block.text).join(' '))).map((row) => `${row.lesson_id} [${row.locale}]`);
  add('forge.release.currency-locale', leaks.length === 0, leaks.length ? leaks.slice(0, 5).join(', ') : 'none');
  const untranslated = input.topicTitles.filter((title) => {
    const values = LOCALES.map((locale) => String((title as Record<string, unknown> | null)?.[locale] ?? '').trim());
    return values.some((value) => !value) || new Set(values).size === 1;
  });
  add('forge.release.topic-titles', untranslated.length === 0 && input.topicTitles.length === input.plans.length, `${untranslated.length} blank/identical; ${input.topicTitles.length}/${input.plans.length} topics`);
  const v2Failures = failures.size + emitProblems.length + drift.length + (input.corePassed ? 0 : 1);
  add('forge.release.v2-content', v2Failures === 0 && input.current.length > 0, `${input.current.length} current documents; ${v2Failures} failure(s); ${input.coreDetail}`, { passed: v2Failures ? 0 : input.current.length, total: input.current.length });

  const checks = FORGE_RELEASE_CHECKS.map((definition) => results.get(definition.id) ?? (() => { throw new Error(`v2 release evaluation did not record ${definition.id}`); })());
  return { checks, ok: checks.every((check) => check.ok), gateFailures: failures, exceptions: new Map(), excepted: new Set(), narratedDocuments: 0 };
}
