// content:gates runner — pure over already-loaded inputs, so tests drive it
// with fixtures and the CLI (cli.ts) only does discovery and I/O.
//
// The report doubles as the Appendix C Part 1.3 "Forge Gate Pass Rate (per
// gate)" data point: the share of lesson documents passing each gate, tracked
// separately per gate. It is diagnostic (no fixed target) by the appendix's
// own definition; the release check fails on any blocking finding.

import type { TaxonomyFile } from '../catalog/schema.js';
import { audienceForTier, type Audience, type ContentLocale } from './budgets.js';
import { runLessonContentGates, documentLocale, type LessonContentReport } from './lessonGates.js';
import { narrationUnits } from './lessonModel.js';
import { checkCopyBudget, type CopyBudgetFinding } from './copyBudget.js';
import { scanTone, toneAdvice, type ToneFinding } from './tone.js';
import { CONTENT_LOCALES, type CatalogString, type SourcedDocument, type UiString } from './sources.js';

export interface DocumentResult {
  source: string;
  lesson: string;
  locale: string;
  audience: string;
  passed: { redundancy: boolean; tone: boolean; copyBudget: boolean };
  report: Omit<LessonContentReport, 'problems'>;
  /** Units recorded in the seed audio manifest that this model does not produce, and vice versa. */
  narrationDrift?: { missing: string[]; extra: string[] };
}

export interface StringFinding {
  where: string;
  locale: ContentLocale;
  text: string;
}

export interface ContentGatesReport {
  generatedAt: string;
  spec: { redundancy: 'B.18'; tone: 'B.14'; copyBudget: 'OD-13' };
  documents: DocumentResult[];
  catalog: {
    strings: number;
    copyBudget: Array<CopyBudgetFinding & { file: string }>;
    tone: Array<ToneFinding & StringFinding>;
    toneReview: Array<ToneFinding & StringFinding>;
  };
  ui: {
    strings: number;
    tone: Array<ToneFinding & StringFinding>;
    toneReview: Array<ToneFinding & StringFinding>;
  };
  summary: {
    documents: number;
    passRate: { redundancy: string; tone: string; copyBudget: string };
    blocking: { redundancy: number; tone: number; copyBudget: number; catalogCopyBudget: number; catalogTone: number; uiTone: number };
    review: { lessonTone: number; catalogTone: number; uiTone: number };
    firstViewAdvisories: number;
    unclassifiedFields: number;
    narrationDriftDocuments: number;
    ok: boolean;
  };
}

export interface RunnerInput {
  taxonomy?: TaxonomyFile;
  register?: 'kid' | 'adult';
  documents: readonly SourcedDocument[];
  catalog: readonly CatalogString[];
  ui: readonly UiString[];
  /** Rebuild source literals, locale unknown: scanned with every locale's lexicon. */
  uiLiterals: ReadonlyArray<Omit<UiString, 'locale'>>;
  now?: Date;
}

function audienceOf(input: RunnerInput, tier: string | undefined, fallbackTiers: readonly string[]): Audience {
  if (tier) return audienceForTier(input.taxonomy, tier, input.register);
  // A course-level string serves every tier of the course: the youngest audience decides.
  const audiences = fallbackTiers.map((t) => audienceForTier(input.taxonomy, t, input.register));
  return audiences.find((a) => a.young) ?? audiences[0] ?? audienceForTier(input.taxonomy, 'unknown', input.register);
}

function rate(passed: number, total: number): string {
  return total === 0 ? 'n/a' : `${passed}/${total} (${Math.round((passed / total) * 100)}%)`;
}

export function runContentGates(input: RunnerInput): ContentGatesReport {
  const tiers = [...new Set([...input.catalog, ...input.documents].map((x) => x.tier).filter((t): t is string => !!t))];

  const documents: DocumentResult[] = input.documents.map((doc) => {
    const audience = audienceOf(input, doc.tier, tiers);
    const { problems, ...report } = runLessonContentGates(doc.document, audience);
    void problems;
    let narrationDrift: DocumentResult['narrationDrift'];
    if (doc.recordedUnits && doc.recordedUnits.length > 0) {
      const modelled = new Set(narrationUnits(doc.document).map((u) => u.unitId));
      const recorded = new Set(doc.recordedUnits);
      const missing = [...recorded].filter((id) => !modelled.has(id));
      const extra = [...modelled].filter((id) => !recorded.has(id));
      if (missing.length > 0 || extra.length > 0) narrationDrift = { missing, extra };
    }
    return {
      source: doc.source,
      lesson: doc.lesson,
      locale: doc.locale ?? documentLocale(doc.document),
      audience: audience.label,
      passed: { redundancy: report.redundancy.length === 0, tone: report.tone.length === 0, copyBudget: report.copyBudget.length === 0 },
      report,
      ...(narrationDrift ? { narrationDrift } : {}),
    };
  });

  const catalogCopy: Array<CopyBudgetFinding & { file: string }> = [];
  const catalogTone: Array<ToneFinding & StringFinding> = [];
  for (const item of input.catalog) {
    const audience = audienceOf(input, item.tier, tiers);
    if (item.role !== 'brief' && item.role !== 'data') {
      for (const finding of checkCopyBudget([{ segmentId: '(catalog)', path: item.path, role: item.role, text: item.text }], item.locale, audience)) {
        catalogCopy.push({ ...finding, file: item.file });
      }
    }
    for (const finding of scanTone(item.text, item.locale, 'lesson')) catalogTone.push({ ...finding, where: `${item.file} ${item.path}`, locale: item.locale, text: item.text });
  }

  const uiTone: Array<ToneFinding & StringFinding> = [];
  for (const item of input.ui) {
    for (const finding of scanTone(item.text, item.locale, 'ui')) uiTone.push({ ...finding, where: `${item.file} ${item.key}`, locale: item.locale, text: item.text });
  }
  for (const item of input.uiLiterals) {
    for (const locale of CONTENT_LOCALES) {
      for (const finding of scanTone(item.text, locale, 'ui')) uiTone.push({ ...finding, where: `${item.file} ${item.key}`, locale, text: item.text });
    }
  }

  const count = (key: keyof DocumentResult['passed']) => documents.filter((d) => d.passed[key]).length;
  const blocking = {
    redundancy: documents.reduce((n, d) => n + d.report.redundancy.length, 0),
    tone: documents.reduce((n, d) => n + d.report.tone.length, 0),
    copyBudget: documents.reduce((n, d) => n + d.report.copyBudget.length, 0),
    catalogCopyBudget: catalogCopy.length,
    catalogTone: catalogTone.filter((f) => f.severity === 'block').length,
    uiTone: uiTone.filter((f) => f.severity === 'block').length,
  };

  return {
    generatedAt: (input.now ?? new Date()).toISOString(),
    spec: { redundancy: 'B.18', tone: 'B.14', copyBudget: 'OD-13' },
    documents,
    catalog: {
      strings: input.catalog.length,
      copyBudget: catalogCopy,
      tone: catalogTone.filter((f) => f.severity === 'block'),
      toneReview: catalogTone.filter((f) => f.severity === 'review'),
    },
    ui: {
      strings: input.ui.length + input.uiLiterals.length,
      tone: uiTone.filter((f) => f.severity === 'block'),
      toneReview: uiTone.filter((f) => f.severity === 'review'),
    },
    summary: {
      documents: documents.length,
      passRate: { redundancy: rate(count('redundancy'), documents.length), tone: rate(count('tone'), documents.length), copyBudget: rate(count('copyBudget'), documents.length) },
      blocking,
      review: {
        lessonTone: documents.reduce((n, d) => n + d.report.toneReview.length, 0),
        catalogTone: catalogTone.filter((f) => f.severity === 'review').length,
        uiTone: uiTone.filter((f) => f.severity === 'review').length,
      },
      firstViewAdvisories: documents.reduce((n, d) => n + d.report.firstView.length, 0),
      unclassifiedFields: documents.reduce((n, d) => n + d.report.unclassified.length, 0),
      narrationDriftDocuments: documents.filter((d) => d.narrationDrift).length,
      ok: Object.values(blocking).every((n) => n === 0) && documents.every((d) => d.report.unclassified.length === 0),
    },
  };
}

/** Human-readable summary: what failed, where, and what to do — the Appendix C "itemized, specific failure report". */
export function formatReport(report: ContentGatesReport, maxPerSection = 15): string {
  const lines: string[] = [];
  const s = report.summary;
  lines.push('== Forge content gates (B.18 redundancy · B.14 Law 2 tone · OD-13 Copy Budget) ==');
  lines.push(`documents: ${s.documents}   catalog strings: ${report.catalog.strings}   UI strings: ${report.ui.strings}`);
  lines.push(`Forge Gate Pass Rate — redundancy ${s.passRate.redundancy} · tone ${s.passRate.tone} · copy budget ${s.passRate.copyBudget}`);
  lines.push(
    `blocking — redundancy ${s.blocking.redundancy} · lesson tone ${s.blocking.tone} · lesson copy budget ${s.blocking.copyBudget} · ` +
      `catalog copy budget ${s.blocking.catalogCopyBudget} · catalog tone ${s.blocking.catalogTone} · UI tone ${s.blocking.uiTone}`,
  );
  lines.push(`human review (Stage 3) — lesson tone ${s.review.lessonTone} · catalog tone ${s.review.catalogTone} · UI tone ${s.review.uiTone}`);
  lines.push(`advisory — segments over the first-view word budget: ${s.firstViewAdvisories}; unclassified fields: ${s.unclassifiedFields}; narration-model drift: ${s.narrationDriftDocuments} document(s)`);

  const section = (title: string, items: string[]) => {
    if (items.length === 0) return;
    lines.push('', `-- ${title} (${items.length}) --`);
    for (const item of items.slice(0, maxPerSection)) lines.push(`  ✗ ${item}`);
    if (items.length > maxPerSection) lines.push(`  … and ${items.length - maxPerSection} more in the JSON report`);
  };
  const docItems = (pick: (d: DocumentResult) => Array<{ message: string }>) =>
    report.documents.flatMap((d) => pick(d).map((f) => `${d.lesson} [${d.locale}] ${f.message}`));
  section('B.18 redundancy (gate 11)', docItems((d) => d.report.redundancy));
  section(
    'B.14 tone in lessons (gate 12)',
    report.documents.flatMap((d) => d.report.tone.map((f) => `${d.lesson} [${d.locale}] ${f.segmentId} ${f.path}: "${f.phrase}" — ${toneAdvice(f.category)}`)),
  );
  section('OD-13 copy budget in lessons (gate 13)', docItems((d) => d.report.copyBudget));
  section('OD-13 copy budget in the catalog', report.catalog.copyBudget.map((f) => `${f.file} ${f.message}`));
  section('B.14 tone in the catalog', report.catalog.tone.map((f) => `${f.where} [${f.locale}] "${f.phrase}" — ${toneAdvice(f.category)}`));
  section('B.14 tone in system/UI copy', report.ui.tone.map((f) => `${f.where} [${f.locale}] "${f.phrase}" — ${toneAdvice(f.category)}. Text: "${f.excerpt}"`));
  section(
    'unclassified lesson fields (extend classifyPath in lessonModel.ts)',
    report.documents.flatMap((d) => d.report.unclassified.map((u) => `${d.lesson} [${d.locale}] ${u.segmentId} ${u.path}`)),
  );
  lines.push('', s.ok ? 'content:gates OK — no blocking finding' : 'content:gates FAILED — fix the blocking findings above (the JSON report lists every one)');
  return lines.join('\n');
}
